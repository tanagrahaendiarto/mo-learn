"""Allowlisted, on-demand scientific exploration routes."""
import re
from typing import Literal

from fastapi import APIRouter, HTTPException

from ..adapters import ligands, literature, pubmed, sequence, stringdb, structure, uniprot
from ..exploration import ExplorationResult

router = APIRouter(prefix="/api/v1/entities", tags=["exploration"])
EntityType = Literal["gene", "protein"]


def entity_id(entity_type: EntityType, accession: str) -> str:
    if entity_type == "protein" and uniprot.is_accession(accession):
        return accession.strip().upper()
    if entity_type == "gene" and re.fullmatch(r"[1-9][0-9]{0,11}", accession):
        return accession
    raise HTTPException(422, "invalid_entity_identifier")


@router.get("/{entity_type}/{accession}/sequence", response_model=ExplorationResult[sequence.SequenceRecord])
def sequences(entity_type: EntityType, accession: str):
    accession = entity_id(entity_type, accession)
    response = sequence.protein_sequence(accession) if entity_type == "protein" else sequence.gene_sequence(accession)
    if response is None:
        raise HTTPException(404, "entity_not_found")
    return response


@router.get("/{entity_type}/{accession}/literature", response_model=ExplorationResult[pubmed.Publication])
def publications(entity_type: EntityType, accession: str):
    response = literature.literature(entity_type, entity_id(entity_type, accession))
    if response is None:
        raise HTTPException(404, "entity_not_found")
    return response


@router.get("/{entity_type}/{accession}/structure", response_model=ExplorationResult[structure.Structure])
def structures(entity_type: EntityType, accession: str):
    response = structure.structures(entity_type, entity_id(entity_type, accession))
    if response is None:
        raise HTTPException(404, "entity_not_found")
    return response


@router.get("/{entity_type}/{accession}/ligand", response_model=ExplorationResult[ligands.Component])
def components(entity_type: EntityType, accession: str):
    response = ligands.ligands(entity_type, entity_id(entity_type, accession))
    if response is None:
        raise HTTPException(404, "entity_not_found")
    return response


@router.get("/{entity_type}/{accession}/interaction", response_model=ExplorationResult[stringdb.Association])
def interactions(entity_type: EntityType, accession: str):
    response = stringdb.interactions(entity_type, entity_id(entity_type, accession))
    if response is None:
        raise HTTPException(404, "entity_not_found")
    return response
