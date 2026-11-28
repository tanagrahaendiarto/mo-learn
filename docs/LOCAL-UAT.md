# Local release run and manual UAT

Local-first run of the production-ready build. No public hosting is used.

## Configuration

`backend/.env` (ignored by Git) holds the reviewer-only AI settings:

```
MOLEARN_LLM_API_KEY=<provider key>
MOLEARN_AI_ENABLED=true
MOLEARN_AI_ACCESS_CODE=<48-character URL-safe code>
MOLEARN_NCBI_CONTACT_EMAIL=<project mailbox>
```

Read the reviewer code from the file instead of copying it into notes:

```sh
# backend/
Get-Content .env | Select-String '^MOLEARN_AI_ACCESS_CODE='
```

`frontend/.env.local` (ignored by Git) holds:

```
BACKEND_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_DEMO_MODE=false
MOLEARN_AI_UI_ENABLED=true
```

`MOLEARN_NCBI_CONTACT_EMAIL` is still unset in this workspace. Add a monitored
project mailbox before sharing the run, because NCBI E-utilities require a
contact address. Restart the backend after changing `.env`.

## Start

```sh
# backend/
uv run --locked --env-file .env uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --limit-concurrency 16 --timeout-keep-alive 5 --timeout-graceful-shutdown 45 --no-access-log

# frontend/
npm ci          # first run only
npm run build   # rebuild after code or NEXT_PUBLIC_* changes
npm run start -- --hostname 127.0.0.1 --port 3000
```

Backend <http://127.0.0.1:8000>, frontend <http://127.0.0.1:3000>.
Health: `/api/v1/health` and `/api/backend/api/v1/health`.

## Stop

Press `Ctrl+C` in each terminal, or stop the listeners by port:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000,8000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }
```

## Manual UAT checklist

Use real provider data. Mark each item PASS, FAIL, or NOT TESTED and note the
viewport. For AI items, use the reviewer code from `backend/.env`; each request
is a paid provider call.

| Area | Steps | Expect |
| --- | --- | --- |
| Search | Search `TP53` with Type All, then Gene only, then Protein only. | Gene and protein cards; filters return only that type; no demo badge. |
| Profile | Open Gene `7157`, then the linked protein `P04637`. | Correct organism, taxon 9606, linked identifiers, provenance links. |
| Beginner Explanation | On `7157`, enter the reviewer code and request an explanation. | Grounded text with the correct GeneID source link; no invented citations. |
| Study Companion | On `P04637`, ask which organism the record comes from. | Answer cites the protein record; unrelated question is refused safely. |
| Sequence / FASTA | Load Sequence on `P04637` and on a gene transcript. | Numbered sequence, copy, FASTA download, provenance header. |
| Literature | Load Literature on `P04637`. | Direct references marked; abstracts only when the license allows. |
| Structure / Ligand | Load Structure and Ligand on `P04637`. | Experimental PDB entries and AlphaFold predictions kept distinct; ligand list labelled as deposited components. |
| Interaction | Load Interaction on `P04637`. | STRING v12.0 partners, taxon check, channel scores, labelled functional (not physical binding). |
| Collection | Save `7157` and `P04637`, reload, remove one. | Records persist in this browser only; removal works. |
| Export | Download entity CSV and a module CSV/FASTA. | Identifiers and provenance present; formula-like text neutralized. |
| Responsiveness | Repeat search, profile, and collection at 1440x900, 768x1024, 390x844. | No horizontal overflow, readable type, 44 px touch targets, keyboard focus visible. |

## Known limitations

- AI quota is per backend process (`MOLEARN_AI_MAX_CALLS_PER_PROCESS`, default
  30) and resets on restart. A timed-out attempt may still be billed.
- Collections stay in one browser profile; there is no server database.
- Scientific routes have no per-user quota, because the backend is loopback only.
- The reviewer code is shared and not tracked per reviewer.
- Render/Vercel files stay in the repository for a later approved deployment.
