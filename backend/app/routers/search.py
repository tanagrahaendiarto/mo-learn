"""GET /api/v1/search - protein (UniProtKB) + gene (NCBI Gene) search.

Slice 2 contract (agreed with frontend):
- `entity_type` = all | gene | protein (default all). A filter is never
  silently widened: asking for `gene` never returns proteins.
- Exact identifier routing takes priority over name search:
    * valid UniProtKB accession -> exact UniProt lookup (protein)
    * positive numeric query    -> exact NCBI GeneID lookup (gene)
- `TP53` / `insulin` -> name search across the permitted providers.
- Mixed search reports per-provider status. One provider failing yields
  HTTP 200 with `provider_status="partial"` (results from the healthy
  provider) - never conflated with a genuine empty result set
  (`not_found`) and never turned into a silent success.
- Cursor is opaque to the frontend and carries each provider's own page
  state. The frontend MUST drop the cursor when q, entity_type or
  page_size changes; the backend does not reset it silently.

Documented limitation: NCBI *name* search is restricted to human genes
(taxid 9606) because every slice 2 demo case is human and an organism
filter UI does not exist yet. Exact GeneID lookup is not restricted.

Deadline limitation is unchanged from slice 1: a soft total budget plus
per-request phase timeouts, not hard in-flight cancellation.
"""
import base64
import json
import re
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from ..adapters import ncbi, uniprot
from ..adapters.ncbi import ProviderError as NcbiError
from ..adapters.uniprot import ProviderError as UniError
from ..schemas import GeneSummary, Organism, ProviderStatus, SearchResponse
from .genes import ncbi_error_response

router = APIRouter(prefix="/api/v1", tags=["search"])

_GENEID_RE = re.compile(r"^[0-9]{1,12}$")
_NCBI_TAXID_HUMAN = 9606


def _bad_request(detail: str) -> JSONResponse:
    return JSONResponse(status_code=400, content={"status": "bad_request", "detail": detail})


def _err(detail_schema: dict) -> dict:
    """Documented provider_error body for OpenAPI responses."""
    return {
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "properties": {
                        "status": {"const": "provider_error"},
                        "detail": detail_schema,
                    },
                }
            }
        }
    }


def _bad_request_schema() -> dict:
    return {
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "properties": {
                        "status": {"const": "bad_request"},
                        "detail": {"enum": ["cursor_invalid", "query_too_long"]},
                    },
                }
            }
        }
    }


# ---------- opaque cursor (independent per-provider page state) ----------

def encode_cursor(uniprot_token: str | None, ncbi_offset: int, gene_done: bool = False) -> str | None:
    """Opaque per-provider page state.

    gene_done marks the NCBI offset provider as EXHAUSTED so a later page
    cannot restart it at offset 0 and repeat records.
    """
    if not uniprot_token and not ncbi_offset and not gene_done:
        return None
    payload = {"u": uniprot_token, "n": ncbi_offset, "g": gene_done}
    raw = json.dumps(payload, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str | None) -> tuple[str | None, int, bool]:
    """Return (uniprot_token, ncbi_offset, gene_done).

    Raises ValueError('cursor_invalid').
    """
    if not cursor:
        return None, 0, False
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,400}", cursor):
        raise ValueError("cursor_invalid")
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded))
        if not isinstance(data, dict) or not {"u", "n"} <= set(data):
            raise ValueError
        u = data["u"]
        n = data["n"]
        g = data.get("g", False)
    except Exception:
        raise ValueError("cursor_invalid")
    if u is not None and not isinstance(u, str):
        raise ValueError("cursor_invalid")
    if not isinstance(n, int) or isinstance(n, bool) or n < 0:
        raise ValueError("cursor_invalid")
    if not isinstance(g, bool):
        raise ValueError("cursor_invalid")
    if u is not None and not uniprot.CURSOR_RE.fullmatch(u):
        raise ValueError("cursor_invalid")
    return u, n, g


def _map_gene(rec: dict, ts: str) -> GeneSummary:
    sym = rec.get("official_symbol")
    return GeneSummary(
        accession=rec["gene_id"],
        primary_name=sym,
        synonyms=list(rec.get("synonyms") or []),
        gene_symbols=[sym] if sym else [],
        organism=Organism(
            scientific_name=rec.get("organism"),
            taxonomy_id=rec.get("taxonomy_id"),
        ),
        source="ncbi_gene",
        source_url=rec["source_url"],
        retrieved_at=ts,
    )


def build_gene_term(q: str, taxid: int = _NCBI_TAXID_HUMAN) -> str:
    """Build the NLM esearch term for a gene NAME query.

    User input is data, never query syntax. NCBI's term language uses
    brackets for field qualifiers (`[Gene Name]`, `[TaxID]`), quotes for
    phrases, and AND/OR/NOT for logic. If `q` were pasted in verbatim a
    caller could widen the organism filter (verified live:
    `TP53[Gene Name] AND 10090[TaxID]` returns mouse GeneID 22059) or break
    out of the field constraint. So the user part is reduced to a plain
    word sequence: brackets, quotes and backslashes are stripped, then the
    backend applies exactly one `[Gene Name]` and one `[TaxID]` qualifier.

    This mirrors the escaping policy of the UniProt adapter, which never
    forwards user input as a raw expression either.
    """
    plain = re.sub(r"[\[\]\"\\]", " ", q)
    plain = " ".join(plain.split())[:100]
    if not plain:
        raise ValueError("query_invalid")
    return f"{plain}[Gene Name] AND {taxid}[TaxID]"


@router.get(
    "/search",
    response_model=SearchResponse,
    responses={
        "400": _bad_request_schema(),
        "429": _err({"enum": ["rate_limited_by_uniprot", "rate_limited_by_ncbi"]}),
        "502": _err({"enum": [
            "upstream_uniprot_error",
            "upstream_uniprot_malformed",
            "upstream_uniprot_malformed_pagination",
            "upstream_ncbi_error",
            "upstream_ncbi_malformed",
        ]}),
        "504": _err({"enum": ["upstream_uniprot_timeout", "upstream_ncbi_timeout"]}),
    },
)
def search_proteins(
    q: str = Query(
        ...,
        description=(
            "UniProtKB accession (e.g. P04637), positive numeric NCBI GeneID "
            "(e.g. 7157), or a plain gene/protein name (e.g. TP53, insulin)."
        ),
    ),
    entity_type: Literal["all", "gene", "protein"] = Query(
        "all",
        description=(
            "Record type filter. 'all' searches both providers. A filter is "
            "never widened: 'gene' cannot return proteins and vice versa."
        ),
    ),
    cursor: str | None = Query(
        None,
        description=(
            "Opaque next_cursor from a previous response. Valid only with the "
            "same q, entity_type and page_size; the frontend MUST drop it when "
            "any of those changes. Sent upstream only as validated query "
            "parameters, never as a URL."
        ),
    ),
    page_size: int = Query(10, ge=1, le=100),
):
    q = q.strip()
    if not q:
        raise HTTPException(status_code=422, detail="q must not be empty or whitespace")
    if len(q) > 100:
        return _bad_request("query_too_long")
    try:
        up_cursor, ncbi_offset, gene_done = decode_cursor(cursor)
    except ValueError:
        return _bad_request("cursor_invalid")

    want_protein = entity_type in ("all", "protein")
    want_gene = entity_type in ("all", "gene")
    is_acc = uniprot.is_accession(q)
    is_geneid = bool(_GENEID_RE.fullmatch(q)) and int(q) > 0
    ts = uniprot.now_iso()

    # ---------- exact identifier routing (single provider) ----------
    if is_acc and want_protein:
        try:
            raw, up_next = uniprot.search(
                uniprot.get_client(), f"accession:{q}", page_size, up_cursor
            )
        except UniError as e:
            return uniprot.error_response(e)
        results = [uniprot.map_summary(r, ts) for r in raw]
        return SearchResponse(
            query=q,
            match_mode="exact_accession",
            results=results,
            next_cursor=encode_cursor(up_next, 0),
            provider_status="available" if results else "not_found",
            providers=[ProviderStatus(
                name="uniprot",
                status="available" if results else "not_found",
                count=len(results),
            )],
        )

    if is_geneid and want_gene:
        try:
            rec = ncbi.retrieve(ncbi.get_client(), q)
        except NcbiError as e:
            return ncbi_error_response(e)
        results = [_map_gene(rec, ts)] if rec is not None else []
        return SearchResponse(
            query=q,
            match_mode="exact_geneid",
            results=results,
            next_cursor=None,
            provider_status="available" if results else "not_found",
            providers=[ProviderStatus(
                name="ncbi_gene",
                status="available" if results else "not_found",
                count=len(results),
            )],
        )

    # A query that IS an identifier never degrades into a name search.
    # Filtering it out by entity_type yields a genuine empty result.
    if is_acc and not want_protein:
        return SearchResponse(
            query=q,
            match_mode="exact_accession",
            results=[],
            next_cursor=None,
            provider_status="not_found",
            providers=[ProviderStatus(name="uniprot", status="not_found")],
        )
    if is_geneid and not want_gene:
        return SearchResponse(
            query=q,
            match_mode="exact_geneid",
            results=[],
            next_cursor=None,
            provider_status="not_found",
            providers=[ProviderStatus(name="ncbi_gene", status="not_found")],
        )

    # ---------- name search across the permitted providers ----------
    results: list = []
    statuses: list[ProviderStatus] = []
    errors: list[ProviderStatus] = []
    up_next: str | None = None
    gene_more = False

    if want_protein:
        try:
            raw, up_next = uniprot.search(
                uniprot.get_client(), uniprot.build_name_query(q), page_size, up_cursor
            )
            mapped = [uniprot.map_summary(r, ts) for r in raw]
            results.extend(mapped)
            statuses.append(ProviderStatus(
                name="uniprot",
                status="available" if mapped else "not_found",
                count=len(mapped),
            ))
        except UniError as e:
            errors.append(ProviderStatus(name="uniprot", status="error", detail=e.code))

    if want_gene and not gene_done:
        try:
            term = build_gene_term(q)
            ids = ncbi.esearch(ncbi.get_client(), term, retmax=page_size + ncbi_offset + 1)
            page_ids = ids[ncbi_offset:][:page_size]
            recs = ncbi.efetch_batch(ncbi.get_client(), page_ids) if page_ids else {}
            gres = [_map_gene(recs[gid], ts) for gid in page_ids if gid in recs]
            results.extend(gres)
            statuses.append(ProviderStatus(
                name="ncbi_gene",
                status="available" if gres else "not_found",
                count=len(gres),
            ))
            # Exhausted when the page came back short: no further gene pages.
            gene_done = len(page_ids) < page_size
        except NcbiError as e:
            errors.append(ProviderStatus(name="ncbi_gene", status="error", detail=e.code))
    elif want_gene:
        # Already exhausted on an earlier page: report it without re-querying.
        statuses.append(ProviderStatus(name="ncbi_gene", status="not_found", count=0))

    statuses.extend(errors)

    # Both permitted providers failed -> provider error, never an empty page.
    if errors and len(errors) == int(want_protein) + int(want_gene):
        first = errors[0].detail or "upstream_ncbi_error"
        code = 504 if first.endswith("_timeout") else 429 if first.startswith("rate_limited") else 502
        return JSONResponse(status_code=code, content={"status": "provider_error", "detail": first})

    # Duplicate prevention: one row per (entity_type, accession, source).
    seen: set[tuple[str, str, str]] = set()
    deduped: list = []
    for r in results:
        key = (r.entity_type, r.accession, r.source)
        if key not in seen:
            seen.add(key)
            deduped.append(r)

    # Deterministic ordering: interleaved, protein first at equal rank.
    proteins = [r for r in deduped if r.entity_type == "protein"]
    genes = [r for r in deduped if r.entity_type == "gene"]
    ordered: list = []
    for i in range(max(len(proteins), len(genes))):
        if i < len(proteins):
            ordered.append(proteins[i])
        if i < len(genes):
            ordered.append(genes[i])

    next_cursor = encode_cursor(
        up_next,
        ncbi_offset + page_size if (want_gene and not gene_done) else 0,
        gene_done,
    )
    provider_status = "partial" if errors else ("available" if ordered else "not_found")
    return SearchResponse(
        query=q,
        match_mode="name",
        results=ordered,
        next_cursor=next_cursor,
        provider_status=provider_status,
        providers=statuses,
    )
