from fastapi import FastAPI

from .routers import entities, health, search

app = FastAPI(
    title="moLearn backend - slice 1",
    version="0.1.0",
    description=(
        "MVP hackathon: UniProt protein search + profile. Single provider "
        "(UniProt); no DB, no auth, no cross-provider fallback. See "
        "DESIGN-backend-slice1.md and IMPL-slice1.md in docs/."
    ),
)
app.include_router(health.router)
app.include_router(search.router)
app.include_router(entities.router)
