"""GET /api/v1/entities/protein/{accession} - protein profile from UniProt.

Documented accession syntax = the official UniProtKB format from
https://www.uniprot.org/help/accession_numbers:
[OPQ][0-9][A-Z0-9]{3}[0-9] | [A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}
i.e. 6 chars (e.g. P04637, A1A5B4) or 10 chars (e.g. A0A024RBG1).
Length is NOT a reviewed/unreviewed indicator. Case is normalized
deliberately (search and profile classify identically).
404 body is fixed:
{"status":"not_found","detail":"protein_not_found"}.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from ..adapters.uniprot import (
    ProviderError,
    error_response,
    is_accession,
)
from ..profiles import load_protein
from ..schemas import ProteinProfile

router = APIRouter(prefix="/api/v1", tags=["entities"])


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


def _not_found() -> dict:
    return {
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "properties": {
                        "status": {"const": "not_found"},
                        "detail": {"const": "protein_not_found"},
                    },
                }
            }
        }
    }


@router.get(
    "/entities/protein/{accession}",
    response_model=ProteinProfile,
    responses={
        "404": _not_found(),
        "429": _err({"const": "rate_limited_by_uniprot"}),
        "502": _err({"enum": ["upstream_uniprot_error", "upstream_uniprot_malformed", "upstream_uniprot_malformed_pagination"]}),
        "504": _err({"const": "upstream_uniprot_timeout"}),
    },
)
def protein_profile(accession: str):
    acc = accession.strip().upper()
    if not is_accession(acc):
        raise HTTPException(
            status_code=422,
            detail="invalid accession: expected 6 or 10 chars per the official UniProtKB syntax, e.g. P04637 or A0A024RBG1 (see /uniprot.org/help/accession_numbers)",
        )
    try:
        profile = load_protein(acc)
    except ProviderError as e:
        return error_response(e)
    if profile is None:
        return JSONResponse(status_code=404, content={"status": "not_found", "detail": "protein_not_found"})
    return profile
