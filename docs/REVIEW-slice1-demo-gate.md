# Slice 1 — demo gate verification

27 November 2026. Independent reviewer reran tests and postfix probe, and inspected updated adapter. No application edits, server restart, commit or push.

## Fresh evidence

From backend/:
```
.venv/Scripts/python.exe -m pytest tests/test_offline.py tests/test_api_live.py -q
65 passed, 1 warning in 5.33s
.venv/Scripts/python.exe ../docs/review_slice1_postfix_checks.py
```

60 offline + 5 live passed, no skips. Warning: Starlette/httpx deprecation. Probe confirmed (SIMULATIONS): missing/numeric identity -> 502; late successful response rejected; ABC123 and A0AAAAAAAA classified false; next link with preceding type parameter parsed ('abc', True).

## Decision

Happy-path slice 1 is suitable for LOCAL DEMO and starting frontend integration discussion. This is not approval for public deployment or a claim that every edge case is handled. No need to rebuild or repeat the entire design/review cycle. Next useful work: frontend API handoff and a small design for NCBI Gene/disambiguation, with approval before new implementation.

## Explicit residual limitations

1. Deadline is not hard elapsed-time cancellation. httpx timeout is phase/inactivity-based even when remaining budget is supplied; slow streaming can outlast the stated budget. Late rejection works, but user wait is not strictly capped at 35 seconds. Adapter docstring :178-183 still overstates 'per-request timeout'; describe this as soft budget + phase timeouts. 429/5xx sleeps :209/:216 are not clamped to remaining budget despite report wording. Real cancellation remains later hardening before public exposure.
2. Cursor charset [A-Za-z0-9_-]{1,200} remains an implementation restriction, not proven provider contract. Document as such; do not call it fully format-agnostic opaque handling. Current live pagination succeeds.
3. Link parser supports tested quoted rel values and parameter-order case, not full general RFC parsing. Do not claim complete RFC compliance. Prefer existing library parsing for later hardening rather than more regex layers.
4. Report IMPL-slice1-postfix.md says B4DMQ7 was previously false; previous review code already accepted it. This historical claim is inaccurate, not a current functional blocker.
5. 429/5xx/malformed probes are simulations. Network happy paths are live. No concurrency/load/deployment/security audit completed here.

## Handoff guidance

Keep backend local. Give frontend developer the actual OpenAPI and setup instructions, explicitly noting no automatic cursor reset: frontend drops cursor on query/page_size change. Their machine cannot access this laptop through their own 127.0.0.1; sharing source/setup or separately approved hosting is needed. Agree CORS or Next.js server-side proxy when wiring frontend; not verified yet.

For next development, propose NCBI Gene search/profile and provenance-backed gene-protein links without erasing the working protein contract. Do not add database/login/Redis merely for completeness. Review design before implementation.
