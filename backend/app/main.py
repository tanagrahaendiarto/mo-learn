import json
import logging
from time import monotonic

from fastapi import FastAPI, Request

from .routers import ai, entities, exploration, genes, health, search

logger = logging.getLogger("uvicorn.error")

app = FastAPI(
    title="MoLearn API",
    version="0.3.0",
    description=(
        "UniProtKB and NCBI Gene search and profiles, on-demand scientific "
        "exploration, and reviewer-only, source-grounded AI learning."
    ),
)


@app.middleware("http")
async def log_request(request: Request, call_next):
    start = monotonic()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        route = getattr(request.scope.get("route"), "path", None)
        if route != "/api/v1/health" or status >= 400:
            logger.info("%s", json.dumps({
                "event": "api_response",
                "route": route,
                "status": status,
                "duration_ms": round((monotonic() - start) * 1000),
            }))


app.include_router(health.router)
app.include_router(search.router)
app.include_router(entities.router)
app.include_router(genes.router)
app.include_router(exploration.router)
app.include_router(ai.router)
