"""NCBI E-utilities adapter — second provider in slice 2.

Documented policy:
- Base URL: https://eutils.ncbi.nlm.nih.gov/entrez/eutils
- Rate limit: 3 req/s without API key (token bucket, 330 ms spacing).
- Per-request timeout 20 s; TOTAL_DEADLINE_S bounds the whole call.
- 1 retry on 5xx/timeout; 429 retried only when Retry-After <= 3 s.
- Responses are XML; missing fields become None, never fabricated.
- GeneID is a positive integer string. Search by symbol/name/alias via
  esearch -> efetch. Exact lookup by GeneID via efetch directly.
- Cross-references parsed from Gene-ref_db (Dbtag). Related proteins
  from Entrezgene_prot / Prot-ref_name-E (names only, not accessions).
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
import xml.etree.ElementTree as ET

BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
ESEARCH_PATH = "/entrez/eutils/esearch.fcgi"
EFETCH_PATH = "/entrez/eutils/efetch.fcgi"
TIMEOUT_S = 20.0
MAX_RETRY_AFTER_S = 3.0
TOTAL_DEADLINE_S = 35.0
# Rate-limit spacing: 3 req/s => 330 ms between requests
_RATE_SPACING_S = 0.34

_client: httpx.Client | None = None
_last_request_ts: float = 0.0


class ProviderError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class ProviderTimeout(ProviderError):
    def __init__(self):
        super().__init__("upstream_ncbi_timeout")


class RateLimited(ProviderError):
    def __init__(self):
        super().__init__("rate_limited_by_ncbi")


class UpstreamMalformed(ProviderError):
    def __init__(self):
        super().__init__("upstream_ncbi_malformed")


class UnknownUpstream(ProviderError):
    def __init__(self):
        super().__init__("upstream_ncbi_error")


def get_client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(base_url=BASE, timeout=TIMEOUT_S)
    return _client


def set_client(c: httpx.Client | None) -> None:
    global _client
    _client = c


def _wait_rate_limit() -> None:
    global _last_request_ts
    now = time.monotonic()
    wait = _last_request_ts + _RATE_SPACING_S - now
    if wait > 0:
        time.sleep(wait)
    _last_request_ts = time.monotonic()


def _efetch_gene_xml(client: httpx.Client, gene_id: str) -> ET.Element:
    """Fetch one gene record, return the Entrezgene element."""
    deadline = time.monotonic() + TOTAL_DEADLINE_S
    for attempt in range(2):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ProviderTimeout()
        _wait_rate_limit()
        try:
            resp = client.get(
                EFETCH_PATH,
                params={"db": "gene", "id": gene_id, "retmode": "xml"},
                timeout=min(TIMEOUT_S, remaining),
            )
        except httpx.TimeoutException:
            if attempt == 0 and time.monotonic() < deadline:
                time.sleep(min(1.0, max(0.0, deadline - time.monotonic())))
                continue
            raise ProviderTimeout()
        except httpx.HTTPError as e:
            raise UnknownUpstream() from e
        if time.monotonic() > deadline:
            raise ProviderTimeout()
        if resp.status_code == 429:
            ra = resp.headers.get("Retry-After")
            if attempt == 0 and ra is not None:
                try:
                    if 0 <= float(ra) <= MAX_RETRY_AFTER_S:
                        time.sleep(float(ra))
                        continue
                except ValueError:
                    pass
            raise RateLimited()
        if resp.status_code >= 500:
            if attempt == 0:
                time.sleep(1)
                continue
            raise ProviderError("upstream_ncbi_error")
        try:
            root = ET.fromstring(resp.text)
        except ET.ParseError as e:
            raise UpstreamMalformed() from e
        return root
    raise ProviderError("upstream_ncbi_error")


def _first_text(parent: ET.Element | None, path: str) -> str | None:
    if parent is None:
        return None
    el = parent.find(path)
    return el.text.strip() if el is not None and el.text and el.text.strip() else None


def _gene_from_xml(eg: ET.Element, gene_id: str) -> dict:
    """Parse Entrezgene element into a gene dict."""
    track = eg.find("Entrezgene_track-info")
    gene_el = eg.find("Entrezgene_gene")
    gr = gene_el.find("Gene-ref") if gene_el is not None else None

    # official symbol = locus
    locus = _first_text(gr, "Gene-ref_locus")
    # description
    desc = _first_text(gr, "Gene-ref_desc")
    # map location
    maploc = _first_text(gr, "Gene-ref_maploc")
    # gene type
    gtype_el = eg.find("Entrezgene_type")
    gene_type = gtype_el.get("value") if gtype_el is not None and gtype_el.get("value") else None

    # synonyms
    syn_el = gr.find("Gene-ref_syn") if gr is not None else None
    synonyms: list[str] = []
    if syn_el is not None:
        for s in syn_el.findall("Gene-ref_syn_E"):
            if s.text and s.text.strip():
                synonyms.append(s.text.strip())

    # organism
    src = eg.find("Entrezgene_source")
    org_name = None
    tax_id = None
    if src is not None:
        org_ref = src.find(".//Org-ref")
        if org_ref is not None:
            org_name = _first_text(org_ref, "Org-ref_taxname")
            # taxid lives in Org-ref_db/Dbtag where Dbtag_db == "taxon"
            for dbtag in org_ref.iter("Dbtag"):
                if _first_text(dbtag, "Dbtag_db") == "taxon":
                    tax_raw = _first_text(dbtag, ".//Object-id_id")
                    if tax_raw and tax_raw.isdigit():
                        tax_id = int(tax_raw)
                    break

    # summary
    summary = _first_text(eg, "Entrezgene_summary")

    # cross-references from Gene-ref_db (HGNC, Ensembl, MIM, ...)
    xrefs: list[dict] = []
    if gr is not None:
        db_el = gr.find("Gene-ref_db")
        if db_el is not None:
            for dbtag in db_el.findall("Dbtag"):
                db = _first_text(dbtag, "Dbtag_db")
                val = _first_text(dbtag, ".//Object-id_str") or _first_text(dbtag, ".//Object-id_id")
                if db and val:
                    xrefs.append({"namespace": db, "id": val})

    # related protein names from Entrezgene_prot / Prot-ref_name_E
    related_proteins: list[str] = []
    prot = eg.find("Entrezgene_prot")
    if prot is not None:
        for name_el in prot.findall(".//Prot-ref_name_E"):
            if name_el.text and name_el.text.strip():
                related_proteins.append(name_el.text.strip())

    # chromosome/location from Maps
    location = None
    maps = eg.find(".//Maps")
    if maps is not None:
        ds = maps.find("Maps_display-str")
        if ds is not None and ds.text:
            location = ds.text.strip()

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "gene_id": gene_id,
        "official_symbol": locus,
        "official_name": desc,
        "synonyms": synonyms,
        "description": summary,
        "organism": org_name,
        "taxonomy_id": tax_id,
        "chromosome": location,
        "gene_type": gene_type,
        "cross_references": xrefs,
        "related_proteins": related_proteins,
        "source": "ncbi_gene",
        "source_url": f"https://www.ncbi.nlm.nih.gov/gene/{gene_id}",
        "retrieved_at": now,
    }


def retrieve(client: httpx.Client, gene_id: str) -> dict | None:
    """Return gene record dict, or None when NCBI answers 404."""
    if not gene_id.isdigit() or int(gene_id) <= 0:
        raise ValueError("invalid_gene_id")
    root = _efetch_gene_xml(client, gene_id)
    # Check if gene was found
    egs = root.find("Entrezgene-Set")
    if egs is not None:
        eg = egs.find("Entrezgene")
    else:
        eg = root.find("Entrezgene")
    if eg is None:
        return None
    track = eg.find("Entrezgene_track-info")
    if track is not None:
        status_el = track.find("Gene-track_status")
        if status_el is not None and status_el.get("value") == "discontinued":
            return None
    return _gene_from_xml(eg, gene_id)


def esearch(client: httpx.Client, term: str, retmax: int = 10) -> list[str]:
    """Search NCBI Gene, return list of GeneIDs."""
    deadline = time.monotonic() + TOTAL_DEADLINE_S
    for attempt in range(2):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ProviderTimeout()
        _wait_rate_limit()
        try:
            resp = client.get(
                ESEARCH_PATH,
                params={"db": "gene", "term": term, "retmode": "json", "retmax": str(retmax)},
                timeout=min(TIMEOUT_S, remaining),
            )
        except httpx.TimeoutException:
            if attempt == 0 and time.monotonic() < deadline:
                time.sleep(min(1.0, max(0.0, deadline - time.monotonic())))
                continue
            raise ProviderTimeout()
        except httpx.HTTPError as e:
            raise UnknownUpstream() from e
        if time.monotonic() > deadline:
            raise ProviderTimeout()
        if resp.status_code == 429:
            ra = resp.headers.get("Retry-After")
            if attempt == 0 and ra is not None:
                try:
                    if 0 <= float(ra) <= MAX_RETRY_AFTER_S:
                        time.sleep(float(ra))
                        continue
                except ValueError:
                    pass
            raise RateLimited()
        if resp.status_code >= 500:
            if attempt == 0:
                time.sleep(1)
                continue
            raise ProviderError("upstream_ncbi_error")
        data = resp.json()
        return data.get("esearchresult", {}).get("idlist", [])
    raise ProviderError("upstream_ncbi_error")


def efetch_batch(client: httpx.Client, gene_ids: list[str]) -> dict[str, dict]:
    """Fetch multiple genes, return dict gene_id -> record dict."""
    if not gene_ids:
        return {}
    deadline = time.monotonic() + TOTAL_DEADLINE_S
    for attempt in range(2):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ProviderTimeout()
        _wait_rate_limit()
        try:
            resp = client.get(
                EFETCH_PATH,
                params={"db": "gene", "id": ",".join(gene_ids), "retmode": "xml"},
                timeout=min(TIMEOUT_S, remaining),
            )
        except httpx.TimeoutException:
            if attempt == 0 and time.monotonic() < deadline:
                time.sleep(min(1.0, max(0.0, deadline - time.monotonic())))
                continue
            raise ProviderTimeout()
        except httpx.HTTPError as e:
            raise UnknownUpstream() from e
        if time.monotonic() > deadline:
            raise ProviderTimeout()
        if resp.status_code == 429:
            ra = resp.headers.get("Retry-After")
            if attempt == 0 and ra is not None:
                try:
                    if 0 <= float(ra) <= MAX_RETRY_AFTER_S:
                        time.sleep(float(ra))
                        continue
                except ValueError:
                    pass
            raise RateLimited()
        if resp.status_code >= 500:
            if attempt == 0:
                time.sleep(1)
                continue
            raise ProviderError("upstream_ncbi_error")
        try:
            root = ET.fromstring(resp.text)
        except ET.ParseError as e:
            raise UpstreamMalformed() from e
        results: dict[str, dict] = {}
        egs = root.find("Entrezgene-Set")
        # A single-gene efetch returns Entrezgene directly under the root.
        candidates = egs.findall("Entrezgene") if egs is not None else root.findall("Entrezgene")
        for eg in candidates:
            gid_el = eg.find(".//Gene-track_geneid")
            if gid_el is not None and gid_el.text:
                results[gid_el.text] = _gene_from_xml(eg, gid_el.text)
        return results
    raise ProviderError("upstream_ncbi_error")


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
