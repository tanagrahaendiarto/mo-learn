"""Pydantic models = stable API contract for the frontend."""
from pydantic import BaseModel


class Organism(BaseModel):
    scientific_name: str | None = None
    taxonomy_id: int | None = None


class GeneXref(BaseModel):
    namespace: str
    id: str


class ProteinLink(BaseModel):
    """A gene->protein link evidenced by the PROVIDER's cross-reference.

    Evidence rule: the link exists only because UniProtKB publishes a
    GeneID cross-reference equal to this gene's ID (queried as
    `xref:geneid-<id>`). A matching gene symbol is NOT evidence and is
    never used to create a link.
    """
    accession: str
    primary_name: str | None = None
    gene_symbols: list[str] = []
    reviewed: bool | None = None
    source: str = "uniprot"
    source_url: str
    evidence: str = "uniprot_geneid_crossref"


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


class GeneSummary(BaseModel):
    """Search-result summary for an NCBI Gene record (slice 2)."""
    entity_type: str = "gene"
    accession: str  # NCBI GeneID, e.g. "7157"
    primary_name: str | None = None  # official symbol
    synonyms: list[str] = []
    gene_symbols: list[str] = []
    organism: Organism
    source: str = "ncbi_gene"
    source_url: str
    retrieved_at: str
    status: str = "available"


class GeneProfile(GeneSummary):
    description: str | None = None
    chromosome: str | None = None
    gene_type: str | None = None
    cross_references: list[GeneXref] = []
    related_proteins: list[str] = []
    # Verified gene->protein links, sourced ONLY from UniProt's own
    # GeneID cross-reference (xref:geneid-<id>). Empty when the source
    # provides nothing; never inferred from a matching gene symbol.
    protein_links: list[ProteinLink] = []


class ProteinProfile(ProteinSummary):
    gene_crossrefs: list[GeneXref] = []
    length: int | None = None
    function_annotations: list[str] = []


class ProviderStatus(BaseModel):
    """Per-provider outcome for a mixed search (slice 2).

    Lets the frontend tell "provider returned no matches" apart from
    "provider failed" without conflating either with an empty result set.
    """
    name: str      # "uniprot" | "ncbi_gene"
    status: str    # "available" | "not_found" | "error"
    detail: str | None = None  # error code when status == "error"
    count: int = 0             # results contributed by this provider


class SearchResponse(BaseModel):
    query: str
    # "exact_accession" | "exact_geneid" | "name"
    match_mode: str
    results: list[ProteinSummary | GeneSummary] = []
    next_cursor: str | None = None
    # "available" | "not_found" | "partial" | "error"
    provider_status: str
    providers: list[ProviderStatus] = []
