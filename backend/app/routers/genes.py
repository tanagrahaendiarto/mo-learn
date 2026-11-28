"""GET /api/v1/entities/gene/{gene_id} - NCBI Gene profile (slice 2).

gene_id is a positive numeric NCBI GeneID (e.g. 7157 = human TP53).
Missing upstream fields stay null / empty; nothing is inferred.

404 body is fixed:
{"status":"not_found","detail":"gene_not_found"}.
"""
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from ..adapters.ncbi import (
    ProviderError,
    RateLimited,
    ProviderTimeout,
)
from ..profiles import load_gene
from ..schemas import GeneProfile

router = APIRouter(prefix="/api/v1", tags=["entities"])


def _err(detail_schema: dict) -> dict:
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


def _not_found() -> dict:
    return {
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "properties": {
                        "status": {"const": "not_found"},
                        "detail": {"const": "gene_not_found"},
                    },
                }
            }
        }
    }


def ncbi_error_response(exc: ProviderError) -> JSONResponse:
    """Map an NCBI adapter error to the documented HTTP contract."""
    if isinstance(exc, ProviderTimeout):
        return JSONResponse(status_code=504, content={"status": "provider_error", "detail": exc.code})
    if isinstance(exc, RateLimited):
        return JSONResponse(status_code=429, content={"status": "provider_error", "detail": exc.code})
    return JSONResponse(status_code=502, content={"status": "provider_error", "detail": exc.code})


@router.get(
    "/entities/gene/{gene_id}",
    response_model=GeneProfile,
    responses={
        "404": _not_found(),
        "422": {"description": "gene_id is not a positive integer"},
        "429": _err({"const": "rate_limited_by_ncbi"}),
        "502": _err({"enum": ["upstream_ncbi_error", "upstream_ncbi_malformed"]}),
        "504": _err({"const": "upstream_ncbi_timeout"}),
    },
)
def gene_profile(gene_id: str):
    gid = gene_id.strip()
    if not re.fullmatch(r"[0-9]{1,12}", gid) or int(gid) == 0:
        raise HTTPException(
            status_code=422,
            detail="invalid gene_id: expected a positive numeric NCBI GeneID, e.g. 7157",
        )
    try:
        profile, _ = load_gene(str(int(gid)))
    except ProviderError as e:
        return ncbi_error_response(e)
    if profile is None:
        return JSONResponse(status_code=404, content={"status": "not_found", "detail": "gene_not_found"})
    return profile
