# Slice 3 — AI learning API and verification

## Enable restricted review

AI is disabled by default. For a local review, copy `backend/.env.example` to
ignored `backend/.env`. Set `MOLEARN_AI_ENABLED=true`, a dedicated application
`MOLEARN_LLM_API_KEY`, and a random `MOLEARN_AI_ACCESS_CODE` with 32–128
URL-safe ASCII characters (`A–Z`, `a–z`, `0–9`, `_`, `-`). Start from `backend/`:

```sh
uv run --locked --env-file .env uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Set `MOLEARN_AI_UI_ENABLED=true`, `BACKEND_API_URL`, and `NEXT_PUBLIC_DEMO_MODE=false`
in `frontend/.env.local` for local reviewer access. The provider key stays in
FastAPI. Enter only the separate reviewer code in the UI; it stays in page memory
for the entity session. Use HTTPS outside loopback. Revoke access by changing the
code or disabling AI and restarting. Demo pages keep AI disabled.

For hosted setup, see [the deployment guide](DEPLOYMENT.md#environment-reference).
Create a reviewer code in a password manager using at least 32 random
URL-safe characters. Give the code to an authorized reviewer through a
separate secure channel. In the entity profile, enter it in reviewer access
and explicitly request an explanation or submit a question. Do not enter the
LLM key in the UI. Rotate the shared code after a demonstration or pilot.

DeepSeek defaults to `deepseek-flash` in non-thinking JSON mode. The adapter
sends no tools, sequence data, or conversation history. It caps output at 600
tokens and model time at 20 seconds. The API limits body size to 8 KiB and model
context to 10,000 UTF-8 bytes. Questions are at most 600 characters. Biological
lookup waits at most 15 seconds; a timed-out synchronous lookup holds its slot
until it ends. The proxy deadline is 40 seconds. One attempt per generation;
the user can retry. Logs contain provider status, available token counts, and
validation outcomes. They do not retain credentials, prompts, or raw output.

Defaults: 30 model attempts per process lifetime, six admitted requests per minute,
and two concurrent requests per process. Limits apply across explain and ask,
including failed model attempts. They reset on restart and multiply across
workers. They are not a durable spending limit. Do not share reviewer codes
publicly or enable anonymous usage without a verified global spending cap.

## HTTP contract

The same-origin Next.js proxy accepts POST only for:

| Route | JSON body |
|---|---|
| `/api/v1/ai/explain` | `{"entity_type":"gene","entity_id":"7157"}` |
| `/api/v1/ai/ask` | `{"entity_type":"protein","entity_id":"P04637","question":"Which organism does this record come from?"}` |

Prefix both paths with `/api/backend` when calling through Next.js. Send
`Content-Type: application/json` and `X-MoLearn-AI-Access` with the reviewer code.
The direct backend also requires `Content-Length`. Responses are not cached.
Browsers do not supply biological facts, URLs, provider settings, or source IDs.

Both return `200` with `entity_type`, `entity_id`, `status`, `answer`,
`key_functions`, `terms`, `sources`, and `limitations`. `generated` includes
`answer: {text, source_ids}`. Functions use the same shape; terms add `term`.
Sources contain `id`, `provider`, `entity_id`, `url`, and `retrieved_at`.
`insufficient_evidence` returns a null answer and empty content/source arrays.
The `/ask` endpoint returns no functions or terms. The model selects up to
three supplied passage IDs; the server assembles the answer and citations.
The model cannot add free-form claims. The browser labels this AI-selected
source evidence. Passage selection can still miss relevant evidence.

| HTTP | Status or condition |
|---|---|
| 403 | `access_required` |
| 404 | `not_found` for a missing canonical record |
| 408 / 411 / 413 / 415 | Slow body, missing body length, oversized body, or unsupported media type |
| 422 | Invalid identifier, malformed request, or invalid question |
| 429 | `rate_limited` or `quota_exhausted` |
| 502 | `provider_error`, including malformed output or unverified citations |
| 503 | `unavailable`, including missing configuration |
| 504 | `timeout` |

AI uses the current NCBI Gene and UniProtKB records. Protein links for a gene
come from UniProtKB GeneID cross-references. These links establish database
mappings; they are not experimental evidence. Claims cite only IDs present in
the prompt's source set. The server constructs returned citation links from the
retrieved records. Citation validation does not establish scientific accuracy,
and prompt isolation does not guarantee that the model follows its instructions.

## Verify

- Offline backend: `uv run --locked pytest -m "not live"`.
- Mocked browser: start `serve_ai_mock.py` with `backend/` on `PYTHONPATH`. Point a
  production-built Next.js server at `http://127.0.0.1:8014` and enable the UI.
  Run `npm run test:slice3` from `frontend/`. By default, it expects reviewer
  frontend port 3002 and disabled frontend port 3000. Screenshots go in
  `frontend/screenshots/`. This exercises the real proxy and FastAPI routes
  with saved biological records and a simulated model.
- Bounded live review, **only after explicit paid-call approval**: configure a
  dedicated funded key and a separate reviewer code, use one local backend
  worker, and set the process cap to four.
  Set `MOLEARN_VERIFY_LIVE_AI=true` for the test process. Run
  `uv run --locked --env-file .env pytest -m live tests/test_ai_live.py -s -q`.
  It makes at most four paid attempts, without automatic retries. Review each
  successful claim against the linked source before recording the result.
  For the initial hosted release, use the smaller two-call
  [production smoke test](COMPETITION.md#production-smoke-test).

Official provider reference: [DeepSeek models and pricing](https://api-docs.deepseek.com/quick_start/pricing/),
[JSON output](https://api-docs.deepseek.com/guides/json_mode/),
and [thinking mode](https://api-docs.deepseek.com/guides/thinking_mode/).
