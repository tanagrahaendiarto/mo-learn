"""Exercise the real exploration routes with mocked provider transports."""
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app.adapters import alphafold, rcsb, refseq, stringdb, uniprot
from app.adapters.scientific_http import ScientificSource, SourceError
from app.main import app

client = TestClient(app)
BASE = "/api/v1/entities"


def transport(handler, base_url):
    return httpx.Client(transport=httpx.MockTransport(handler), base_url=base_url)


@pytest.fixture
def refseq_mock(monkeypatch):
    gene_range = {"begin": "5", "end": "12", "orientation": "minus"}
    gene = {
        "gene_id": "7157", "tax_id": "9606", "taxname": "Homo sapiens", "symbol": "TP53",
        "annotations": [{"assembly_name": "GRCh38.p14", "genomic_locations": [
            {"genomic_accession_version": "NC_000017.11", "genomic_range": gene_range},
        ]}],
    }
    product = {
        "gene_id": "7157", "tax_id": "9606", "transcripts": [
            {"accession_version": "NM_001126112.3", "length": 4},
            {"accession_version": "NM_000546.6", "length": 7, "select_category": "MANE_SELECT",
             "cds": {"accession_version": "NM_000546.6", "range": [{"begin": "2", "end": "7", "orientation": "plus"}]}},
        ],
    }

    def reports(request):
        is_gene = request.url.path.endswith("/dataset_report")
        key, value = ("gene", gene) if is_gene else ("product", product)
        return httpx.Response(200, json={"reports": [{key: value}]})

    def fasta(request):
        params = request.url.params
        if params["id"] == "NC_000017.11":
            assert (params["seq_start"], params["seq_stop"], params["strand"]) == ("5", "12", "2")
            return httpx.Response(200, text=">NC_000017.11:c12-5 source\nAACCGGTT\n")
        assert params["id"] == "NM_000546.6"
        return httpx.Response(200, text=">NM_000546.6 source\nCATGTAA\n")

    for source, handler in ((refseq.DATASETS, reports), (refseq.EUTILS, fasta)):
        monkeypatch.setattr(source, "client", transport(handler, str(source.client.base_url)))
        monkeypatch.setattr(source, "spacing", 0)
        monkeypatch.setattr(source, "next_request", 0)
    return gene, product


def test_refseq_distinguishes_genomic_dna_transcript_and_cds(refseq_mock):
    response = client.get(f"{BASE}/gene/7157/sequence")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "available"
    assert data["identity"]["taxonomy_id"] == 9606
    dna, transcript, cds = data["records"]
    assert (dna["kind"], dna["strand"], dna["source_id"]) == ("genomic_dna", "-", "NC_000017.11:5-12(-)")
    assert (transcript["kind"], transcript["sequence"]) == ("transcript", "CATGTAA")
    assert (cds["kind"], cds["sequence"], cds["length"]) == ("cds", "ATGTAA", 6)
    assert cds["source_url"].endswith("/NM_000546.6")


def test_refseq_partial_when_product_identity_mismatches(refseq_mock):
    _, product = refseq_mock
    product["tax_id"] = "10090"
    data = client.get(f"{BASE}/gene/7157/sequence").json()
    assert data["status"] == "partial"
    assert [item["kind"] for item in data["records"]] == ["genomic_dna"]
    assert data["notices"][0]["code"] == "identity_mismatch"


def test_refseq_rejects_wrong_fasta_accession(refseq_mock, monkeypatch):
    handler = lambda request: httpx.Response(200, text=">NM_999999.1\nAACCGGT\n")
    monkeypatch.setattr(refseq.EUTILS, "client", transport(handler, "https://eutils.ncbi.nlm.nih.gov"))
    data = client.get(f"{BASE}/gene/7157/sequence").json()
    assert data["status"] == "provider_error"
    assert data["records"] == []
    assert all(n["code"] == "identity_mismatch" for n in data["notices"])


@pytest.mark.parametrize(("sequence", "expected"), [
    ({"value": "MEEP", "length": 4}, "available"),
    ({"value": "MEEP", "length": 5}, "provider_error"),
    (None, "empty"),
])
def test_uniprot_sequence_shape(monkeypatch, sequence, expected):
    payload = {"primaryAccession": "P04637", "sequence": sequence, "organism": {"taxonId": 9606}}
    handler = lambda request: httpx.Response(200, json=payload)
    monkeypatch.setattr(uniprot, "_client", transport(handler, uniprot.BASE))
    data = client.get(f"{BASE}/protein/p04637/sequence").json()
    assert data["status"] == expected
    assert data["identity"]["accession"] == "P04637"


def test_scientific_timeout_retries_once(monkeypatch):
    source = ScientificSource("https://example.test", spacing=0)
    attempts = []

    def failure(request):
        attempts.append(request)
        raise httpx.ReadTimeout("test")

    monkeypatch.setattr(source, "client", transport(failure, "https://example.test"))
    with pytest.raises(SourceError, match="timeout"):
        source.get("/test", time.monotonic() + 2)
    assert len(attempts) == 2


def test_sequence_validates_identifiers():
    assert client.get(f"{BASE}/gene/1234567890123/sequence").status_code == 422
    assert client.get(f"{BASE}/protein/NOT_APROTEIN/sequence").status_code == 422


@pytest.mark.parametrize("search_failure", [False, True])
def test_literature_provenance_and_abstract_rights(monkeypatch, search_failure):
    record = {"primaryAccession": "P04637", "organism": {"taxonId": 9606, "scientificName": "Homo sapiens"},
              "genes": [{"geneName": {"value": "TP53"}}],
              "references": [{"citation": {"citationCrossReferences": [{"database": "PubMed", "id": "101"}]}}]}
    monkeypatch.setattr(uniprot, "_client", transport(lambda request: httpx.Response(200, json=record), uniprot.BASE))

    def article(pmid, license_url=""):
        return f"""<PubmedArticle><MedlineCitation><PMID>{pmid}</PMID><Article>
          <ArticleTitle>Study <i>{pmid}</i></ArticleTitle><Journal><Title>Test Journal</Title>
          <JournalIssue><PubDate><Year>2024</Year></PubDate></JournalIssue></Journal>
          <AuthorList><Author><ForeName>Ada</ForeName><LastName>Example</LastName></Author></AuthorList>
          <Abstract><AbstractText>Example abstract.</AbstractText><CopyrightInformation>{license_url}</CopyrightInformation></Abstract>
          </Article></MedlineCitation><PubmedData><ArticleIdList><ArticleId IdType="doi">10.1234/test{pmid}</ArticleId>
          </ArticleIdList></PubmedData></PubmedArticle>"""

    def pubmed_handler(request):
        if request.url.path.endswith("esearch.fcgi"):
            term = request.url.params["term"]
            assert '"TP53"[Title/Abstract]' in term and '"Humans"[MeSH Terms]' in term
            if search_failure:
                return httpx.Response(200, json={"unexpected": True})
            return httpx.Response(200, json={"esearchresult": {"idlist": ["101", "102"]}})
        assert request.url.path.endswith("efetch.fcgi")
        assert request.url.params["id"] == ("101" if search_failure else "101,102")
        xml = article(101) + article(999)  # unrequested result must not be displayed
        if not search_failure:
            xml += article(102, "https://creativecommons.org/licenses/by/4.0/")
        return httpx.Response(200, text=f"<PubmedArticleSet>{xml}</PubmedArticleSet>")

    monkeypatch.setattr(refseq.EUTILS, "client", transport(pubmed_handler, "https://eutils.ncbi.nlm.nih.gov"))
    data = client.get(f"{BASE}/protein/P04637/literature").json()
    assert data["status"] == ("partial" if search_failure else "available")
    direct = data["records"][0]
    assert (direct["relation"], direct["relation_source"], direct["pmid"]) == ("direct", "UniProtKB", "101")
    assert direct["title"] == "Study 101"
    assert direct["authors"] == ["Ada Example"]
    assert direct["abstract_available"] is True and direct["abstract"] is None
    if not search_failure:
        related = data["records"][1]
        assert related["relation"] == "related" and related["pmid"] == "102"
        assert related["abstract"] == "Example abstract."
        assert related["doi"] == "10.1234/test102"


@pytest.fixture
def structure_mock(monkeypatch):
    protein = {
        "primaryAccession": "P04637", "organism": {"taxonId": 9606, "scientificName": "Homo sapiens"},
        "sequence": {"value": "MEEP", "length": 4},
        "uniProtKBCrossReferences": [{"database": "PDB", "id": "1TUP", "properties": [{"key": "Chains", "value": "A/C=1-4"}]}],
    }
    entry = {
        "rcsb_id": "1TUP", "struct": {"title": "Example structure"}, "exptl": [{"method": "X-RAY DIFFRACTION"}],
        "rcsb_entry_info": {"resolution_combined": [2.2]}, "rcsb_entry_container_identifiers": {"assembly_ids": ["1"]},
        "polymer_entities": [{"rcsb_polymer_entity_container_identifiers": {
            "auth_asym_ids": ["A", "B"], "reference_sequence_identifiers": [
                {"database_name": "UniProt", "database_accession": "P04637"},
            ],
        }}],
    }
    model = {
        "entryId": "AF-P04637-F1", "uniprotAccession": "P04637", "taxId": 9606,
        "uniprotStart": 1, "uniprotEnd": 4, "sequence": "MEEP", "chainId": "A", "globalMetricValue": 75.06,
        "latestVersion": 6, "cifUrl": "https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v6.cif",
        "pdbUrl": "https://untrusted.example/AF-P04637-F1-model_v6.pdb",
    }
    monkeypatch.setattr(uniprot, "_client", transport(lambda request: httpx.Response(200, json=protein), uniprot.BASE))
    for source, blob in ((rcsb.SOURCE, {"data": {"entries": [entry]}}), (alphafold.SOURCE, [model])):
        def handle(request, body=blob):
            return httpx.Response(200, json=body)
        monkeypatch.setattr(source, "client", transport(handle, str(source.client.base_url)))
    return entry, model


def test_structure_verifies_chains_confidence_and_downloads(structure_mock):
    result = client.get(f"{BASE}/protein/P04637/structure").json()
    assert result["status"] == "available"
    experiment, prediction = result["records"]
    assert experiment["source_id"] == "1TUP" and experiment["resolution_angstrom"] == [2.2]
    assert experiment["coverage"] == [{"chain": "A", "start": 1, "end": 4}, {"chain": "B", "start": None, "end": None}]
    assert prediction["kind"] == "predicted" and prediction["mean_plddt"] == 75.06
    assert [a["format"] for a in prediction["downloads"]] == ["mmCIF"]


def test_structure_preserves_rcsb_when_prediction_identity_mismatches(structure_mock):
    _, model = structure_mock
    model["taxId"] = 10090
    result = client.get(f"{BASE}/protein/P04637/structure").json()
    assert result["status"] == "partial"
    assert [record["source_id"] for record in result["records"]] == ["1TUP"]
    assert result["notices"][0]["code"] == "identity_mismatch"


def test_ligand_keeps_only_components_from_verified_structures(structure_mock):
    entry, _ = structure_mock
    entry["nonpolymer_entities"] = [
        {"nonpolymer_comp": {"chem_comp": {"id": "ZN", "name": "ZINC ION", "formula": "Zn", "type": "non-polymer",
                                          "pdbx_formal_charge": 2}, "rcsb_chem_comp_info": {"atom_count": 1}}},
        {"nonpolymer_comp": {"chem_comp": {"id": "MG", "name": "MAGNESIUM ION", "formula": "Mg", "type": "non-polymer"}}},
    ]
    data = client.get(f"{BASE}/protein/P04637/ligand").json()
    assert data["status"] == "available"
    assert [(record["source_id"], record["formula"], record["category"], record["pdb_ids"])
            for record in data["records"]] == [("ZN", "Zn", "ion", ["1TUP"]), ("MG", "Mg", "ion", ["1TUP"])]
    assert not any(record["cofactor_chebi"] for record in data["records"])
    entry["polymer_entities"] = []
    data = client.get(f"{BASE}/protein/P04637/ligand").json()
    assert not data["records"] and data["notices"][0]["code"] == "not_available"


@pytest.mark.parametrize("exact_mapping", [True, False])
def test_string_validates_identity_and_taxon(monkeypatch, exact_mapping):
    seed = "9606.ENSP00000269305"
    partner = "9606.ENSP00000263253"
    protein = {"primaryAccession": "P04637", "organism": {"taxonId": 9606},
               "uniProtKBCrossReferences": [{"database": "STRING", "id": seed}]}
    monkeypatch.setattr(uniprot, "_client", transport(lambda request: httpx.Response(200, json=protein), uniprot.BASE))
    calls = []

    def handler(request):
        calls.append(request)
        assert request.url.params["species"] == "9606"
        if request.url.path.endswith("get_string_ids"):
            assert request.url.params["identifiers"] == "P04637"
            return httpx.Response(200, json=[
                {"queryItem": "P04637", "ncbiTaxonId": 9606, "stringId": seed if exact_mapping else partner},
            ])
        assert request.url.params["identifiers"] == seed
        assert (request.url.params["limit"], request.url.params["required_score"], request.url.params["network_type"]) == ("10", "700", "functional")
        evidence = {"stringId_A": partner, "stringId_B": seed, "ncbiTaxonId": 9606,
                    "preferredName_A": "EP300", "preferredName_B": "TP53", "score": 0.98, "escore": 0.8}
        return httpx.Response(200, json=[evidence, {**evidence, "stringId_A": "10090.ENSMUSP0"}])

    monkeypatch.setattr(stringdb.SOURCE, "client", transport(handler, stringdb.BASE))
    monkeypatch.setattr(stringdb.SOURCE, "spacing", 0)
    monkeypatch.setattr(stringdb.SOURCE, "next_request", 0)
    data = client.get(f"{BASE}/protein/P04637/interaction").json()
    if not exact_mapping:
        assert data["status"] == "provider_error" and not data["records"] and len(calls) == 1
    else:
        assert data["status"] == "partial" and len(data["records"]) == 1
        record = data["records"][0]
        assert record["partner_id"] == partner and record["partner_name"] == "EP300"
        assert record["evidence"] == {"Experiments": 0.8}
        assert record["network_type"] == "functional"
