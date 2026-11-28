"""Shared response contract for on-demand exploration modules."""
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel


class Identity(BaseModel):
    entity_type: Literal["gene", "protein"]
    accession: str
    name: str | None = None
    organism: str | None = None
    taxonomy_id: int | None = None


class Provenance(BaseModel):
    source: str
    source_id: str
    source_url: str
    retrieved_at: str


class Notice(BaseModel):
    source: str
    code: str
    message: str


Item = TypeVar("Item")


class ExplorationResult(BaseModel, Generic[Item]):
    status: Literal["available", "empty", "unavailable", "partial", "provider_error"]
    identity: Identity
    records: list[Item]
    notices: list[Notice]


def result(identity: Identity, records: list, notices: list[Notice], *, unavailable: bool = False) -> dict:
    if records:
        status = "partial" if notices else "available"
    elif any(n.code not in {"unsupported", "not_available"} for n in notices):
        status = "provider_error"
    else:
        status = "unavailable" if unavailable else "empty"
    return {"status": status, "identity": identity, "records": records, "notices": notices}
