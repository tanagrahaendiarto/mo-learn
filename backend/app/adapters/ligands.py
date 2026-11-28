"""Chemical Component Dictionary evidence for deposited PDB entries."""
from __future__ import annotations

import re
import time
from typing import Literal

from ..exploration import Identity, Notice, Provenance, result
from . import rcsb, uniprot
from .molecular_identity import resolve_protein
from .scientific_http import SourceError, retrieved_now

LIMIT = 40
COMPONENT_ID = re.compile(r"[A-Z0-9]{1,5}")
CHEBI_ID = re.compile(r"CHEBI:[0-9]+")
MONATOMIC_NAME = re.compile(r"([A-Z][a-z]?)\(([1-9][0-9]*)([+-])\)")


class Component(Provenance):
    name: str
    formula: str | None
    category: Literal["ion", "nonpolymer", "other"]
    ccd_type: str | None
    pdb_ids: list[str]
    protein_accession: str
    cofactor_chebi: str | None
    cofactor_source_url: str | None


def _cofactors(raw: dict) -> tuple[set[str], dict[tuple[str, int], str]]:
    ids: set[str] = set()
    atomic: dict[tuple[str, int], str] = {}
    for comment in raw.get("comments", []):
        if comment.get("commentType") != "COFACTOR":
            continue
        for item in comment.get("cofactors", []):
            ref = item.get("cofactorCrossReference") or {}
            chebi = ref.get("id", "")
            if ref.get("database") != "ChEBI" or not CHEBI_ID.fullmatch(chebi):
                continue
            ids.add(chebi)
            ion = MONATOMIC_NAME.fullmatch(item.get("name", ""))
            if ion:
                atomic[(ion[1], int(ion[2]) * (1 if ion[3] == "+" else -1))] = chebi
    return ids, atomic


def _components(entries: list[dict], protein: Identity, raw: dict, mappings: dict) -> tuple[list[Component], list[Notice]]:
    chemical_ids, atomic = _cofactors(raw)
    records: dict[str, Component] = {}
    verified = set()
    malformed = False
    retrieved_at = retrieved_now()
    for entry in entries:
        pdb_id = entry["rcsb_id"]
        if not rcsb.verified_chains(entry, protein.accession, mappings[pdb_id]) or not entry.get("exptl"):
            continue
        verified.add(pdb_id)
        for entity in entry.get("nonpolymer_entities") or []:
            component = entity.get("nonpolymer_comp") or {}
            chem = component.get("chem_comp") or {}
            comp_id = chem.get("id", "")
            name = chem.get("name", "")
            if not isinstance(comp_id, str) or not COMPONENT_ID.fullmatch(comp_id) or not isinstance(name, str) or not name.strip():
                malformed = True
                continue
            if comp_id in records:
                if pdb_id not in records[comp_id].pdb_ids:
                    records[comp_id].pdb_ids.append(pdb_id)
                continue
            if len(records) >= LIMIT:
                continue
            formula, ccd_type = chem.get("formula"), chem.get("type")
            charge = chem.get("pdbx_formal_charge")
            monatomic = (component.get("rcsb_chem_comp_info") or {}).get("atom_count") == 1 and type(charge) is int and charge != 0
            ion = monatomic or bool(re.search(r"\b(?:ion|cation|anion)$", name, re.IGNORECASE))
            category = "ion" if ion else "nonpolymer" if (ccd_type or "").lower() == "non-polymer" else "other"
            cofactor = next((ref.get("resource_accession_code") for ref in component.get("rcsb_chem_comp_related") or []
                             if ref.get("resource_name") == "ChEBI" and ref.get("resource_accession_code") in chemical_ids), None)
            if not cofactor and monatomic:
                cofactor = atomic.get((formula, charge))
            records[comp_id] = Component(
                name=name, formula=formula, category=category, ccd_type=ccd_type, pdb_ids=[pdb_id],
                protein_accession=protein.accession, cofactor_chebi=cofactor,
                cofactor_source_url=f"https://www.uniprot.org/uniprotkb/{protein.accession}#function" if cofactor else None,
                source="RCSB PDB", source_id=comp_id, source_url=f"https://www.rcsb.org/ligand/{comp_id}",
                retrieved_at=retrieved_at,
            )
    notices = []
    if len(verified) < len(mappings) or malformed:
        notices.append(Notice(source="RCSB PDB", code="not_available", message="Some structures or components could not be verified."))
    return list(records.values()), notices


def ligands(entity_type, accession: str) -> dict | None:
    identity = Identity(entity_type=entity_type, accession=accession)
    deadline = time.monotonic() + 23
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
        mappings = rcsb.mappings(raw)
        entries = rcsb.entries(list(mappings), deadline, components=True)
        records, notices = _components(entries, protein, raw, mappings)
        return result(identity, records, notices)
    except (SourceError, uniprot.ProviderError, KeyError, TypeError, ValueError, AttributeError) as exc:
        return result(identity, [], [Notice(source="RCSB PDB", code=getattr(exc, "code", "malformed_response"), message="Chemical components could not be verified.")])
