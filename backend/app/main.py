from fastapi import FastAPI

from .routers import ai, entities, genes, health, search

app = FastAPI(
    title="MoLearn API",
    version="0.3.0",
    description=(
        "UniProtKB and NCBI Gene search and profiles, plus restricted, "
        "source-grounded AI learning."
    ),
)
app.include_router(health.router)
app.include_router(search.router)
app.include_router(entities.router)
app.include_router(genes.router)
app.include_router(ai.router)
