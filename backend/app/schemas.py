"""Pydantic models = stable API contract for the frontend."""
from pydantic import BaseModel


class Organism(BaseModel):
    scientific_name: str | None = None
    taxonomy_id: int | None = None


class GeneXref(BaseModel):
    namespace: str
    id: str


class ProteinSummary(BaseModel):
    entity_type: str = "protein"
    accession: str
    primary_name: str | None = None
    synonyms: list[str] = []
    gene_symbols: list[str] = []
    organism: Organism
    reviewed: bool
    source: str = "uniprot"
    source_url: str
    retrieved_at: str
    status: str = "available"


class ProteinProfile(ProteinSummary):
    gene_crossrefs: list[GeneXref] = []
    length: int | None = None
    function_annotations: list[str] = []


class SearchResponse(BaseModel):
    query: str
    match_mode: str  # "exact_accession" | "name"
    results: list[ProteinSummary]
    next_cursor: str | None
    provider_status: str  # "available" | "not_found"
