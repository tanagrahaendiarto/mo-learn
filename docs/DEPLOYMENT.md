# Production deployment

This guide prepares a deployment. It does not record a completed public release.

## Hosting decision

Use **Vercel Pro + Render paid 0.5 CPU / 512 MB**, both in Singapore.
Budget **USD 27/month** at base rates: one Vercel Pro seat (USD 20) and one
Render paid instance (USD 7) in a USD 0 Hobby workspace. Taxes, usage, domains,
additional seats, and DeepSeek charges are separate. Confirm checkout pricing.

If the owner confirms the project meets [Vercel Hobby terms][hobby-terms],
use **Vercel Hobby + the same paid Render instance** for **USD 7/month**
before usage or taxes. Hobby is for personal or non-commercial use. It
includes one developer, 4 active CPU hours, 360 GB-hours of provisioned
memory and 100 GB fast transfer per month; features may pause at the cap.
Check eligibility for the actual competition and pilot.

Vercel Fluid Compute allows 300 seconds by default (Hobby maximum 300 seconds;
Pro configurable up to 800 seconds), with 2 GB RAM / 1 vCPU by default.
Select Singapore (`sin1`). Render's paid instance does not idle-spin-down.
Render Free spins down after 15 minutes, takes about a minute to wake, and
may suspend services making high outbound traffic. A cold start can consume
the entire 60-second scientific proxy timeout or exceed the 40-second AI
timeout. Free Render is suitable only for exploratory previews.

The three services with independent credentials are GitHub, Vercel, and
Render. A funded DeepSeek account is needed only for live reviewer AI.
Use a GitHub account with permission to grant each hosting integration
access to `tanagrahaendiarto/mo-learn`. Enable account MFA.

Sources checked 2026-11-28: [Vercel pricing][vercel-price],
[function limits][vercel-limits], [regions][vercel-regions],
[Hobby limits][hobby], [Render pricing][render-price],
[free compute][render-free], [Render regions][render-regions],
[FastAPI deployment][fastapi], [Render uv][render-uv], and
[Render web services][render-web].

## Production setup

1. Obtain approval for the specific Git commit, provider plans and spending,
   hosting access, and intended public exposure. Do not connect an unreviewed
   branch to production. Record deployment IDs and environment settings (names
   only). For initial deployment, disable automatic production deployments
   or use an approved deploy-only branch until the release gate passes.
2. In Render, create a Python **Web Service** from the GitHub repository, with
   root `backend`, branch `master`, region Singapore and instance `0.5c-512mb`.
   Use health path `/api/v1/health`. The root `render.yaml` records the same
   backend settings; creating a Blueprint may start billing and deploy a
   publicly reachable service, so wait for approval before importing it.
3. Set Render `PYTHON_VERSION=3.14.10` and `UV_VERSION=0.13.10`. Set the NCBI
   contact mailbox. Start with AI disabled. Render uses `uv.lock` in the
   service root and sets `PORT` (default `10000`).

   Build:

   ```sh
   uv sync --locked --no-dev
   ```

   Start:

   ```sh
   uv run --locked --no-dev uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --workers 1 --limit-concurrency 16 --timeout-keep-alive 5 --timeout-graceful-shutdown 45 --no-access-log
   ```

4. Check the Render HTTPS URL `/api/v1/health`. Require `status: ok`. Health
   measures liveness; it does not prove that upstream providers are available.
5. Import the same GitHub repository in Vercel. Set **Next.js**, root
   `frontend`, Node.js **24.x**, **Fluid Compute**, Function region `sin1`,
   and production branch `master`. Framework-managed start is automatic;
   do not use a static export. Set these commands:

   ```sh
   npm ci
   npm run build
   ```

   If self-hosting the production build, start from `frontend/` with
   `npm run start -- --hostname 0.0.0.0 --port "$PORT"`.
6. Set the deployment-scoped variables below. Configure Preview separately:
   use a dedicated backend or leave AI disabled there. The frontend server
   must reach the Render HTTPS endpoint from its selected region.
7. With approval, deploy the reviewed revision and run the
   [production smoke test](COMPETITION.md#production-smoke-test).
   Do not send the production URL to participants before UAT passes.

## Environment reference

| Owner | Variable | Production value or default |
| --- | --- | --- |
| Next.js server | `BACKEND_API_URL` | Required. HTTPS base origin of the intended backend, with no credentials or path. |
| Next.js build | `NEXT_PUBLIC_DEMO_MODE` | `false`. Public and inlined at build time. |
| Next.js server | `MOLEARN_AI_UI_ENABLED` | Default `false`. `true` only for reviewer access; FastAPI still authorizes. |
| Render | `PORT` | Platform-supplied listening port. |
| Render | `PYTHON_VERSION`, `UV_VERSION` | `3.14.10`, `0.13.10`. |
| FastAPI | `MOLEARN_NCBI_CONTACT_EMAIL` | Monitored project mailbox. [Register the tool `MoLearn` and email with NCBI](https://www.ncbi.nlm.nih.gov/books/NBK25497/). Sent to NCBI E-utilities in request parameters. |
| FastAPI | `MOLEARN_AI_ENABLED` | Default `false`. Set `true` only for an approved reviewer window. |
| FastAPI | `MOLEARN_LLM_API_KEY` | Dedicated application key. Required only if AI is enabled. |
| FastAPI | `MOLEARN_AI_ACCESS_CODE` | Separate random reviewer code, 32–128 URL-safe ASCII characters. Required only if AI is enabled. |
| FastAPI | `MOLEARN_LLM_BASE_URL`, `MOLEARN_LLM_MODEL` | Defaults `https://api.deepseek.com`, `deepseek-flash`. Leave the official provider URL unless deliberately changing providers. |
| FastAPI | `MOLEARN_AI_MAX_CALLS_PER_PROCESS` | Default `30`; use `2` for initial UAT and agree a cap for the demo/pilot. |
| FastAPI | `MOLEARN_AI_REQUESTS_PER_MINUTE`, `MOLEARN_AI_CONCURRENCY` | Defaults `6` and `2`. Start the supervised demo with concurrency `1`. |

Enter secrets only in the hosting dashboard's backend environment settings
or an ignored local backend `.env`. Keep reviewer credentials out of public
links, Git, support tickets, and screenshots. Use the [reviewer guide](SLICE3-AI.md).
The process quota counts attempts, resets on restart or redeploy, and
multiplies across instances and workers. A timed-out attempt may still be
billed. Keep one worker, avoid automatic top-ups where available, monitor
the provider dashboard, and agree a funded budget. The app has no durable
global budget or per-reviewer accounting.

## Monitoring and capacity

- Check Render liveness and memory/CPU metrics and review Vercel runtime logs
  for errors and timings. Use the hosting dashboards' deployment failure
  notifications. Check the proxy health URL separately before a demo.
- FastAPI reports route templates, status codes and durations in structured
  application logs. Production disables raw Uvicorn access logs. AI events
  contain bounded status and token data. Avoid request-header/body capture in
  host log drains. Verify approved preview logs before handling reviewer codes.
- The service caps concurrent connections/tasks at the Uvicorn layer and
  paces outgoing scientific calls per process. It has no per-user public
  scientific quota. Direct Render scientific routes are public; AI still
  requires the reviewer code. The Vercel firewall does not cover Render.
- Ensure outbound HTTPS reaches NCBI E-utilities/Datasets, UniProtKB, RCSB,
  AlphaFold, STRING v12.0, and DeepSeek when approved. Browser structure
  previews are fetched from provider hosts. Check them from the actual
  venue network. Hosting regions and provider availability can affect timing.
- Treat the 512 MB backend instance as a starting size. Verify live peak
  memory and concurrent pilot traffic in UAT before increasing capacity or
  opening wider access. Scaling changes provider pacing and AI budget behavior.

## Rollback

1. If AI misbehaves or spending spikes, set `MOLEARN_AI_ENABLED=false` on
   Render and redeploy that setting. Disable the frontend reviewer UI too.
   Rotate the reviewer code or revoke the LLM key if exposure is suspected.
2. For a release regression, pause automatic deploys. Restore a known-good,
   patched pair of revisions: use **Events → Rollback** on Render and
   **Deployments → Instant Rollback** on Vercel. Hobby Vercel can restore only
   the immediately previous production deployment. If an approved useful
   build does not exist, disable traffic instead of reverting to a vulnerable
   baseline. Recheck environment flags after restoration.
3. Verify backend and proxy health, search a canonical record, run the
   scientific smoke checks, confirm unauthorized AI is rejected, and record
   both deployment IDs. Collection data remains in the browser for the same origin.

[hobby-terms]: https://vercel.com/legal/terms#hobby-plan
[vercel-price]: https://vercel.com/pricing
[vercel-limits]: https://vercel.com/docs/functions/limitations
[vercel-regions]: https://vercel.com/docs/regions
[hobby]: https://vercel.com/docs/plans/hobby
[render-price]: https://render.com/pricing
[render-free]: https://render.com/docs/free
[render-regions]: https://render.com/docs/regions
[fastapi]: https://render.com/docs/deploy-fastapi
[render-uv]: https://render.com/docs/uv-version
[render-web]: https://render.com/docs/web-services
