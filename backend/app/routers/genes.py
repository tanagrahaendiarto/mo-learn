"""GET /api/v1/entities/gene/{gene_id} - NCBI Gene profile (slice 2).

gene_id is a positive numeric NCBI GeneID (e.g. 7157 = human TP53).
Missing upstream fields stay null / empty; nothing is inferred.

404 body is fixed:
{"status":"not_found","detail":"gene_not_found"}.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from ..adapters import ncbi, uniprot
from ..adapters.ncbi import (
    ProviderError,
    RateLimited,
    UnknownUpstream,
    UpstreamMalformed,
    ProviderTimeout,
    get_client,
    retrieve,
)
from ..schemas import GeneProfile, GeneXref, Organism, ProteinLink

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
    if not gid.isdigit() or int(gid) <= 0:
        raise HTTPException(
            status_code=422,
            detail="invalid gene_id: expected a positive numeric NCBI GeneID, e.g. 7157",
        )
    try:
        record = retrieve(get_client(), gid)
    except ProviderError as e:
        return ncbi_error_response(e)
    if record is None:
        return JSONResponse(status_code=404, content={"status": "not_found", "detail": "gene_not_found"})

    # Gene -> protein links come ONLY from UniProt's GeneID cross-reference.
    # A failure here degrades the profile (no links) rather than failing the
    # whole request: the gene record itself was fetched successfully.
    links: list[ProteinLink] = []
    try:
        raw, _ = uniprot.search(
            uniprot.get_client(), f"xref:geneid-{gid}", 10, None
        )
        for rec in raw:
            summary = uniprot.map_summary(rec, uniprot.now_iso())
            links.append(
                ProteinLink(
                    accession=summary.accession,
                    primary_name=summary.primary_name,
                    gene_symbols=summary.gene_symbols,
                    reviewed=summary.reviewed,
                    source_url=summary.source_url,
                )
            )
    except uniprot.ProviderError:
        links = []

    return GeneProfile(
        accession=record["gene_id"],
        primary_name=record["official_symbol"],
        synonyms=record["synonyms"],
        gene_symbols=[record["official_symbol"]] if record["official_symbol"] else [],
        organism=Organism(
            scientific_name=record["organism"],
            taxonomy_id=record["taxonomy_id"],
        ),
        source="ncbi_gene",
        source_url=record["source_url"],
        retrieved_at=record["retrieved_at"],
        description=record["description"],
        chromosome=record["chromosome"],
        gene_type=record["gene_type"],
        cross_references=[GeneXref(namespace=x["namespace"], id=x["id"]) for x in record["cross_references"]],
        related_proteins=record["related_proteins"],
        protein_links=links,
    )
