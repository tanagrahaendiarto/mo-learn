"""LIVE tests: run the real backend against real UniProt.

Hits the LOCAL backend API (uvicorn on 127.0.0.1:8000) end-to-end, not just
direct UniProt requests. Run explicitly:
    uv run pytest -m live tests/test_api_live.py
A skip/failure here means integration is UNVERIFIED, not broken.
"""
import httpx
import pytest

pytestmark = pytest.mark.live

LIVE_BASE = "http://127.0.0.1:8000"


@pytest.fixture(scope="module")
def live():
    """Real requests to the local uvicorn server. Skip if server down."""
    try:
        r = httpx.get(LIVE_BASE + "/api/v1/health", timeout=5)
        assert r.status_code == 200, "local backend not up"
    except Exception:
        pytest.skip("local backend offline at %s - LIVE UNVERIFIED" % LIVE_BASE)
    c = httpx.Client(base_url=LIVE_BASE, timeout=30)
    try:
        yield c
    finally:
        c.close()


def test_health(live):
    assert live.get("/api/v1/health").status_code == 200


def test_search_accession(live):
    r = live.get("/api/v1/search", params={"q": "P04637", "page_size": 5})
    assert r.status_code == 200, r.text[:200]
    b = r.json()
    assert b["match_mode"] == "exact_accession"
    assert b["provider_status"] == "available"
    accs = [x["accession"] for x in b["results"]]
    assert "P04637" in accs  # ordering not guaranteed; membership is the claim


def test_search_name(live):
    r = live.get("/api/v1/search", params={"q": "p53", "page_size": 5})
    assert r.status_code == 200, r.text[:200]
    b = r.json()
    assert b["match_mode"] == "name"
    assert len(b["results"]) >= 1
    assert any(x["gene_symbols"] for x in b["results"])


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
    """Page 1 -> take next_cursor from Link header -> page 2. The cursor is
    the real UniProt token, never invented."""
    r1 = live.get("/api/v1/search", params={"q": "p53", "page_size": 2})
    assert r1.status_code == 200, r1.text[:200]
    b1 = r1.json()
    assert b1["next_cursor"], "page 1 must carry a next_cursor"
    r2 = live.get(
        "/api/v1/search",
        params={"q": "p53", "page_size": 2, "cursor": b1["next_cursor"]},
    )
    assert r2.status_code == 200, r2.text[:200]
    b2 = r2.json()
    assert len(b2["results"]) >= 1
    # no overlap between the two pages (order-insensitive)
    accs1 = {x["accession"] for x in b1["results"]}
    accs2 = {x["accession"] for x in b2["results"]}
    assert not (accs1 & accs2), f"pages overlapped: {accs1 & accs2}"
