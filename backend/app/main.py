from fastapi import FastAPI

from .routers import entities, genes, health, search

app = FastAPI(
    title="moLearn backend - slice 2",
    version="0.2.0",
    description=(
        "MVP hackathon: UniProt protein + NCBI Gene search and profiles. "
        "Two providers (UniProtKB, NCBI Gene); no DB, no auth, no Redis. "
        "See docs/DESIGN-backend-slice2.md and docs/HANDOFF-slice2.md."
    ),
)
app.include_router(health.router)
app.include_router(search.router)
app.include_router(entities.router)
app.include_router(genes.router)
