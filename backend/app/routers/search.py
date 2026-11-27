"""GET /api/v1/search - UniProt protein search (single provider).

Cursor contract (review correction round 1):
- Page 1 sends no cursor.
- next_cursor comes from the UniProt Link header rel="next", not from items.
- Cursor is opaque: validated, sent only as a query parameter, never a URL.
- next_cursor=null only when a successful response provides no next link.
  Provider failure is an error, never next_cursor=null.
- Cursor binding: the backend does NOT auto-detect a stale cursor. When
  q or page_size changes, the FRONTEND must drop the cursor (restart at
  page 1); a forwarded stale cursor is passed to UniProt as-is and may be
  rejected upstream. Documented, not silently corrected.
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from ..adapters.uniprot import (
    ProviderError,
    build_name_query,
    error_response,
    get_client,
    is_accession,
    map_summary,
    now_iso,
    search,
    validate_cursor,
)
from ..schemas import SearchResponse

router = APIRouter(prefix="/api/v1", tags=["search"])


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


@router.get(
    "/search",
    response_model=SearchResponse,
    responses={
        "400": _bad_request_schema(),
        "429": _err({"const": "rate_limited_by_uniprot"}),
        "502": _err({"enum": ["upstream_uniprot_error", "upstream_uniprot_malformed", "upstream_uniprot_malformed_pagination"]}),
        "504": _err({"const": "upstream_uniprot_timeout"}),
    },
)
def search_proteins(
    q: str = Query(
        ...,
        description="UniProt accession (e.g. P04637, A0A024RBG1 - matched case-insensitively when it fits the documented accession pattern) or plain protein name (e.g. p53).",
    ),
    cursor: str | None = Query(
        None,
        description="Opaque next_cursor token from a previous response. Valid only together with the same q and page_size; when q or page_size change, the frontend must NOT send the old cursor (pagination restarts). Sent to UniProt only as a query parameter, never as a URL.",
    ),
    page_size: int = Query(10, ge=1, le=100),
):
    q = q.strip()
    if not q:
        raise HTTPException(status_code=422, detail="q must not be empty or whitespace")
    if len(q) > 100:
        return _bad_request("query_too_long")
    try:
        validate_cursor(cursor)
    except ValueError:
        return _bad_request("cursor_invalid")

    exact = is_accession(q)
    match_mode = "exact_accession" if exact else "name"
    # An accession that finds nothing stays not_found; it is NEVER silently
    # downgraded to a name search.
    uni_query = f"accession:{q}" if exact else build_name_query(q)

    try:
        raw, next_cursor = search(get_client(), uni_query, page_size, cursor)
    except ProviderError as e:
        return error_response(e)

    ts = now_iso()
    results = [map_summary(r, ts) for r in raw]  # adapter guarantees dict records with valid accessions
    return SearchResponse(
        query=q,
        match_mode=match_mode,
        results=results,
        next_cursor=next_cursor,
        provider_status="available" if results else "not_found",
    )
