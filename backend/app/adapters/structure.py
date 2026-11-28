"""Experimental and predicted structures with independently sourced evidence."""
import math
import re
import time
from typing import Literal

from pydantic import BaseModel

from ..exploration import Identity, Notice, Provenance, result
from . import alphafold, rcsb, uniprot
from .molecular_identity import resolve_protein
from .scientific_http import SourceError, retrieved_now


class Download(BaseModel):
    format: str
    url: str


class Structure(Provenance):
    kind: Literal["experimental", "predicted"]
    title: str | None
    protein_accession: str
    methods: list[str]
    resolution_angstrom: list[float]
    coverage: list[rcsb.Coverage]
    mean_plddt: float | None = None
    preview_url: str | None
    downloads: list[Download]


def _experimental(protein: Identity, raw: dict, deadline: float) -> tuple[list[Structure], list[Notice]]:
    mappings = rcsb.mappings(raw)
    entries = rcsb.entries(list(mappings), deadline)
    verified: dict[str, Structure] = {}
    at = retrieved_now()
    for entry in entries:
        pdb_id = entry["rcsb_id"]
        coverage = rcsb.verified_chains(entry, protein.accession, mappings[pdb_id])
        methods = [v["method"] for v in entry.get("exptl") or [] if isinstance(v.get("method"), str)]
        if not coverage or not methods:
            continue
        resolution = (entry.get("rcsb_entry_info") or {}).get("resolution_combined") or []
        resolution = [v for v in resolution if type(v) in (int, float) and math.isfinite(v) and v > 0]
        assembly = next(iter((entry.get("rcsb_entry_container_identifiers") or {}).get("assembly_ids") or []), "")
        preview = f"https://cdn.rcsb.org/images/structures/pdb/{pdb_id.lower()}_assembly-{assembly}.jpeg" if re.fullmatch(r"[1-9][0-9]{0,4}", assembly) else None
        verified[pdb_id] = Structure(
            kind="experimental", title=(entry.get("struct") or {}).get("title"), protein_accession=protein.accession,
            methods=methods, resolution_angstrom=resolution, coverage=coverage, preview_url=preview,
            source="RCSB PDB", source_id=pdb_id, source_url=f"https://www.rcsb.org/structure/{pdb_id}", retrieved_at=at,
            downloads=[Download(format="mmCIF", url=f"https://files.rcsb.org/download/{pdb_id}.cif")],
        )
    notices = []
    if len(verified) < len(mappings):
        notices.append(Notice(source="RCSB PDB", code="not_available", message="Some UniProt cross-references could not be confirmed by RCSB."))
    return [verified[pdb_id] for pdb_id in mappings if pdb_id in verified], notices


def _predicted(protein: Identity, raw: dict, deadline: float) -> list[Structure]:
    seq = raw.get("sequence")
    seq = seq.get("value") if isinstance(seq, dict) else None
    at = retrieved_now()
    records = []
    for model in alphafold.predictions(protein, seq if isinstance(seq, str) else None, deadline):
        downloads = []
        for file_type, key, suffix in (("mmCIF", "cifUrl", "cif"), ("PDB", "pdbUrl", "pdb")):
            url = alphafold.file_url(model, key, "model_v{version}." + suffix)
            if url:
                downloads.append(Download(format=file_type, url=url))
        chain = model.get("chainId")
        coverage = [rcsb.Coverage(chain=chain, start=model["uniprotStart"], end=model["uniprotEnd"])] if isinstance(chain, str) else []
        records.append(Structure(
            kind="predicted", title="AlphaFold protein prediction", protein_accession=protein.accession,
            methods=["AlphaFold"], resolution_angstrom=[], coverage=coverage, mean_plddt=alphafold.confidence(model),
            preview_url=alphafold.file_url(model, "paeImageUrl", "predicted_aligned_error_v{version}.png"),
            source="AlphaFold DB", source_id=model["entryId"], source_url=f"https://alphafold.ebi.ac.uk/entry/{protein.accession}",
            retrieved_at=at, downloads=downloads,
        ))
    return records


def structures(entity_type, accession: str) -> dict | None:
    identity = Identity(entity_type=entity_type, accession=accession)
    deadline = time.monotonic() + 32
    try:
        found = resolve_protein(entity_type, accession, min(deadline, time.monotonic() + 13))
    except (SourceError, uniprot.ProviderError) as exc:
        return result(identity, [], [Notice(source="NCBI / UniProtKB", code=exc.code, message="Protein identity could not be verified.")])
    if found is None:
        return None
    identity, protein, raw = found
    if not protein:
        return result(identity, [], [Notice(source="UniProtKB", code="unsupported", message="No unique verified protein mapping. Open a linked protein profile when available.")], unavailable=True)
    records: list[Structure] = []
    notices: list[Notice] = []
    try:
        experimental, notes = _experimental(protein, raw, min(deadline, time.monotonic() + 8))
        records.extend(experimental)
        notices.extend(notes)
    except (SourceError, uniprot.ProviderError, KeyError, TypeError, ValueError, AttributeError) as exc:
        notices.append(Notice(source="RCSB PDB", code=getattr(exc, "code", "malformed_response"), message="Experimental structures could not be verified."))
    try:
        records.extend(_predicted(protein, raw, deadline))
    except (SourceError, KeyError, TypeError, ValueError, AttributeError) as exc:
        notices.append(Notice(source="AlphaFold DB", code=getattr(exc, "code", "malformed_response"), message="Predicted structures could not be verified."))
    return result(identity, records, notices)
