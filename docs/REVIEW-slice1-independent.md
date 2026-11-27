# Independent review — backend slice 1

Date: 27 November 2026. Scope: read application code, rerun existing tests, execute targeted read-only probes. Application code not modified. No commit/push. Existing server left running.

## Verdict

Happy path works. Not ready to call complete or hand off as a stable frontend contract until the high-priority defects below are fixed. Passing existing tests does not cover these defects.

## Fresh execution evidence

Working directory: `D:/Projects/MoLearn/backend`.

```text
.venv/Scripts/python.exe -m pytest tests/test_offline.py tests/test_api_live.py -q
26 passed, 1 warning in 6.37s
```

This comprises 21 offline tests and 5 live tests through the existing local server. No skips. Warning: Starlette TestClient httpx deprecation; not a failing test and not justification for a blind dependency upgrade.

Additional reproducible probe:

```text
.venv/Scripts/python.exe ../docs/review_slice1_checks.py
```

The probe prints observations rather than asserting that current defects are fixed. It uses MockTransport for explicitly simulated upstream failures; its final two GETs are real network requests. Application files are unchanged.

## Findings

### High — valid 10-character accessions rejected
- Location: `app/adapters/uniprot.py:30,73-74`; `app/routers/entities.py:26-31`.
- Actual live evidence: UniProt `GET /uniprotkb/A0A024RBG1.json` returns 200 and primaryAccession A0A024RBG1; local profile for the same accession returns 422.
- Current regex only accepts six characters and is too broad within those six: INSULI is treated as an accession. Lowercase p04637 is classified as a name by search while the profile route normalizes case.
- Fix using verified UniProt accession syntax covering 6 and 10 characters; make normalization deliberate and consistent. Add regressions for valid 6/10-character IDs and names that must not be classified as accessions.

### High — upstream error JSON becomes a successful empty protein
- Location: `app/adapters/uniprot.py:115-172,183-224`.
- SIMULATION: upstream HTTP 403 with `{"messages":["Forbidden"]}` yields local HTTP 200, accession empty, status available.
- SIMULATION: upstream HTTP 200 with `{}` also yields HTTP 200/available with no identity.
- Cause: unhandled HTTP statuses are passed through; retrieve accepts any dict; mapping manufactures empty identity/default availability.
- Fix: validate success status before parsing records, validate essential identity and expected record shape, return structured provider_error for malformed/error payloads. Missing optional fields remain allowed; missing identity is not optional.

### High — connection failures and malformed nested fields escape as HTTP 500
- Location: `app/adapters/uniprot.py:120-126,183-224`; router mapping outside provider try blocks.
- SIMULATION: httpx.ConnectError produces plain HTTP 500 Internal Server Error, not structured provider_error.
- SIMULATION: HTTP 200 record with proteinDescription as a list produces plain HTTP 500.
- Fix: catch appropriate transport exceptions, classify unexpected provider schema safely, preserve structured error body. Add endpoint regressions.

### Medium — invalid next link silently means end of pagination
- Location: `app/adapters/uniprot.py:97-112`.
- SIMULATION: a next link with wrong host returns None, indistinguishable from legitimate absence of next link. Cursor pattern also guesses allowed characters.
- Security boundary correctly avoids requesting arbitrary URL, but malformed next links should be reported as malformed provider pagination rather than silent end-of-results.
- Retain fixed upstream host/path, use bounded opaque tokens, distinguish no next relation from invalid next relation.

### Medium — cursor reset documented but not implemented
- Location: `app/routers/search.py:9,37,54-57`; README:31.
- SIMULATION: q='different name', page_size=9, cursor='oldToken' forwards all three unchanged to UniProt.
- There is no local detection/reset. Cheapest correction: clearly make frontend responsible for dropping cursor when q/page_size changes, remove claims that backend resets automatically. Stronger binding is optional, not necessary for this slice.

### Medium — error contract missing from OpenAPI
- Location: endpoint decorators in search.py and entities.py.
- Generated profile operation lists only 200 and 422; 404/429/502/504 response models absent.
- Frontend will rely on this contract. Document implemented error responses without adding unnecessary abstractions.

### Medium — no total wall-clock request deadline
- Location: adapter client timeout and retry loop.
- httpx timeout=20 bounds individual network phases/inactivity, not a total elapsed deadline. Retries add further duration. No actual global deadline implementation found.
- Define and enforce bounded overall provider-call duration or revise the claimed guarantee. Live tests use 30-second client timeout, shorter than two potential 20-second waits plus backoff.

## Test coverage gaps

Existing suite does not exercise ConnectError, 429 handling, timeout handling, 10-character accession, malformed nested objects, or rejected next-link distinction. Existing accession mock test asserts match_mode but not successful nonempty accession result. The purported malformed-JSON test supplies a valid JSON string, testing wrong top-level shape rather than broken JSON syntax. Add separate tests for both.

Do not simulate real provider failures by presenting them as live observations. New probes here explicitly label simulated cases.

## Suggested next task for implementer

Fix high-priority identity/status/transport issues first with failing regression tests, then pagination/contract/documentation issues. Rerun the full offline suite and the five live checks. Two live pagination pages suffice; do not crawl to the last page. Keep scope UniProt-only, no database/login/provider expansion. Review before commit/push.

## Files created by this review
- `docs/REVIEW-slice1-independent.md`
- `docs/review_slice1_checks.py`

Server was reachable at http://127.0.0.1:8000 during rerun. Existing server/process was not started, stopped, or reconfigured by reviewer.
