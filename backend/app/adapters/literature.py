"""Join canonical entity evidence with directly linked and searched publications."""
import time

from ..exploration import Identity, Notice, result
from . import pubmed, refseq, uniprot
from .scientific_http import SourceError
from .molecular_identity import protein_identity


def literature(entity_type, accession: str) -> dict | None:
    identity = Identity(entity_type=entity_type, accession=accession)
    notices: list[Notice] = []
    provider = "UniProtKB" if entity_type == "protein" else "NCBI Gene"
    deadline = time.monotonic() + 24
    try:
        if entity_type == "gene":
            raw = refseq.report(accession, "gene", deadline)
            if raw is None:
                return None
            identity = refseq.gene_identity(accession, raw)
            symbol = identity.name
        else:
            raw = uniprot.retrieve(uniprot.get_client(), accession)
            if raw is None:
                return None
            identity = protein_identity(accession, raw)
            summary = uniprot.map_summary(raw, uniprot.now_iso())
            symbol = next(iter(summary.gene_symbols), None)
            deadline = time.monotonic() + 18
    except (uniprot.ProviderError, SourceError) as exc:
        return result(identity, [], [Notice(source=provider, code=exc.code, message="Entity identity could not be verified.")])

    direct: list[str] = []
    related: list[str] = []
    try:
        direct = pubmed.gene_pmids(accession, min(deadline, time.monotonic() + 7)) if entity_type == "gene" else pubmed.protein_pmids(raw)
    except SourceError as exc:
        notices.append(Notice(source=provider, code=exc.code, message="Direct publication links could not be loaded."))
    try:
        hits = pubmed.related_pmids(identity, symbol, min(deadline, time.monotonic() + 7))
        if hits is None:
            notices.append(Notice(source="PubMed", code="unsupported", message="Related search needs an entity name and organism."))
        else:
            related = hits
    except SourceError as exc:
        notices.append(Notice(source="PubMed", code=exc.code, message="Related literature search failed."))
    try:
        records, missing = pubmed.articles(direct, related, provider, deadline)
    except SourceError as exc:
        notices.append(Notice(source="PubMed", code=exc.code, message="Publication metadata could not be loaded."))
        return result(identity, [], notices)
    if missing:
        notices.append(Notice(source="PubMed", code="not_available", message=f"Metadata was unavailable for {missing} linked or related records."))
    return result(identity, records, notices, unavailable=bool(notices))
