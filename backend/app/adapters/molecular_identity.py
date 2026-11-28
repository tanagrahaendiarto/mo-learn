"""Resolve a canonical UniProt record for protein-centric exploration."""
from ..exploration import Identity
from . import refseq, uniprot
from .scientific_http import SourceError


def crossrefs(raw: dict, database: str) -> list[dict]:
    refs = raw.get("uniProtKBCrossReferences", [])
    if not isinstance(refs, list) or any(not isinstance(ref, dict) for ref in refs):
        raise uniprot.UpstreamMalformed()
    return [ref for ref in refs if ref.get("database") == database]


def protein_identity(accession: str, raw: dict) -> Identity:
    primary = raw["primaryAccession"]
    secondary = raw.get("secondaryAccessions")
    if not uniprot.is_accession(primary) or (
        primary != accession and not (isinstance(secondary, list) and accession in secondary)
    ):
        raise uniprot.UpstreamMalformed()
    profile = uniprot.map_summary(raw, uniprot.now_iso())
    return Identity(entity_type="protein", accession=primary, name=profile.primary_name,
                    organism=profile.organism.scientific_name, taxonomy_id=profile.organism.taxonomy_id)


def resolve_protein(entity_type, accession: str, deadline: float) -> tuple[Identity, Identity | None, dict | None] | None:
    if entity_type == "protein":
        raw = uniprot.retrieve(uniprot.get_client(), accession, deadline=deadline)
        if raw is None:
            return None
        identity = protein_identity(accession, raw)
        return identity, identity, raw

    gene = refseq.report(accession, "gene", deadline)
    if gene is None:
        return None
    identity = refseq.gene_identity(accession, gene)
    taxon = identity.taxonomy_id
    query = f"xref:geneid-{accession} AND organism_id:{taxon}"
    candidates, cursor = uniprot.search(uniprot.get_client(), query, 10, None, deadline=deadline)
    verified = []
    for candidate in candidates:
        protein = protein_identity(candidate["primaryAccession"], candidate)
        if protein.taxonomy_id == taxon and any(ref.get("id") == accession for ref in crossrefs(candidate, "GeneID")):
            verified.append((protein, candidate))
    if candidates and not verified:
        raise SourceError("identity_mismatch")
    reviewed = [pair for pair in verified if uniprot.map_summary(pair[1], uniprot.now_iso()).reviewed]
    choices = reviewed or verified
    if cursor or len(choices) != 1:
        return identity, None, None
    return identity, *choices[0]
