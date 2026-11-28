"""LIVE tests: real backend against real UniProt + real NCBI.

Hits the LOCAL backend API (uvicorn on 127.0.0.1:8000) end-to-end, which in
turn calls the real upstream providers. Requires network access to
rest.uniprot.org and eutils.ncbi.nlm.nih.gov.

Run explicitly:
    .venv/Scripts/python.exe -m pytest -m live tests/test_api_live.py

A skip means integration is UNVERIFIED, not broken. Nothing here asserts on
a mocked response.
"""
import os

import httpx
import pytest

pytestmark = pytest.mark.live

LIVE_BASE = os.getenv("LIVE_BASE_URL", "http://127.0.0.1:8000")


@pytest.fixture(scope="module")
def live():
    """Real requests to the local uvicorn server. Skip if server down."""
    try:
        r = httpx.get(LIVE_BASE + "/api/v1/health", timeout=5)
        assert r.status_code == 200, "local backend not up"
    except Exception:
        pytest.skip("local backend offline at %s - LIVE UNVERIFIED" % LIVE_BASE)
    c = httpx.Client(base_url=LIVE_BASE, timeout=45)
    try:
        yield c
    finally:
        c.close()


# ---------- slice 1 regression: protein path must still work ----------

def test_health(live):
    assert live.get("/api/v1/health").status_code == 200


def test_search_accession(live):
    r = live.get("/api/v1/search", params={"q": "P04637", "page_size": 5, "entity_type": "protein"})
    assert r.status_code == 200, r.text[:200]
    b = r.json()
    assert b["match_mode"] == "exact_accession"
    assert b["provider_status"] == "available"
    accs = [x["accession"] for x in b["results"]]
    assert "P04637" in accs  # ordering not guaranteed; membership is the claim


def test_search_name_protein_only(live):
    r = live.get("/api/v1/search", params={"q": "p53", "page_size": 5, "entity_type": "protein"})
    assert r.status_code == 200, r.text[:200]
    b = r.json()
    assert b["match_mode"] == "name"
    assert len(b["results"]) >= 1
    assert any(x["gene_symbols"] for x in b["results"])
    assert all(x["entity_type"] == "protein" for x in b["results"])


def test_profile_p04637(live):
    r = live.get("/api/v1/entities/protein/P04637")
    assert r.status_code == 200, r.text[:300]
    b = r.json()
    assert b["primary_name"] == "Cellular tumor antigen p53"
    assert b["organism"]["scientific_name"] == "Homo sapiens"
    assert b["organism"]["taxonomy_id"] == 9606
    assert b["gene_symbols"] == ["TP53"]
    assert b["length"] == 393
    assert b["status"] == "available"


def test_search_two_pages_with_real_cursor(live):
    """Page 1 -> take next_cursor -> page 2. The cursor is the real token."""
    r1 = live.get("/api/v1/search", params={"q": "p53", "page_size": 2, "entity_type": "protein"})
    assert r1.status_code == 200, r1.text[:200]
    b1 = r1.json()
    assert b1["next_cursor"], "page 1 must carry a next_cursor"
    r2 = live.get(
        "/api/v1/search",
        params={
            "q": "p53",
            "page_size": 2,
            "entity_type": "protein",
            "cursor": b1["next_cursor"],
        },
    )
    assert r2.status_code == 200, r2.text[:200]
    b2 = r2.json()
    assert len(b2["results"]) >= 1
    accs1 = {x["accession"] for x in b1["results"]}
    accs2 = {x["accession"] for x in b2["results"]}
    assert not (accs1 & accs2), f"pages overlapped: {accs1 & accs2}"


# ---------- slice 2: NCBI Gene, live ----------

def test_gene_exact_geneid_lookup(live):
    """7157 -> exact NCBI GeneID lookup, human TP53."""
    r = live.get("/api/v1/search", params={"q": "7157"})
    assert r.status_code == 200, r.text[:300]
    b = r.json()
    assert b["match_mode"] == "exact_geneid"
    assert b["provider_status"] == "available"
    assert len(b["results"]) == 1
    g = b["results"][0]
    assert g["entity_type"] == "gene"
    assert g["accession"] == "7157"
    assert g["primary_name"] == "TP53"
    assert g["source"] == "ncbi_gene"
    assert g["source_url"] == "https://www.ncbi.nlm.nih.gov/gene/7157"


def test_gene_profile_7157(live):
    r = live.get("/api/v1/entities/gene/7157")
    assert r.status_code == 200, r.text[:300]
    b = r.json()
    assert b["entity_type"] == "gene"
    assert b["accession"] == "7157"
    assert b["primary_name"] == "TP53"
    assert b["organism"]["scientific_name"] == "Homo sapiens"
    assert b["organism"]["taxonomy_id"] == 9606
    assert b["chromosome"] == "17p13.1"
    assert b["gene_type"] == "protein-coding"
    assert {"namespace": "HGNC", "id": "HGNC:11998"} in b["cross_references"]
    assert b["status"] == "available"


def test_gene_symbol_search_tp53(live):
    r = live.get("/api/v1/search", params={"q": "TP53", "entity_type": "gene", "page_size": 5})
    assert r.status_code == 200, r.text[:300]
    b = r.json()
    assert b["match_mode"] == "name"
    assert len(b["results"]) >= 1
    assert all(x["entity_type"] == "gene" for x in b["results"])
    assert "7157" in [x["accession"] for x in b["results"]]


def test_verified_tp53_p53_relationship(live):
    """Gene 7157 -> protein P04637, evidenced by UniProt's GeneID xref."""
    r = live.get("/api/v1/entities/gene/7157")
    assert r.status_code == 200, r.text[:300]
    links = r.json()["protein_links"]
    accs = [l["accession"] for l in links]
    assert "P04637" in accs, f"P04637 missing from protein_links: {accs}"
    p53 = [l for l in links if l["accession"] == "P04637"][0]
    assert p53["evidence"] == "uniprot_geneid_crossref"


# ---------- slice 2: filtering + mixed search, live ----------

def test_gene_filter_excludes_protein(live):
    r = live.get("/api/v1/search", params={"q": "insulin", "entity_type": "gene", "page_size": 5})
    assert r.status_code == 200, r.text[:300]
    b = r.json()
    assert all(x["entity_type"] == "gene" for x in b["results"])
    assert [p["name"] for p in b["providers"]] == ["ncbi_gene"]


def test_protein_filter_excludes_gene(live):
    r = live.get("/api/v1/search", params={"q": "insulin", "entity_type": "protein", "page_size": 5})
    assert r.status_code == 200, r.text[:300]
    b = r.json()
    assert len(b["results"]) >= 1
    assert all(x["entity_type"] == "protein" for x in b["results"])
    assert [p["name"] for p in b["providers"]] == ["uniprot"]


def test_mixed_search_returns_both_types(live):
    r = live.get("/api/v1/search", params={"q": "TP53", "page_size": 3})
    assert r.status_code == 200, r.text[:300]
    b = r.json()
    assert b["match_mode"] == "name"
    types = {x["entity_type"] for x in b["results"]}
    assert types == {"protein", "gene"}, f"expected both types, got {types}"
    assert b["provider_status"] in ("available", "partial")
    assert {p["name"] for p in b["providers"]} == {"uniprot", "ncbi_gene"}


def test_mixed_search_duplicate_prevention(live):
    b = live.get("/api/v1/search", params={"q": "TP53", "page_size": 5}).json()
    keys = [(x["entity_type"], x["accession"], x["source"]) for x in b["results"]]
    assert len(keys) == len(set(keys))


def test_geneid_filtered_out_when_protein_only(live):
    """A numeric GeneID must NOT leak a gene record into a protein-only search."""
    b = live.get("/api/v1/search", params={"q": "7157", "entity_type": "protein"}).json()
    assert b["results"] == []
    assert b["provider_status"] == "not_found"


def test_accession_filtered_out_when_gene_only(live):
    b = live.get("/api/v1/search", params={"q": "P04637", "entity_type": "gene"}).json()
    assert b["results"] == []
    assert b["provider_status"] == "not_found"


# ---------- slice 2: pagination across providers, live ----------

def test_mixed_pagination_roundtrip(live):
    r1 = live.get("/api/v1/search", params={"q": "TP53", "page_size": 2})
    assert r1.status_code == 200, r1.text[:300]
    b1 = r1.json()
    assert b1["next_cursor"], "mixed page 1 must carry a cursor"
    r2 = live.get(
        "/api/v1/search",
        params={"q": "TP53", "page_size": 2, "cursor": b1["next_cursor"]},
    )
    assert r2.status_code == 200, r2.text[:300]
    b2 = r2.json()
    assert b2["results"], "page 2 must have results"
    keys1 = {(x["entity_type"], x["accession"]) for x in b1["results"]}
    keys2 = {(x["entity_type"], x["accession"]) for x in b2["results"]}
    assert not (keys1 & keys2), f"pages overlapped: {keys1 & keys2}"


def test_invalid_geneid_422(live):
    for bad in ["abc", "0", "-1"]:
        r = live.get(f"/api/v1/entities/gene/{bad}")
        assert r.status_code == 422, bad


def test_missing_gene_404(live):
    r = live.get("/api/v1/entities/gene/999999999")
    assert r.status_code == 404
    assert r.json() == {"status": "not_found", "detail": "gene_not_found"}
