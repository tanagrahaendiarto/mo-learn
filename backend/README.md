# moLearn backend — slice 1 (MVP hackathon)

UniProt protein search + profile, stateless, single provider. Python + FastAPI + httpx, venv via `uv`.

## Setup (tested on this machine)
```bash
cd D:/Projects/MoLearn/backend
uv sync            # creates .venv, writes uv.lock
```

## Run
```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```
- Interactive API docs: `http://127.0.0.1:8000/docs`
- OpenAPI schema: `http://127.0.0.1:8000/openapi.json`
- Bound to 127.0.0.1 only (not all interfaces).

## Endpoints (slice 1)
| Method & path | Purpose |
|---|---|
| `GET /api/v1/health` | liveness |
| `GET /api/v1/search?q=&cursor=&page_size=` | protein search (accession or name), cursor pagination via UniProt Link header |
| `GET /api/v1/entities/protein/{accession}` | full protein profile |

Search notes:
- `q` required; empty/whitespace → 422. Accession pattern (`[A-Z][A-Z0-9]{5}`, e.g. P04637) → `match_mode=exact_accession`; otherwise plain name is escaped into a quoted `protein_name:"..."` term (backslashes stripped, `"` escaped, max 100 chars) → `match_mode=name`.
- `page_size` default 10, min 1, max 100. No `page` param.
- `cursor` is opaque: validated (`^[A-Za-z0-9_-]{1,200}$`), sent only as a query parameter to `https://rest.uniprot.org/uniprotkb/search`, never as a URL. URLs, `*`, and >200-char tokens → 400 `cursor_invalid`.
- `next_cursor` is read from the UniProt `Link` header `rel="next"` (validated: https, host `rest.uniprot.org`, path `/uniprotkb/search`), **never** from JSON items. `null` only when a successful response has no next link.
- Changing `q` or `page_size` invalidates the cursor (pagination restarts).
- Empty result = HTTP 200, `provider_status=not_found` (data empty ≠ error).

Errors (consistent shape `{"status":..., "detail":...}`):
- provider 5xx/timeout after retry → 502/504 `provider_error`
- 429 → `provider_error` `rate_limited_by_uniprot` (Retry-After honored only if ≤ 3 s)
- malformed upstream JSON → 502 `upstream_uniprot_malformed`

## Tests (tested commands)
```bash
# offline (fixtures: real UniProt p1/p2 + P04637 payloads; error cases labeled SIMULASI)
uv run pytest tests/test_offline.py
# live, explicit — starts the local server first, then hits it end-to-end
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 &
uv run pytest -m live tests/test_api_live.py
```
Skip/fail on the live marker = integration UNVERIFIED, not broken.

## Stop server
`Ctrl+C` in the uvicorn terminal, or `taskkill /F /PID <pid>` (find via `netstat -ano | findstr :8000`).
