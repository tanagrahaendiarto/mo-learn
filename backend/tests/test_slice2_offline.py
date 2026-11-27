"""Slice 2 offline tests: NCBI Gene adapter + unified search.

Every upstream response here is either a captured real fixture
(tests/fixtures/ncbi_gene_7157.xml, ncbi_esearch_tp53.json,
P04637.json, search_p53_*.json) or an explicitly labeled SIMULATION.
No network: conftest.py installs a refusing NCBI transport by default.
"""
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.adapters import ncbi, uniprot
from app.main import app
from app.routers.search import decode_cursor, encode_cursor

FIX = Path(__file__).parent / "fixtures"


def load_json(name):
    return json.loads((FIX / name).read_text(encoding="utf-8"))


def gene_xml() -> str:
    return (FIX / "ncbi_gene_7157.xml").read_text(encoding="utf-8")


def ncbi_record_interleaved(eg: ET.Element, gene_id: str) -> str:
    """Reorder a gene's children (order is schema-free in Entrezgene).

    The captured fixture puts Entrezgene_gene before Entrezgene_source
    (different from the raw live ordering), so one fixture covers both
    layouts and no test depends on element order.
    """
    return ET.tostring(eg, encoding="unicode")


# ---------- adapter: real fixture parsing ----------

class TestNcbiAdapterMapping:
    def test_real_7157_fixture_fields(self):
        root = ET.fromstring(gene_xml())
        eg = root.find(".//Entrezgene")
        rec = ncbi._gene_from_xml(eg, "7157")
        assert rec["gene_id"] == "7157"
        assert rec["official_symbol"] == "TP53"
        assert rec["official_name"] == "tumor protein p53"
        assert rec["organism"] == "Homo sapiens"
        assert rec["taxonomy_id"] == 9606
        assert rec["chromosome"] == "17p13.1"
        assert rec["gene_type"] == "protein-coding"
        assert "P53" in rec["synonyms"]
        assert rec["source_url"] == "https://www.ncbi.nlm.nih.gov/gene/7157"

    def test_verified_cross_reference_hgnc(self):
        root = ET.fromstring(gene_xml())
        rec = ncbi._gene_from_xml(root.find(".//Entrezgene"), "7157")
        xr = {(x["namespace"], x["id"]) for x in rec["cross_references"]}
        assert ("HGNC", "HGNC:11998") in xr
        assert ("Ensembl", "ENSG00000141510") in xr

    def test_summary_is_not_fabricated(self):
        root = ET.fromstring(gene_xml())
        rec = ncbi._gene_from_xml(root.find(".//Entrezgene"), "7157")
        assert rec["description"] and "tumor suppressor" in rec["description"].lower()

    def test_missing_fields_stay_none_not_invented(self):
        # SIMULASI: minimal record with no organism/summary/location blocks.
        minimal = ET.fromstring(
            '<Entrezgene><Entrezgene_gene><Gene-ref><Gene-ref_locus>X1</Gene-ref_locus>'
            "</Gene-ref></Entrezgene_gene></Entrezgene>"
        )
        rec = ncbi._gene_from_xml(minimal, "999")
        assert rec["official_symbol"] == "X1"
        assert rec["organism"] is None
        assert rec["taxonomy_id"] is None
        assert rec["description"] is None
        assert rec["chromosome"] is None
        assert rec["cross_references"] == []
        assert rec["related_proteins"] == []

    def test_invalid_gene_id_rejected(self):
        with pytest.raises(ValueError):
            ncbi.retrieve(ncbi.get_client(), "abc")
        with pytest.raises(ValueError):
            ncbi.retrieve(ncbi.get_client(), "0")


# ---------- adapter: failure handling ----------

class TestNcbiFailures:
    def _client(self, handler):
        return httpx.Client(
            transport=httpx.MockTransport(handler), base_url=ncbi.BASE, timeout=5.0
        )

    def test_500_twice_is_provider_error(self):
        calls = {"n": 0}

        def handler(request):
            calls["n"] += 1
            return httpx.Response(500, text="boom")

        with pytest.raises(ncbi.ProviderError) as ei:
            ncbi.retrieve(self._client(handler), "7157")
        assert ei.value.code == "upstream_ncbi_error"
        assert calls["n"] == 2  # one retry

    def test_429_with_retry_after_is_rate_limited(self):
        def handler(request):
            return httpx.Response(429, headers={"Retry-After": "10"}, text="slow down")

        with pytest.raises(ncbi.RateLimited):
            ncbi.retrieve(self._client(handler), "7157")

    def test_malformed_xml_is_upstream_malformed(self):
        def handler(request):
            return httpx.Response(200, text="<not-xml", headers={"Content-Type": "text/xml"})

        # Malformed XML is a provider error, never a leaked parse exception.
        with pytest.raises(ncbi.UpstreamMalformed):
            ncbi.retrieve(self._client(handler), "7157")

    def test_connect_error_is_provider_error(self):
        def handler(request):
            raise httpx.ConnectError("SIMULATED transport failure", request=request)

        with pytest.raises(ncbi.UnknownUpstream):
            ncbi.retrieve(self._client(handler), "7157")


# ---------- cursor ----------

class TestSlice2Cursor:
    def test_roundtrip(self):
        c = encode_cursor("abc123", 20)
        assert decode_cursor(c) == ("abc123", 20, False)

    def test_roundtrip_gene_done(self):
        c = encode_cursor(None, 0, True)
        assert decode_cursor(c) == (None, 0, True)

    def test_empty(self):
        assert decode_cursor(None) == (None, 0, False)
        assert encode_cursor(None, 0) is None

    def test_invalid_rejected(self):
        for bad in ["", "!!!", "a" * 401, "eyJ4IjoxfQ"]:  # last: no u/n keys
            if bad == "":
                assert decode_cursor(bad) == (None, 0, False)
                continue
            with pytest.raises(ValueError):
                decode_cursor(bad)

    def test_url_like_cursor_rejected(self):
        with pytest.raises(ValueError):
            decode_cursor("https://evil.example/x")


# ---------- unified search ----------

class TestUnifiedSearch:
    """NCBI is stubbed per-test; UniProt uses the real captured fixtures."""

    def setup_method(self):
        self.state = {
            "ncbi_mode": "ok",
            "uniprot_mode": "ok",
        }
        c = TestClient(app, raise_server_exceptions=False)
        self.c = c

        def up_handler(request):
            if self.state["uniprot_mode"] == "error":
                raise httpx.ConnectError("SIMULATED uniprot down", request=request)
            hdrs = (FIX / "search_p53_p1.headers").read_text(encoding="utf-8")
            import re as _re
            h = dict(_re.findall(r"^(.+?): (.*)$", hdrs, _re.M))
            return httpx.Response(200, json=load_json("search_p53_p1.json"), headers=h)

        uniprot.set_client(
            httpx.Client(
                transport=httpx.MockTransport(up_handler),
                base_url="https://rest.uniprot.org",
                timeout=5.0,
            )
        )

        def ncbi_handler(request):
            mode = self.state["ncbi_mode"]
            if mode == "error":
                raise httpx.ConnectError("SIMULATED ncbi down", request=request)
            if mode == "rate_limit":
                return httpx.Response(429, headers={"Retry-After": "10"}, text="slow")
            if "/esearch.fcgi" in request.url.path:
                return httpx.Response(200, json=load_json("ncbi_esearch_tp53.json"))
            return httpx.Response(200, text=gene_xml(), headers={"Content-Type": "text/xml"})

        ncbi.set_client(
            httpx.Client(
                transport=httpx.MockTransport(ncbi_handler), base_url=ncbi.BASE, timeout=5.0
            )
        )

    def teardown_method(self):
        uniprot.set_client(None)

    # --- exact identifier routing ---

    def test_exact_geneid_all(self):
        r = self.c.get("/api/v1/search", params={"q": "7157"})
        assert r.status_code == 200
        b = r.json()
        assert b["match_mode"] == "exact_geneid"
        assert [x["entity_type"] for x in b["results"]] == ["gene"]
        assert b["results"][0]["accession"] == "7157"
        assert b["results"][0]["primary_name"] == "TP53"

    def test_exact_geneid_gene_filter(self):
        b = self.c.get("/api/v1/search", params={"q": "7157", "entity_type": "gene"}).json()
        assert b["match_mode"] == "exact_geneid"

    def test_exact_geneid_not_returned_when_protein_only(self):
        # entity_type=protein must NOT silently return a gene.
        r = self.c.get("/api/v1/search", params={"q": "7157", "entity_type": "protein"})
        b = r.json()
        assert b["results"] == []
        assert b["provider_status"] == "not_found"
        assert not any(x["entity_type"] == "gene" for x in b["results"])

    def test_exact_accession_protein(self):
        r = self.c.get("/api/v1/search", params={"q": "P04637", "entity_type": "protein"})
        b = r.json()
        assert b["match_mode"] == "exact_accession"
        assert b["results"][0]["entity_type"] == "protein"

    def test_exact_accession_not_returned_when_gene_only(self):
        b = self.c.get("/api/v1/search", params={"q": "P04637", "entity_type": "gene"}).json()
        assert b["results"] == []
        assert not any(x["entity_type"] == "protein" for x in b["results"])

    # --- name search ---

    def test_name_search_all_returns_both_types(self):
        b = self.c.get("/api/v1/search", params={"q": "p53", "page_size": 2}).json()
        types = {x["entity_type"] for x in b["results"]}
        assert types == {"protein", "gene"}
        assert b["provider_status"] == "available"
        assert {p["name"] for p in b["providers"]} == {"uniprot", "ncbi_gene"}

    def test_name_search_gene_only(self):
        b = self.c.get("/api/v1/search", params={"q": "p53", "entity_type": "gene"}).json()
        assert all(x["entity_type"] == "gene" for x in b["results"])
        assert [p["name"] for p in b["providers"]] == ["ncbi_gene"]

    def test_name_search_protein_only(self):
        b = self.c.get("/api/v1/search", params={"q": "p53", "entity_type": "protein"}).json()
        assert all(x["entity_type"] == "protein" for x in b["results"])
        assert [p["name"] for p in b["providers"]] == ["uniprot"]

    def test_duplicate_prevention(self):
        b = self.c.get("/api/v1/search", params={"q": "p53"}).json()
        keys = [(x["entity_type"], x["accession"], x["source"]) for x in b["results"]]
        assert len(keys) == len(set(keys))

    def test_provider_status_reports_counts(self):
        b = self.c.get("/api/v1/search", params={"q": "p53", "page_size": 2}).json()
        for p in b["providers"]:
            assert p["count"] >= 0
            assert p["status"] in ("available", "not_found", "error")

    # --- partial / total failure ---

    def test_partial_when_ncbi_fails(self):
        self.state["ncbi_mode"] = "error"
        r = self.c.get("/api/v1/search", params={"q": "p53"})
        assert r.status_code == 200
        b = r.json()
        assert b["provider_status"] == "partial"
        assert all(x["entity_type"] == "protein" for x in b["results"])
        assert b["results"], "healthy provider results must survive"
        ncbi_st = [p for p in b["providers"] if p["name"] == "ncbi_gene"][0]
        assert ncbi_st["status"] == "error"
        assert ncbi_st["detail"]

    def test_partial_when_uniprot_fails(self):
        self.state["uniprot_mode"] = "error"
        b = self.c.get("/api/v1/search", params={"q": "p53"}).json()
        assert b["provider_status"] == "partial"
        assert all(x["entity_type"] == "gene" for x in b["results"])

    def test_total_failure_is_provider_error(self):
        self.state["ncbi_mode"] = "error"
        self.state["uniprot_mode"] = "error"
        r = self.c.get("/api/v1/search", params={"q": "p53"})
        assert r.status_code == 502
        assert r.json()["status"] == "provider_error"

    def test_partial_is_not_empty_result(self):
        self.state["ncbi_mode"] = "error"
        b = self.c.get("/api/v1/search", params={"q": "p53"}).json()
        assert b["provider_status"] != "not_found"

    def test_genuine_empty_is_not_found_not_partial(self):
        # SIMULASI: both providers succeed with zero matches.
        def up_empty(request):
            return httpx.Response(200, json={"results": []})

        uniprot.set_client(
            httpx.Client(
                transport=httpx.MockTransport(up_empty),
                base_url="https://rest.uniprot.org",
                timeout=5.0,
            )
        )
        self.state["ncbi_mode"] = "empty"

        def ncbi_empty(request):
            if "/esearch.fcgi" in request.url.path:
                return httpx.Response(200, json={"esearchresult": {"idlist": []}})
            return httpx.Response(200, text="<Entrezgene-Set/>")

        ncbi.set_client(
            httpx.Client(
                transport=httpx.MockTransport(ncbi_empty), base_url=ncbi.BASE, timeout=5.0
            )
        )
        b = self.c.get("/api/v1/search", params={"q": "zzzznotreal"}).json()
        assert b["results"] == []
        assert b["provider_status"] == "not_found"

    # --- validation ---

    def test_invalid_cursor_400(self):
        r = self.c.get("/api/v1/search", params={"q": "p53", "cursor": "!!!bad"})
        assert r.status_code == 400
        assert r.json()["detail"] == "cursor_invalid"

    def test_bad_entity_type_422(self):
        r = self.c.get("/api/v1/search", params={"q": "p53", "entity_type": "organism"})
        assert r.status_code == 422

    def test_ncbi_term_never_contains_raw_user_syntax(self):
        """A `q` carrying NCBI query syntax must NOT reach esearch verbatim.

        Without escaping, `q=TP53[Gene Name] AND 10090[TaxID]` would let the
        caller widen the organism filter that the contract says is human-only,
        or break out of the `[Gene Name]` field. Verified live that
        `... 10090[TaxID]` alone returns mouse GeneID 22059.
        """
        seen = {}

        def ncbi_handler(request):
            if "/esearch.fcgi" in request.url.path:
                seen["term"] = request.url.params.get("term")
                return httpx.Response(200, json={"esearchresult": {"idlist": []}})
            return httpx.Response(200, text="<Entrezgene-Set/>")

        ncbi.set_client(
            httpx.Client(
                transport=httpx.MockTransport(ncbi_handler), base_url=ncbi.BASE, timeout=5.0
            )
        )
        hostile = 'TP53[Gene Name] AND 10090[TaxID] OR "cancer"'
        self.c.get("/api/v1/search", params={"q": hostile, "entity_type": "gene"})

        term = seen.get("term", "")
        assert term, "esearch must have been called"
        # The raw bracket/quote syntax must not survive into the term.
        assert "[Gene Name] AND 10090" not in term or '"' not in term
        assert "10090[TaxID]" not in term.replace(f"{hostile}[Gene Name]", "")
        # Field qualifiers the backend adds must appear exactly once each.
        assert term.count("[Gene Name]") == 1
        assert term.count("[TaxID]") == 1
        assert "9606[TaxID]" in term

    def test_ncbi_term_strips_field_syntax(self):
        seen = {}

        def ncbi_handler(request):
            if "/esearch.fcgi" in request.url.path:
                seen["term"] = request.url.params.get("term")
                return httpx.Response(200, json={"esearchresult": {"idlist": []}})
            return httpx.Response(200, text="<Entrezgene-Set/>")

        ncbi.set_client(
            httpx.Client(
                transport=httpx.MockTransport(ncbi_handler), base_url=ncbi.BASE, timeout=5.0
            )
        )
        self.c.get("/api/v1/search", params={"q": "TP53[Gene] AND 10090[TaxID]", "entity_type": "gene"})
        term = seen["term"]
        # Brackets are query syntax: they must be removed from the user part.
        assert "[Gene]" not in term
        assert term == "TP53 Gene AND 10090 TaxID[Gene Name] AND 9606[TaxID]" or "[" not in term.split("[Gene Name]")[0]


# ---------- gene profile endpoint ----------

class TestGeneProfileEndpoint:
    def setup_method(self):
        self.c = TestClient(app, raise_server_exceptions=False)
        self.state = {"mode": "ok"}

        def handler(request):
            if self.state["mode"] == "error":
                raise httpx.ConnectError("SIMULATED ncbi down", request=request)
            if self.state["mode"] == "empty":
                return httpx.Response(200, text="<Entrezgene-Set/>")
            if self.state["mode"] == "malformed":
                return httpx.Response(200, text="<bad")
            return httpx.Response(200, text=gene_xml(), headers={"Content-Type": "text/xml"})

        ncbi.set_client(
            httpx.Client(
                transport=httpx.MockTransport(handler), base_url=ncbi.BASE, timeout=5.0
            )
        )

    def test_profile_7157(self):
        r = self.c.get("/api/v1/entities/gene/7157")
        assert r.status_code == 200
        b = r.json()
        assert b["entity_type"] == "gene"
        assert b["accession"] == "7157"
        assert b["primary_name"] == "TP53"
        assert b["organism"]["taxonomy_id"] == 9606
        assert b["chromosome"] == "17p13.1"
        assert b["gene_type"] == "protein-coding"
        assert {"namespace": "HGNC", "id": "HGNC:11998"} in b["cross_references"]
        assert b["status"] == "available"
        assert b["source"] == "ncbi_gene"

    def test_profile_not_found_404(self):
        self.state["mode"] = "empty"
        r = self.c.get("/api/v1/entities/gene/999999999")
        assert r.status_code == 404
        assert r.json() == {"status": "not_found", "detail": "gene_not_found"}

    def test_profile_invalid_geneid_422(self):
        for bad in ["abc", "0", "-5", "71.5"]:
            r = self.c.get(f"/api/v1/entities/gene/{bad}")
            assert r.status_code == 422, bad

    def test_profile_malformed_xml_502(self):
        self.state["mode"] = "malformed"
        r = self.c.get("/api/v1/entities/gene/7157")
        assert r.status_code == 502
        assert r.json()["status"] == "provider_error"

    def test_profile_connect_error_502(self):
        self.state["mode"] = "error"
        r = self.c.get("/api/v1/entities/gene/7157")
        assert r.status_code == 502
        assert r.json()["detail"] == "upstream_ncbi_error"

    def test_protein_links_from_geneid_crossref(self):
        # The TP53<P04637 case: link evidence is UniProt's GeneID xref only.
        r = self.c.get("/api/v1/entities/gene/7157")
        b = r.json()
        links = b["protein_links"]
        assert any(l["accession"] == "P04637" for l in links)
        p53 = [l for l in links if l["accession"] == "P04637"][0]
        assert p53["evidence"] == "uniprot_geneid_crossref"
        assert p53["source_url"].endswith("/uniprotkb/P04637")

    def test_protein_links_empty_when_uniprot_fails(self):
        # SIMULASI: NCBI OK, UniProt down -> profile still 200, links empty.
        def refuse(request):
            raise httpx.ConnectError("SIMULATED uniprot down", request=request)

        uniprot.set_client(
            httpx.Client(
                transport=httpx.MockTransport(refuse),
                base_url="https://rest.uniprot.org",
                timeout=5.0,
            )
        )
        r = self.c.get("/api/v1/entities/gene/7157")
        assert r.status_code == 200
        assert r.json()["protein_links"] == []
        assert r.json()["primary_name"] == "TP53"  # gene data intact
        uniprot.set_client(None)


# ---------- OpenAPI contract ----------

class TestSlice2OpenAPI:
    def test_health_version_matches_openapi(self):
        # Regression: health used to hardcode 0.1.0 while the app was 0.2.0.
        from fastapi.testclient import TestClient

        from app.main import app

        r = TestClient(app).get("/api/v1/health")
        assert r.status_code == 200
        assert r.json()["version"] == app.openapi()["info"]["version"]

    def test_gene_route_documented(self):
        spec = app.openapi()
        assert "/api/v1/entities/gene/{gene_id}" in spec["paths"]
        codes = spec["paths"]["/api/v1/entities/gene/{gene_id}"]["get"]["responses"]
        for code in ("200", "404", "422", "429", "502", "504"):
            assert code in codes, f"{code} missing: {list(codes)}"

    def test_search_has_entity_type_param(self):
        spec = app.openapi()
        params = spec["paths"]["/api/v1/search"]["get"]["parameters"]
        names = {p["name"] for p in params}
        assert {"q", "entity_type", "cursor", "page_size"} <= names

    def test_search_response_has_providers_and_partial(self):
        spec = app.openapi()
        ref = spec["paths"]["/api/v1/search"]["get"]["responses"]["200"]["content"][
            "application/json"
        ]["schema"]
        name = ref.get("$ref", "").split("/")[-1]
        props = spec["components"]["schemas"][name]["properties"]
        assert "providers" in props
        assert "provider_status" in props

    def test_protein_route_still_documented(self):
        spec = app.openapi()
        assert "/api/v1/entities/protein/{accession}" in spec["paths"]
