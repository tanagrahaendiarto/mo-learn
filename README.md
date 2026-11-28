# MoLearn

MoLearn is an educational browser for molecular biology. It helps learners
follow a gene or protein from a search result to its original scientific
evidence. It is intended for demonstrations and supervised learning, not for
clinical decisions.

- Search NCBI Gene and UniProtKB together or filter to Gene or Protein.
- Follow verified GeneID cross-references and inspect organism and taxonomy.
- Open sequences, literature, structures, chemical components, and STRING
  functional associations on demand. Export the available records as CSV or FASTA.
- Save records in a collection stored in the current browser.
- Authorized reviewers can generate a beginner explanation or ask the Study
  Companion to select relevant source excerpts. Both are disabled by default.

## Local setup

Use Node.js 24, npm, Python 3.14, and uv. From `backend/`:

```sh
uv sync --locked
uv run --locked uvicorn app.main:app --host 127.0.0.1 --port 8000
```

From `frontend/`, copy `.env.example` to `.env.local`, then run:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. To check a production build, use `npm run build`
then `npm start`. The frontend also provides `npm run lint`, `npm run typecheck`,
and the Playwright scripts listed in `frontend/package.json`. The backend's
offline regression is `uv run --locked pytest -m "not live"` from `backend/`.
For a native Playwright installation, run `npx playwright install chromium`
from `frontend/`. The reviewer-only AI setup and the local manual test checklist
are in [docs/LOCAL-UAT.md](docs/LOCAL-UAT.md).

## Architecture and API

Next.js renders search and profile pages with server-to-server requests.
Browser interactions use the same-origin, allowlisted `/api/backend` proxy.
FastAPI validates requests, retrieves provider records, and returns provenance.
The backend and the browser have no server-side collection database. When
enabled, FastAPI alone has the LLM key and authorizes each AI request.

| Method | Backend endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | Process liveness and API version |
| GET | `/api/v1/search` | `q`, `entity_type=all\|gene\|protein`, `page_size=1..100`, optional opaque `cursor` |
| GET | `/api/v1/entities/gene/{gene_id}` | NCBI Gene profile |
| GET | `/api/v1/entities/protein/{accession}` | UniProtKB protein profile |
| GET | `/api/v1/entities/{gene\|protein}/{id}/{module}` | `sequence`, `literature`, `structure`, `ligand`, or `interaction` |
| POST | `/api/v1/ai/explain`, `/api/v1/ai/ask` | Reviewer-only learning endpoints |

FastAPI publishes schemas at `/docs` and `/openapi.json` on the backend. The
browser adds `/api/backend` to the API paths above. Exploration responses
distinguish `available`, `empty`, `unavailable`, `partial`, and `provider_error`.
Live provider failures never switch the application to demo data.

## Sources and limitations

| Source | Attribution and rights |
| --- | --- |
| [UniProtKB](https://www.uniprot.org/help/license) | UniProt Consortium, CC BY 4.0 |
| [NCBI Gene, RefSeq, and PubMed](https://www.ncbi.nlm.nih.gov/home/about/policies/) | Acknowledge NCBI/NLM and follow record-specific rights and disclaimers. Abstracts are reproduced only with an explicit supported license (CC BY 4.0 or CC0 1.0); otherwise MoLearn links to PubMed. |
| [RCSB PDB and CCD](https://www.rcsb.org/pages/policies) | PDB archive data: CC0 1.0. Credit RCSB PDB and cite the entry and original authors where possible. Integrated external data may have separate terms. |
| [AlphaFold DB](https://alphafold.ebi.ac.uk/faq) | Google DeepMind and EMBL-EBI, CC BY 4.0 for predictions. Predictions remain distinct from experimental structures. |
| [STRING](https://string-db.org/cgi/download) | Published network data: CC BY 4.0. MoLearn uses STRING v12.0 and labels the edges as functional associations, which do not establish direct physical interaction. |

Gene name search covers human records; exact GeneID lookup is not limited to
humans. Genomic DNA, transcripts, coding sequences, and protein sequences are
distinct records. Sequences exceeding 100,000 bases and some complex CDS
records may be unavailable. Structure viewers open on provider sites. A
deposited chemical component does not establish a biological binding role or
affinity. An AI citation does not guarantee scientific accuracy. Collections
do not sync across devices or browser profiles.

## Release resources

- [Local release run and manual UAT checklist](docs/LOCAL-UAT.md)
- [Deployment, configuration, monitoring, and rollback](docs/DEPLOYMENT.md)
  (prepared, not yet executed)
- [Reviewer setup and AI API contract](docs/SLICE3-AI.md)
- [Competition demo, UAT checklist, and pilot instrument](docs/COMPETITION.md)
- [Project checkpoint](docs/PROJECT-CHECKPOINT.md) and [verification report](REPORT.md)

AI assistance was used during development. The project team is responsible
for inspecting changes, verifying behavior, and reporting results.
