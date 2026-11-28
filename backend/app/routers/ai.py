"""Restricted on-demand learning endpoints."""
import asyncio
import hmac

from fastapi import APIRouter, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from .. import learning
from ..ai_schemas import EntityRequest, LearningError, LearningFailure, LearningResult, QuestionRequest


def failure(error: LearningFailure) -> JSONResponse:
    return JSONResponse(
        error.body.model_dump(),
        status_code=error.http_status,
        headers={"Cache-Control": "no-store"},
    )


class RestrictedRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def guarded(request: Request):
            config = learning.settings()
            if config is None:
                return failure(LearningFailure(503, "unavailable", "ai_not_configured"))
            supplied = request.headers.get("x-molearn-ai-access", "").encode()
            if not hmac.compare_digest(supplied, config.access_code.encode()):
                return failure(LearningFailure(403, "access_required", "reviewer_access_required"))
            media_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
            length = request.headers.get("content-length", "")
            if media_type != "application/json":
                return failure(LearningFailure(415, "bad_request", "expected_json"))
            if not length.isascii() or not length.isdecimal() or request.headers.get("transfer-encoding"):
                return failure(LearningFailure(411, "bad_request", "content_length_required"))
            if len(length) > 5 or int(length) > learning.MAX_REQUEST_BYTES:
                return failure(LearningFailure(413, "bad_request", "body_too_large"))
            request.state.ai_config = config
            try:
                async with asyncio.timeout(5):
                    await request.body()
            except TimeoutError:
                return failure(LearningFailure(408, "timeout", "request_body_timeout"))
            try:
                response = await handler(request)
            except LearningFailure as error:
                return failure(error)
            except (RequestValidationError, RecursionError):
                return failure(LearningFailure(422, "bad_request", "invalid_ai_request"))
            response.headers["Cache-Control"] = "no-store"
            return response

        return guarded


router = APIRouter(prefix="/api/v1/ai", tags=["AI learning"], route_class=RestrictedRoute)
ERRORS = {code: {"model": LearningError} for code in (403, 404, 408, 411, 413, 415, 422, 429, 502, 503, 504)}


@router.post("/explain", response_model=LearningResult, responses=ERRORS)
async def explain(payload: EntityRequest, request: Request):
    """Generate a plain-language explanation. Requires `X-MoLearn-AI-Access`."""
    return await learning.generate(payload, request.state.ai_config)


@router.post("/ask", response_model=LearningResult, responses=ERRORS)
async def ask(payload: QuestionRequest, request: Request):
    """Answer from the selected record. Requires `X-MoLearn-AI-Access`."""
    return await learning.generate(payload, request.state.ai_config)
