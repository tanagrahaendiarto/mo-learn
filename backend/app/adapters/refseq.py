"""NCBI Datasets Gene reports and E-utilities nucleotide FASTA."""
from __future__ import annotations

import re
from dataclasses import dataclass

from ..exploration import Identity
from .ncbi import EUTILS
from .scientific_http import ScientificSource, SourceError

DATASETS = ScientificSource("https://api.ncbi.nlm.nih.gov", spacing=0.21)
MAX_SEQUENCE = 100_000
REF_ACCESSION = re.compile(r"(?:N[CGMRTWZ]|X[MR])_[A-Z0-9]+\.[0-9]+")


@dataclass(frozen=True)
class Interval:
    start: int
    end: int
    strand: str

    @property
    def length(self) -> int:
        return self.end - self.start + 1


def report(gene_id: str, kind: str, deadline: float) -> dict | None:
    path, key = {
        "gene": ("dataset_report", "gene"),
        "product": ("product_report", "product"),
    }[kind]
    body = DATASETS.json(f"/datasets/v2/gene/id/{gene_id}/{path}", deadline, missing_ok=True)
    if body is None:
        return None
    if isinstance(body, dict) and body.get("total_count") in (None, 0) and body.get("reports") in (None, []):
        if body.get("total_count") == 0 or body.get("reports") == []:
            return None
    if not isinstance(body, dict) or not isinstance(body.get("reports"), list) or len(body["reports"]) != 1:
        raise SourceError("malformed_response")
    item = body["reports"][0]
    value = item.get(key) if isinstance(item, dict) else None
    if not isinstance(value, dict) or str(value.get("gene_id")) != gene_id:
        raise SourceError("identity_mismatch")
    return value


def gene_identity(gene_id: str, gene: dict) -> Identity:
    try:
        identity = Identity(entity_type="gene", accession=gene_id, name=gene.get("symbol"),
                            organism=gene.get("taxname"), taxonomy_id=gene["tax_id"])
    except (KeyError, ValueError) as exc:
        raise SourceError("malformed_response") from exc
    if identity.taxonomy_id is None or identity.taxonomy_id < 1:
        raise SourceError("malformed_response")
    return identity


def interval(value: dict) -> Interval:
    try:
        begin, finish = value["begin"], value["end"]
        if not re.fullmatch(r"[0-9]{1,12}", str(begin)) or not re.fullmatch(r"[0-9]{1,12}", str(finish)):
            raise ValueError("invalid coordinates")
        start, end = int(begin), int(finish)
        strand = {"plus": "+", "minus": "-"}[value["orientation"]]
    except (KeyError, TypeError, ValueError) as exc:
        raise SourceError("malformed_response") from exc
    if not 1 <= start <= end:
        raise SourceError("malformed_response")
    return Interval(start, end, strand)


def fasta(accession: str, deadline: float, *, region: Interval | None = None, length: int | None = None) -> str:
    if not REF_ACCESSION.fullmatch(accession):
        raise SourceError("malformed_response")
    params: dict[str, str | int] = {"db": "nuccore", "id": accession, "rettype": "fasta", "retmode": "text"}
    expected_id = accession
    if region:
        reverse = region.strand == "-"
        params.update(seq_start=region.start, seq_stop=region.end, strand=2 if reverse else 1)
        suffix = f"c{region.end}-{region.start}" if reverse else f"{region.start}-{region.end}"
        expected_id = f"{accession}:{suffix}"
        length = region.length
    if length is not None and not 1 <= length <= MAX_SEQUENCE:
        raise SourceError("unsupported")
    raw = EUTILS.get("/entrez/eutils/efetch.fcgi", deadline, params=params, max_bytes=MAX_SEQUENCE + 8_000)
    try:
        header, *lines = raw.decode("ascii").splitlines()
    except (AttributeError, ValueError, UnicodeError) as exc:
        raise SourceError("malformed_response") from exc
    if not header.startswith(">") or header[1:].split(maxsplit=1)[:1] != [expected_id]:
        raise SourceError("identity_mismatch")
    sequence = "".join(lines).upper()
    if not re.fullmatch(r"[ACGTRYSWKMBDHVN]+", sequence) or len(sequence) > MAX_SEQUENCE:
        raise SourceError("malformed_response")
    if length is not None and len(sequence) != length:
        raise SourceError("malformed_response")
    return sequence
