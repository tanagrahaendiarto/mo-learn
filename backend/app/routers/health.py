from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["health"])

# Single source of truth: read from the FastAPI app so the version here can
# never drift from the OpenAPI version again.
def _app_version() -> str:
    from ..main import app

    return app.version


@router.get("/health")
def health():
    return {"status": "ok", "service": "molearn-backend", "version": _app_version()}
