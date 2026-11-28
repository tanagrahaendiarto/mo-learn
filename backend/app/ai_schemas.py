"""Request, provider draft, and public learning response contracts."""
import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from .adapters.uniprot import is_accession

EntityKind = Literal["gene", "protein"]
SourceId = Annotated[str, StringConstraints(pattern=r"^(record|protein_[1-4])$")]
ClaimText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1200)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class EntityRequest(StrictModel):
    entity_type: EntityKind
    entity_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=12)]

    @model_validator(mode="after")
    def canonical_identifier(self) -> "EntityRequest":
        if self.entity_type == "protein":
            self.entity_id = self.entity_id.upper()
            if is_accession(self.entity_id):
                return self
        elif re.fullmatch(r"[1-9][0-9]{0,11}", self.entity_id):
            return self
        raise ValueError("Use a canonical NCBI GeneID or UniProtKB accession.")


class QuestionRequest(EntityRequest):
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=600)]


class Claim(StrictModel):
    text: ClaimText
    source_ids: list[SourceId] = Field(min_length=1, max_length=5)


class Term(Claim):
    term: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class EvidenceSelection(StrictModel):
    status: Literal["generated", "insufficient_evidence"]
    evidence_ids: list[Annotated[str, StringConstraints(pattern=r"^e[1-9][0-9]?$")]] = Field(max_length=3)

    @model_validator(mode="after")
    def consistent_status(self) -> "EvidenceSelection":
        if bool(self.evidence_ids) != (self.status == "generated"):
            raise ValueError("Evidence selection must match generation status.")
        if len(set(self.evidence_ids)) != len(self.evidence_ids):
            raise ValueError("Select each evidence ID at most once.")
        return self


class Draft(StrictModel):
    status: Literal["generated", "insufficient_evidence"]
    answer: Claim | None
    key_functions: list[Claim] = Field(max_length=4)
    terms: list[Term] = Field(max_length=4)

    @model_validator(mode="after")
    def consistent_status(self) -> "Draft":
        if self.status == "generated" and self.answer is not None:
            return self
        if self.status == "insufficient_evidence" and not (self.answer or self.key_functions or self.terms):
            return self
        raise ValueError("Content must match generation status.")


class LearningSource(StrictModel):
    id: SourceId
    provider: Literal["NCBI Gene", "UniProtKB"]
    entity_id: str
    url: str
    retrieved_at: str


class LearningResult(Draft):
    entity_type: EntityKind
    entity_id: str
    sources: list[LearningSource]
    limitations: list[str]


class LearningError(StrictModel):
    status: Literal["unavailable", "access_required", "rate_limited", "quota_exhausted",
                    "timeout", "provider_error", "not_found", "bad_request"]
    detail: str


class LearningFailure(Exception):
    def __init__(self, http_status: int, status: str, detail: str):
        super().__init__(detail)
        self.http_status = http_status
        self.body = LearningError(status=status, detail=detail)
