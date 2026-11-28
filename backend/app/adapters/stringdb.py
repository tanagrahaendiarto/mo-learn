"""STRING v12 functional associations using exact UniProt and species evidence."""
from __future__ import annotations

import math
import re
import time
from typing import Literal
from urllib.parse import urlencode

from ..exploration import Identity, Notice, Provenance, result
from . import uniprot
from .molecular_identity import crossrefs, resolve_protein
from .scientific_http import ScientificSource, SourceError, retrieved_now

BASE = "https://version-12-0.string-db.org"
SOURCE = ScientificSource(BASE, spacing=1.05)
LIMIT = 10
REQUIRED_SCORE = 700
STRING_ID = re.compile(r"([1-9][0-9]{0,11})\.[A-Za-z0-9_.:-]{1,75}")
EVIDENCE = {
    "nscore": "Gene neighborhood", "fscore": "Gene fusion", "pscore": "Phylogenetic co-occurrence",
    "ascore": "Co-expression", "escore": "Experiments", "dscore": "Curated databases", "tscore": "Text mining",
}


class Association(Provenance):
    protein_accession: str
    string_id: str
    seed_name: str
    partner_id: str
    partner_name: str
    partner_url: str
    taxonomy_id: int
    network_type: Literal["functional"] = "functional"
    score: float
    evidence: dict[str, float]
    required_score: int = REQUIRED_SCORE


def _same_taxon(string_id: str, taxon: int) -> bool:
    match = STRING_ID.fullmatch(string_id)
    return bool(match and int(match[1]) == taxon)


def _resolve(protein: Identity, raw: dict, deadline: float) -> str | None:
    taxon = protein.taxonomy_id
    ids = {
        ref["id"] for ref in crossrefs(raw, "STRING")
        if isinstance(ref.get("id"), str) and taxon and _same_taxon(ref["id"], taxon)
    }
    if not ids:
        return None
    params = {"identifiers": protein.accession, "species": taxon, "limit": 1, "caller_identity": "MoLearn", "echo_query": 1}
    body = SOURCE.json("/api/json/get_string_ids", deadline, params=params, max_bytes=64_000)
    if body == []:
        return None
    if not isinstance(body, list) or len(body) != 1 or not isinstance(body[0], dict):
        raise SourceError("malformed_response")
    row = body[0]
    candidate = row.get("stringId")
    if (row.get("queryItem") != protein.accession or row.get("ncbiTaxonId") != taxon
            or not isinstance(candidate, str) or candidate not in ids):
        raise SourceError("identity_mismatch")
    return candidate


def _score(value) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 1


def _associations(protein: Identity, seed: str, deadline: float) -> tuple[list[Association], bool]:
    params = {
        "identifiers": seed, "species": protein.taxonomy_id, "limit": LIMIT,
        "required_score": REQUIRED_SCORE, "network_type": "functional", "caller_identity": "MoLearn",
    }
    path = "/api/json/interaction_partners"
    body = SOURCE.json(path, deadline, params=params, max_bytes=128_000)
    if not isinstance(body, list):
        raise SourceError("malformed_response")
    records: dict[str, Association] = {}
    invalid = False
    retrieved_at = retrieved_now()
    for row in body[:LIMIT]:
        if not isinstance(row, dict):
            invalid = True
            continue
        fields = (row.get("stringId_A"), row.get("stringId_B"))
        if seed not in fields or row.get("ncbiTaxonId") != protein.taxonomy_id:
            invalid = True
            continue
        seed_side, partner_side = ("A", "B") if fields[0] == seed else ("B", "A")
        partner = row.get(f"stringId_{partner_side}")
        score = row.get("score")
        if (not isinstance(partner, str) or partner == seed or not _same_taxon(partner, protein.taxonomy_id)
                or not _score(score) or score * 1000 + 1e-7 < REQUIRED_SCORE):
            invalid = True
            continue
        names = [row.get(f"preferredName_{side}") for side in (seed_side, partner_side)]
        if any(name is not None and not isinstance(name, str) for name in names):
            invalid = True
            continue
        evidence = {label: row[key] for key, label in EVIDENCE.items() if _score(row.get(key)) and row[key] > 0}
        if partner not in records or score > records[partner].score:
            records[partner] = Association(
                protein_accession=protein.accession, string_id=seed, seed_name=names[0] or protein.accession,
                partner_id=partner, partner_name=names[1] or partner, partner_url=f"{BASE}/network/{partner}",
                taxonomy_id=protein.taxonomy_id, score=score, evidence=evidence, source="STRING v12.0",
                source_id=f"{seed}|{partner}", source_url=f"{BASE}{path}?{urlencode(params)}", retrieved_at=retrieved_at,
            )
    if invalid and not records:
        raise SourceError("malformed_response")
    return sorted(records.values(), key=lambda record: (-record.score, record.partner_id)), invalid


def interactions(entity_type, accession: str) -> dict | None:
    identity = Identity(entity_type=entity_type, accession=accession)
    deadline = time.monotonic() + 30
    try:
        found = resolve_protein(entity_type, accession, min(deadline, time.monotonic() + 13))
    except (SourceError, uniprot.ProviderError) as exc:
        return result(identity, [], [Notice(source="NCBI / UniProtKB", code=exc.code, message="Protein identity could not be verified.")])
    if found is None:
        return None
    identity, protein, raw = found
    if not protein:
        return result(identity, [], [Notice(source="UniProtKB", code="unsupported", message="No unique verified protein mapping.")], unavailable=True)
    try:
        seed = _resolve(protein, raw, min(deadline, time.monotonic() + 8))
        if not seed:
            return result(identity, [], [Notice(source="STRING", code="unsupported", message="No exact STRING mapping was verified for this protein and organism.")], unavailable=True)
        records, invalid = _associations(protein, seed, deadline)
        notices = [Notice(source="STRING", code="malformed_response", message="Some associations could not be verified.")] if invalid else []
        return result(identity, records, notices)
    except (SourceError, uniprot.ProviderError) as exc:
        return result(identity, [], [Notice(source="STRING", code=exc.code, message="STRING associations could not be retrieved or verified.")])
