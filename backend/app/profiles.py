"""Shared provider-backed profile retrieval for entity routes and learning."""
import time

from .adapters import ncbi, uniprot
from .schemas import GeneProfile, GeneXref, Organism, ProteinLink, ProteinProfile


def load_protein(accession: str) -> ProteinProfile | None:
    record = uniprot.retrieve(uniprot.get_client(), accession)
    return None if record is None else uniprot.map_profile(record, uniprot.now_iso())


def load_gene(gene_id: str) -> tuple[GeneProfile | None, str | None]:
    """Return the gene profile and the retrieval time for its optional UniProt links."""
    deadline = time.monotonic() + 35
    record = ncbi.retrieve(ncbi.get_client(), gene_id, deadline=deadline)
    if record is None:
        return None, None

    # Gene -> protein links come ONLY from UniProt's GeneID cross-reference.
    # A failure here degrades the profile (no links) rather than failing the
    # whole request: the gene record itself was fetched successfully.
    links: list[ProteinLink] = []
    links_retrieved_at = None
    try:
        raw, _ = uniprot.search(uniprot.get_client(), f"xref:geneid-{record['gene_id']}", 10, None, deadline=deadline)
        links_retrieved_at = uniprot.now_iso()
        for item in raw:
            summary = uniprot.map_summary(item, links_retrieved_at)
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
    ), links_retrieved_at
