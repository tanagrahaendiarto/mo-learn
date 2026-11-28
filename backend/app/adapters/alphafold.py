"""AlphaFold DB prediction metadata. Only canonical matching records qualify."""
from __future__ import annotations

import math
import re

from ..exploration import Identity
from .scientific_http import ScientificSource, SourceError

SOURCE = ScientificSource("https://alphafold.ebi.ac.uk", spacing=0.35)


def predictions(protein: Identity, sequence: str | None, deadline: float) -> list[dict]:
    accession = protein.accession
    body = SOURCE.json(f"/api/prediction/{accession}", deadline, missing_ok=True)
    if body is None:
        return []
    if not isinstance(body, list) or any(not isinstance(item, dict) for item in body):
        raise SourceError("malformed_response")
    matches = []
    for model in body:
        model_id = model.get("entryId")
        if not isinstance(model_id, str) or not re.fullmatch(rf"AF-{accession}-F[1-9][0-9]*", model_id):
            continue
        taxon = model.get("taxId")
        start, end = model.get("uniprotStart"), model.get("uniprotEnd")
        if (model.get("uniprotAccession") != accession or taxon != protein.taxonomy_id
                or type(start) is not int or type(end) is not int or not 1 <= start <= end):
            raise SourceError("identity_mismatch")
        if sequence is not None and (end > len(sequence) or model.get("sequence") != sequence[start - 1:end]):
            raise SourceError("identity_mismatch")
        matches.append(model)
    return matches[:3]


def file_url(model: dict, key: str, suffix: str) -> str | None:
    version = model.get("latestVersion")
    if type(version) is not int or version < 1:
        return None
    expected = f'https://alphafold.ebi.ac.uk/files/{model["entryId"]}-{suffix.format(version=version)}'
    return expected if model.get(key) == expected else None


def confidence(model: dict) -> float | None:
    value = model.get("globalMetricValue")
    return float(value) if type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 100 else None
