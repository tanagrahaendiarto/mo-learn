"""UniProt REST adapter - the only provider in slice 1.

Documented policy:
- Host fixed to https://rest.uniprot.org. A user cursor is NEVER a URL;
  only the validated `cursor` query parameter is ever sent.
- Per-call phase timeout 20 s; 1 retry (5xx / timeout); 429 retried only
  when Retry-After <= 3 s. TOTAL_DEADLINE_S bounds the whole provider call
  (calls + retries + backoff combined): each attempt pre-checks the
  remaining budget, the in-flight request gets a per-request timeout of
  min(TIMEOUT_S, remaining), and a response that lands after the deadline
  is rejected as a timeout. HONEST LIMITATION: no in-flight cancellation
  (sync httpx); a response already on the wire is awaited up to its
  per-request timeout, never returned late. Upgrade path: async client +
  asyncio.wait_for for true bounded execution.
- Success responses must carry a valid primaryAccession; transport
  failures and unexpected 4xx are mapped to structured provider_error,
  never leaked as raw 500s or empty identities. A search page with even
  one record lacking a usable primaryAccession (empty/blank/non-string)
  is malformed source data -> 502 provider_error, distinct from a genuine
  empty result set (not_found).
- next_cursor is read ONLY from the Link header rel="next" (parameter
  order independent, per RFC 5988): no Link/next = end of results (None);
  a present-but-invalid next link = provider_error (MalformedPagination),
  never a silent end-of-results and never an invented cursor.
"""
from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

import httpx

from ..schemas import GeneXref, Organism, ProteinProfile, ProteinSummary

BASE = "https://rest.uniprot.org"
SEARCH_PATH = "/uniprotkb/search"
TIMEOUT_S = 20.0
MAX_RETRY_AFTER_S = 3.0
TOTAL_DEADLINE_S = 35.0  # total-budget cap per provider call (calls + retries + backoff)
CURSOR_RE = re.compile(r"^[A-Za-z0-9_-]{1,200}$")
# Official UniProtKB accession syntax, per
# https://www.uniprot.org/help/accession_numbers (page last modified 12 Jun 2026):
#   [OPQ][0-9][A-Z0-9]{3}[0-9]  |  [A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}
# The {1} repetition of the second alternative = 6 chars (A1A5B4, B4DMQ7);
# the {2} repetition = 10 chars (A0A024RBG1). Do NOT infer
# reviewed/unreviewed status from accession length.
ACC_RE = re.compile(r"^[OPQ][0-9][A-Z0-9]{3}[0-9]$|^[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$")
# Namespaces verified present in the real P04637 payload (see DESIGN doc).
GENE_XREF_NAMESPACES = ("GeneID", "HGNC")

_client: httpx.Client | None = None


class ProviderError(Exception):
    """Upstream UniProt failure; .code is the error detail string."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class ProviderTimeout(ProviderError):
    def __init__(self) -> None:
        super().__init__("upstream_uniprot_timeout")


class RateLimited(ProviderError):
    def __init__(self) -> None:
        super().__init__("rate_limited_by_uniprot")


class UpstreamMalformed(ProviderError):
    def __init__(self) -> None:
        super().__init__("upstream_uniprot_malformed")


class MalformedPagination(ProviderError):
    """A Link rel="next" was present but invalid - not the same as no next."""

    def __init__(self) -> None:
        super().__init__("upstream_uniprot_malformed_pagination")


class UnknownUpstream(ProviderError):
    """Unexpected upstream status (e.g. 403 on retrieve/search)."""

    def __init__(self) -> None:
        super().__init__("upstream_uniprot_error")


def get_client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(base_url=BASE, timeout=TIMEOUT_S)
    return _client


def set_client(c: httpx.Client | None) -> None:
    """Inject a client (tests) or reset to None (next get_client builds a real one)."""
    global _client
    _client = c


def is_accession(q: str) -> bool:
    """Deliberate normalization: uppercase, then match the official UniProtKB
    accession syntax from https://www.uniprot.org/help/accession_numbers
    (combined regex: [OPQ][0-9][A-Z0-9]{3}[0-9] | [A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}).
    Length 6 = the {1} repetition, length 10 = the {2} repetition of the
    second alternative; length alone says nothing about reviewed status.
    Names like INSULI (all letters) are NOT accessions. Shared by search and
    profile so they classify identically."""
    s = q.strip().upper()
    return bool(ACC_RE.fullmatch(s))


def build_name_query(q: str) -> str:
    """Documented escaping: a plain name goes into a quoted protein_name term.
    Backslashes are stripped and double quotes escaped as \". User input is
    never forwarded to UniProt as a raw expression."""
    s = q.strip()[:100].replace("\\", "").replace('"', '\\"')
    return f'protein_name:"{s}"'


def validate_cursor(cursor: str | None) -> str | None:
    """Opaque token: charset + max length. Rejects URLs, '*', and long input."""
    if not cursor:
        return None
    if not CURSOR_RE.fullmatch(cursor):
        raise ValueError("cursor_invalid")
    return cursor


# RFC 5988 Link header: parameters may appear in ANY order (e.g.
# type before rel). Parse each <target>; params block separately.
_LINK_TARGET_RE = re.compile(r"<([^>]+)>\s*((?:;[^,]+)*)")
_LINK_PARAM_RE = re.compile(r';\s*([A-Za-z0-9_-]+)\s*=\s*"([^"]*)"|;\s*([A-Za-z0-9_-]+)')


def next_cursor_from_headers(headers) -> tuple[str | None, bool]:
    """Parse the next cursor from the Link header rel="next" (NOT from items).
    Parameter order is independent (RFC 5988: rel may come before or after
    other parameters). Returns (cursor, ok):
    - no Link header, or no rel="next" relation -> (None, True)  end of results
    - rel="next" present but invalid (wrong host/path, bad charset,
      missing/bad cursor param)                 -> (None, False) provider_error
    - valid (https, host rest.uniprot.org, path
      /uniprotkb/search, cursor token in charset) -> (cursor, True)
    """
    raw = headers.get("Link") or headers.get("link")
    if not raw:
        return None, True
    for target, params in _LINK_TARGET_RE.findall(raw):
        rels: list[str] = []
        for m in _LINK_PARAM_RE.finditer(params):
            key = (m.group(1) or m.group(3)).lower()
            val = m.group(2) if m.group(1) else key
            if key == "rel" and isinstance(val, str):
                rels.extend(val.split())
        if "next" not in rels:
            continue
        p = urlparse(target)
        if p.scheme != "https" or p.netloc != "rest.uniprot.org" or p.path != SEARCH_PATH:
            return None, False
        cur = parse_qs(p.query, keep_blank_values=True).get("cursor", [None])[0]
        # URL-decoded token must fit the documented charset + length cap;
        # we deliberately do NOT rely on any undocumented token pattern.
        if cur and CURSOR_RE.fullmatch(cur):
            return cur, True
        return None, False
    return None, True  # header had links, none with rel="next": clean end


def _get(client: httpx.Client, path: str, params: dict, cursor: str | None, deadline: float) -> httpx.Response:
    """Bounded execution against `deadline` (monotonic seconds).
    Each attempt: pre-check remaining budget; run the request with a
    per-request timeout of min(TIMEOUT_S, remaining) so a slow in-flight
    response cannot silently overshoot the total deadline; after the
    response lands, reject it as ProviderTimeout if the clock crossed the
    deadline while we were waiting. Limitation (sync httpx): no in-flight
    cancellation — a response already on the wire is awaited up to its
    per-request timeout; it is then discarded as late, never returned.
    Upgrade path: async client + asyncio.wait_for(client.send)."""
    p = {"format": "json", **params}
    if cursor:
        p["cursor"] = cursor
    for attempt in range(2):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ProviderTimeout()
        try:
            resp = client.get(path, params=p, timeout=min(TIMEOUT_S, remaining))
        except httpx.TimeoutException:
            if attempt == 0 and time.monotonic() < deadline:
                time.sleep(min(1.0, max(0.0, deadline - time.monotonic())))
                continue
            raise ProviderTimeout()
        except httpx.HTTPError as e:  # ConnectError/ReadError/... -> structured 502
            raise UnknownUpstream() from e
        if time.monotonic() > deadline:
            # Response arrived after the total deadline: late, rejected.
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
            raise ProviderError("upstream_uniprot_error")
        return resp  # 2xx/3xx and non-429 4xx flow to the caller, which
        # interprets 404 (not found) vs other 4xx (unexpected upstream)
    raise ProviderError("upstream_uniprot_error")


def _valid_accession(v) -> bool:
    """A usable primaryAccession: non-empty string (no whitespace-only).
    Numeric or missing ids are NOT valid identifiers."""
    return isinstance(v, str) and bool(v.strip())


def search(client: httpx.Client, query: str, size: int, cursor: str | None, *, deadline: float | None = None):
    """Return (usable_results, next_cursor). Raises ProviderError variants.
    Malformed source data is rejected as a provider error, never masked:
    any result record whose primaryAccession is missing, non-string, or
    blank makes the whole page `UpstreamMalformed` (502) — a genuine empty
    result set (results:[]) is still a valid 'not_found' biological answer.
    Unexpected 4xx (e.g. 403) is a provider error, never a silent empty."""
    deadline = deadline if deadline is not None else time.monotonic() + TOTAL_DEADLINE_S
    resp = _get(client, SEARCH_PATH, {"query": query, "size": size}, cursor, deadline)
    if 400 <= resp.status_code < 500:
        raise UnknownUpstream()
    try:
        body = resp.json()
    except Exception:
        raise UpstreamMalformed()
    results = body.get("results") if isinstance(body, dict) else None
    if not isinstance(results, list):
        raise UpstreamMalformed()
    for r in results:
        if not (isinstance(r, dict) and _valid_accession(r.get("primaryAccession"))):
            # One record without a valid identity poisons the batch:
            # reject the whole page, don't drop it silently or fabricate "".
            raise UpstreamMalformed()
    next_cursor, ok = next_cursor_from_headers(resp.headers)
    if not ok:
        raise MalformedPagination()
    return results, next_cursor


def retrieve(client: httpx.Client, accession: str, *, deadline: float | None = None) -> dict | None:
    """Return the record dict, or None when UniProt answers 404 (not found).
    Success responses must carry a valid primaryAccession; anything else is
    malformed upstream, never an empty fabricated identity. Unexpected 4xx
    (e.g. 403 Forbidden) is a provider error."""
    deadline = deadline if deadline is not None else time.monotonic() + TOTAL_DEADLINE_S
    resp = _get(client, f"/uniprotkb/{accession}.json", {}, None, deadline)
    if resp.status_code == 404:
        return None
    if 400 <= resp.status_code < 500:
        raise UnknownUpstream()
    try:
        body = resp.json()
    except Exception:
        raise UpstreamMalformed()
    if not isinstance(body, dict) or not isinstance(body.get("primaryAccession"), str) or not body["primaryAccession"].strip():
        raise UpstreamMalformed()
    return body


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _opt_str(v) -> str | None:
    return v if isinstance(v, str) and v.strip() else None


def map_summary(rec: dict, ts: str) -> ProteinSummary:
    """Real UniProt record -> search-result summary. Missing optional fields
    never fail the whole search (they become None / empty lists). Wrong
    shapes for optional fields are tolerated (treated as absent), not fatal."""
    acc = rec.get("primaryAccession")
    acc = acc.strip() if isinstance(acc, str) else ""
    pd = rec.get("proteinDescription")
    if not isinstance(pd, dict):
        pd = {}
    alts: list[str] = []
    alts_raw = pd.get("alternativeNames")
    if isinstance(alts_raw, list):
        for a in alts_raw:
            if isinstance(a, dict):
                fn = a.get("fullName")
                v = fn.get("value") if isinstance(fn, dict) else None
                if isinstance(v, str) and v.strip():
                    alts.append(v.strip())
    primary = None
    rn = pd.get("recommendedName")
    if isinstance(rn, dict):
        fn = rn.get("fullName")
        v = fn.get("value") if isinstance(fn, dict) else None
        if isinstance(v, str) and v.strip():
            primary = v.strip()
    if primary is None and alts:
        # Documented fallback (verified UniProt shape): first alternativeName.
        # Never invent a name.
        primary = alts[0]
    org = rec.get("organism")
    if not isinstance(org, dict):
        org = {}
    taxon = org.get("taxonId")
    genes: list[str] = []
    genes_raw = rec.get("genes")
    if isinstance(genes_raw, list):
        for g in genes_raw:
            if isinstance(g, dict):
                gn = g.get("geneName")
                v = gn.get("value") if isinstance(gn, dict) else None
                if isinstance(v, str) and v.strip() and v not in genes:
                    genes.append(v)
    return ProteinSummary(
        accession=acc,
        primary_name=primary,
        synonyms=alts,
        gene_symbols=genes,
        organism=Organism(
            scientific_name=_opt_str(org.get("scientificName")),
            taxonomy_id=taxon if isinstance(taxon, int) else None,
        ),
        reviewed=str(rec.get("entryType", "")).startswith("UniProtKB reviewed"),
        source_url=f"https://www.uniprot.org/uniprotkb/{acc}",
        retrieved_at=ts,
    )


def map_profile(rec: dict, ts: str) -> ProteinProfile:
    base = map_summary(rec, ts)
    xref_raw = rec.get("uniProtKBCrossReferences")
    xrefs = [
        GeneXref(namespace=str(x["database"]), id=str(x["id"]))
        for x in (xref_raw if isinstance(xref_raw, list) else [])
        if isinstance(x, dict) and x.get("database") in GENE_XREF_NAMESPACES and "id" in x
    ]
    funcs: list[str] = []
    comments_raw = rec.get("comments")
    if isinstance(comments_raw, list):
        for c in comments_raw:
            if isinstance(c, dict) and c.get("commentType") == "FUNCTION":
                texts = c.get("texts")
                if isinstance(texts, list):
                    for t in texts:
                        v = (t or {}).get("value") if isinstance(t, dict) else None
                        if isinstance(v, str) and v.strip():
                            funcs.append(v.strip())
    seq = rec.get("sequence")
    length = seq.get("length") if isinstance(seq, dict) else None
    return ProteinProfile(
        **base.model_dump(),
        gene_crossrefs=xrefs,
        function_annotations=funcs,
        length=length if isinstance(length, int) else None,
    )


def error_response(exc: ProviderError) -> "JSONResponse":
    from fastapi.responses import JSONResponse

    if isinstance(exc, ProviderTimeout):
        return JSONResponse(status_code=504, content={"status": "provider_error", "detail": exc.code})
    if isinstance(exc, RateLimited):
        return JSONResponse(status_code=429, content={"status": "provider_error", "detail": exc.code})
    if isinstance(exc, MalformedPagination):
        return JSONResponse(status_code=502, content={"status": "provider_error", "detail": exc.code})
    # UpstreamMalformed, UnknownUpstream (incl. transport), and generic upstream errors
    return JSONResponse(status_code=502, content={"status": "provider_error", "detail": exc.code})
