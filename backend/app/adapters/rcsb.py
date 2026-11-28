"""RCSB Data API: experimental entries, mapping and chemical components."""
from __future__ import annotations

import json
import re

from pydantic import BaseModel

from .molecular_identity import crossrefs
from .scientific_http import ScientificSource, SourceError

SOURCE = ScientificSource("https://data.rcsb.org", spacing=0.35)
PDB_ID = re.compile(r"[0-9][A-Z0-9]{3}")
LIMIT = 6
FIELDS = """
rcsb_id struct { title } exptl { method }
rcsb_entry_info { resolution_combined }
rcsb_entry_container_identifiers { assembly_ids }
polymer_entities {
  rcsb_polymer_entity_container_identifiers {
    auth_asym_ids reference_sequence_identifiers { database_accession database_name }
  }
}
"""


class Coverage(BaseModel):
    chain: str
    start: int | None = None
    end: int | None = None


def mappings(raw: dict) -> dict[str, list[Coverage]]:
    found: dict[str, list[Coverage]] = {}
    for ref in crossrefs(raw, "PDB"):
        pdb_id = ref.get("id")
        if not isinstance(pdb_id, str) or not PDB_ID.fullmatch(pdb_id):
            raise SourceError("malformed_response")
        properties = ref.get("properties", [])
        if not isinstance(properties, list) or any(not isinstance(p, dict) for p in properties):
            raise SourceError("malformed_response")
        for prop in properties:
            if prop.get("key") != "Chains" or not isinstance(prop.get("value"), str):
                continue
            for group in prop["value"].split(","):
                match = re.fullmatch(r"([A-Za-z0-9/]+)=(\d+)-(\d+)", group.strip())
                if not match or not 1 <= int(match[2]) <= int(match[3]):
                    continue
                found.setdefault(pdb_id, []).extend(
                    Coverage(chain=chain, start=int(match[2]), end=int(match[3]))
                    for chain in match[1].split("/") if chain
                )
        found.setdefault(pdb_id, [])
    ids = sorted(found, key=lambda pdb_id: (
        -max((record.end - record.start + 1 for record in found[pdb_id]), default=0), pdb_id,
    ))[:LIMIT]
    return {pdb_id: found[pdb_id] for pdb_id in ids}


def entries(ids: list[str], deadline: float, *, components: bool = False) -> list[dict]:
    if not ids:
        return []
    fields = FIELDS
    if components:
        fields += """
        nonpolymer_entities { nonpolymer_comp {
          chem_comp { id name formula type pdbx_formal_charge }
          rcsb_chem_comp_info { atom_count }
          rcsb_chem_comp_related { resource_name resource_accession_code }
        } }
        """
    query = "{ entries(entry_ids:" + json.dumps(ids) + ") { " + fields + " } }"
    body = SOURCE.json("/graphql", deadline, params={"query": query})
    try:
        if body.get("errors"):
            raise SourceError("upstream_error")
        records = body["data"]["entries"]
        if not isinstance(records, list):
            raise TypeError("entries must be a list")
        return [entry for entry in records if isinstance(entry, dict) and entry.get("rcsb_id") in ids]
    except (KeyError, AttributeError, TypeError) as exc:
        raise SourceError("malformed_response") from exc


def verified_chains(entry: dict, accession: str, mapped: list[Coverage]) -> list[Coverage]:
    authors: set[str] = set()
    try:
        for entity in entry.get("polymer_entities") or []:
            identifiers = entity["rcsb_polymer_entity_container_identifiers"]
            references = identifiers.get("reference_sequence_identifiers") or []
            if any(ref.get("database_name") == "UniProt" and ref.get("database_accession") == accession for ref in references):
                authors.update(chain for chain in identifiers["auth_asym_ids"] if re.fullmatch(r"[A-Za-z0-9]{1,12}", chain))
    except (KeyError, AttributeError, TypeError) as exc:
        raise SourceError("malformed_response") from exc
    return [span for span in mapped if span.chain in authors] + [
        Coverage(chain=chain) for chain in sorted(authors - {span.chain for span in mapped})
    ]
