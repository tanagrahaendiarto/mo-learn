"""Resolve sequence records through explicit, versioned provider mappings."""
from __future__ import annotations

import re
import time
from typing import Literal

from ..exploration import Identity, Notice, Provenance, result
from . import refseq, uniprot
from .molecular_identity import protein_identity
from .scientific_http import SourceError, retrieved_now


class SequenceRecord(Provenance):
    kind: Literal["protein", "genomic_dna", "transcript", "cds"]
    accession: str
    label: str
    length: int
    sequence: str
    start: int | None = None
    end: int | None = None
    strand: str | None = None


def protein_sequence(accession: str) -> dict | None:
    identity = Identity(entity_type="protein", accession=accession)
    try:
        raw = uniprot.retrieve(uniprot.get_client(), accession)
        if raw is None:
            return None
        identity = protein_identity(accession, raw)
        seq = raw.get("sequence")
        if seq is None or (isinstance(seq, dict) and seq.get("value") is None):
            return result(identity, [], [])
        value = seq.get("value") if isinstance(seq, dict) else None
        if (not isinstance(value, str) or len(value) != seq.get("length")
                or not re.fullmatch(r"[ACDEFGHIKLMNPQRSTVWYBXZJUO]+", value)):
            raise uniprot.UpstreamMalformed()
        item = SequenceRecord(
            kind="protein", accession=identity.accession, label="UniProtKB protein sequence",
            length=len(value), sequence=value, source="UniProtKB", source_id=identity.accession,
            source_url=f"https://www.uniprot.org/uniprotkb/{identity.accession}", retrieved_at=retrieved_now(),
        )
        return result(identity, [item], [])
    except uniprot.ProviderError as exc:
        return result(identity, [], [Notice(source="UniProtKB", code=exc.code, message="Protein sequence could not be retrieved.")])


def _record(kind, accession: str, label: str, value: str, region: refseq.Interval | None = None) -> SequenceRecord:
    source_id = accession
    if region:
        source_id = f"{accession}:{region.start}-{region.end}({region.strand})"
    return SequenceRecord(
        kind=kind, accession=accession, label=label, length=len(value), sequence=value,
        source="NCBI RefSeq", source_id=source_id, source_url=f"https://www.ncbi.nlm.nih.gov/nuccore/{accession}",
        retrieved_at=retrieved_now(), start=region.start if region else None,
        end=region.end if region else None, strand=region.strand if region else None,
    )


def _genomic(gene: dict, deadline: float) -> SequenceRecord | None:
    for standard in gene.get("reference_standards", []):
        if standard.get("type") == "REFSEQ_GENE":
            reference = standard["gene_range"]
            ranges = reference["range"]
            if len(ranges) != 1:
                continue
            region = refseq.interval(ranges[0])
            accession = reference["accession_version"]
            value = refseq.fasta(accession, deadline, region=region)
            return _record("genomic_dna", accession, "RefSeqGene locus, gene orientation", value, region)
    for annotation in gene.get("annotations", []):
        locations = annotation.get("genomic_locations", [])
        if len(locations) != 1 or not annotation.get("assembly_name"):
            continue
        location = locations[0]
        accession = location["genomic_accession_version"]
        if not accession.startswith(("NC_", "NT_", "NW_", "NZ_")):
            continue
        region = refseq.interval(location["genomic_range"])
        value = refseq.fasta(accession, deadline, region=region)
        return _record("genomic_dna", accession, f'{annotation["assembly_name"]} annotated locus, gene orientation', value, region)
    return None


def _transcript(product: dict, deadline: float) -> tuple[SequenceRecord, SequenceRecord | None] | None:
    candidates = [t for t in product.get("transcripts", []) if
                  isinstance(t.get("accession_version"), str) and t["accession_version"].startswith(("NM_", "NR_"))]
    for category, label in (("MANE_SELECT", "MANE Select"), ("REFSEQ_SELECT", "RefSeq Select"), (None, "RefSeq transcript example")):
        selected = next((t for t in candidates if category is None or t.get("select_category") == category), None)
        if selected is not None:
            break
    else:
        return None
    accession = selected["accession_version"]
    length = selected["length"]
    if type(length) is not int or length < 1:
        raise SourceError("malformed_response")
    value = refseq.fasta(accession, deadline, length=length)
    name = selected.get("name")
    title = f"{label}: {name}" if isinstance(name, str) and name else label
    transcript = _record("transcript", accession, title, value)
    cds = selected.get("cds")
    if cds is not None and cds["accession_version"] == accession and len(cds["range"]) == 1:
        interval = refseq.interval(cds["range"][0])
        if interval.strand == "+" and interval.end <= len(value):
            return transcript, _record("cds", accession, f"Annotated CDS of {accession}",
                                       value[interval.start - 1:interval.end], interval)
    return transcript, None


def _notice(error: Exception, label: str) -> Notice:
    code = error.code if isinstance(error, SourceError) else "malformed_response"
    message = (
        f"{label} exceeds the supported sequence length."
        if code == "unsupported" else f"{label} could not be retrieved or verified."
    )
    return Notice(source="NCBI RefSeq", code=code, message=message)


def gene_sequence(gene_id: str) -> dict | None:
    identity = Identity(entity_type="gene", accession=gene_id)
    deadline = time.monotonic() + 23
    notices: list[Notice] = []
    records: list[SequenceRecord] = []
    try:
        gene = refseq.report(gene_id, "gene", deadline)
        if gene is None:
            return None
        identity = refseq.gene_identity(gene_id, gene)
    except (SourceError, KeyError, TypeError, ValueError) as exc:
        return result(identity, [], [_notice(exc, "Gene reference")])
    # Budget each path separately so a slow source cannot consume the other path's window.
    try:
        genomic = _genomic(gene, min(deadline, time.monotonic() + 9))
        if genomic:
            records.append(genomic)
        else:
            notices.append(Notice(source="NCBI RefSeq", code="not_available", message="No supported genomic locus was found."))
    except (SourceError, KeyError, TypeError, ValueError, AttributeError) as exc:
        notices.append(_notice(exc, "Genomic DNA"))
    try:
        product = refseq.report(gene_id, "product", deadline)
        if product and str(product.get("tax_id")) != str(identity.taxonomy_id):
            raise SourceError("identity_mismatch")
        transcripts = _transcript(product, deadline) if product else None
        if transcripts:
            transcript, cds = transcripts
            records.append(transcript)
            if cds:
                records.append(cds)
            elif transcript.accession.startswith("NM_"):
                notices.append(Notice(source="NCBI RefSeq", code="not_available", message="No supported CDS annotation was found."))
        else:
            notices.append(Notice(source="NCBI RefSeq", code="not_available", message="No supported RefSeq transcript was found."))
    except (SourceError, KeyError, TypeError, ValueError, AttributeError) as exc:
        notices.append(_notice(exc, "Transcript or CDS"))
    return result(identity, records, notices)
