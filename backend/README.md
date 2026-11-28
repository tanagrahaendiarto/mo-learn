# MoLearn backend

FastAPI serves NCBI Gene and UniProtKB search and profiles. Slice 3 adds optional,
reviewer-only AI learning. Python 3.11+ and uv are required.

## Local setup

From `backend/`:

```sh
uv sync --locked
uv run --locked uvicorn app.main:app --host 127.0.0.1 --port 8000
```

OpenAPI: [JSON](http://127.0.0.1:8000/openapi.json) or [Swagger UI](http://127.0.0.1:8000/docs).
Liveness: `GET /api/v1/health`. No credentials or AI requests are needed for search or profiles.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/search` | Unified search, entity filter, cursor pagination |
| GET | `/api/v1/entities/gene/{gene_id}` | NCBI Gene profile |
| GET | `/api/v1/entities/protein/{accession}` | UniProtKB protein profile |
| POST | `/api/v1/ai/explain` | On-demand explanation |
| POST | `/api/v1/ai/ask` | On-demand contextual answer |

See the [Slice 2 contract](../docs/SLICE2-CONTRACT-FINAL.md) for search and profile behavior.
See the [Slice 3 API and runbook](../docs/SLICE3-AI.md) for AI access, results, and verification.

## Tests

```sh
uv run --locked pytest -m "not live"
uv run --locked pytest -m live tests/test_api_live.py
```

The live suite uses a running backend on port 8000 by default. Set `LIVE_BASE_URL` to
override it. Run this suite separately from live browser regression to avoid provider bursts.

## Production process

Build with `uv sync --locked --no-dev` from `backend/`. Start with the host's configured port:

```sh
uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
```

Set secrets in the hosting environment and serve through HTTPS. Use `/api/v1/health`
for liveness. Keep AI disabled for the public release until a durable global cost
limit has been verified.
