# MoLearn project checkpoint

- **Slice 3 branch:** `feat/fullstack-slice3-ai`, based on the verified Slice 2 merge `0ec41cf`.
- **Deliverables:** Slice 3 frontend, backend, tests, environment examples, uv lockfile, and documentation. See Git history for the current commit and merge status.
- **Implemented:** On-demand gene/protein explanations and contextual Q&A. FastAPI retrieves source records and validates citation IDs. The Next.js proxy permits only the two approved AI POST routes. The reviewer code gates paid calls; AI defaults to disabled.
- **Verified:** 123 offline backend and 18 live scientific-provider checks. Playwright passed 75 route/layout, 97 learning, 40 Slice 2 integration, and 34 mocked Slice 3 checks. Lint, typecheck, build, lockfile validation, and Semgrep passed. Six screenshots inspected at three viewport sizes. Mocked claims spot-checked against their source records. See `REPORT.md`.
- **Remediation verified:** 131 offline backend tests, 34 mocked Slice 3 browser checks, lint, typecheck, production build, and Semgrep passed. Q&A now selects validated source excerpts. An offline regression covers the DNA-damage passage omitted by the original context. The original rejected provider response was not retained.
- **Live recheck:** 3/3 through Chromium, Next.js, FastAPI, and DeepSeek Flash. Original DNA-damage question, cell division question, and corrected TP53 transcript/isoform explanation passed. Three screenshots inspected. Per-call metrics are in `REPORT.md`.
- **Gate: GO for reviewer-only Slice 3.** Three authorized live calls used. Anonymous AI stays disabled; the process quota is not durable.
- **Approval:** Reviewer-only Slice 3 was approved for commit, push, and PR merge if checks pass. Deployment and Slice 4 remain separate approval gates.
- **Remaining milestones:** Slice 4 scientific modules and export, production readiness, deployment, and pilot/submission materials.

## Slice 4 — scientific exploration

- **Branch:** `feat/fullstack-slice4-exploration` from merged Slice 3 `ba5a848`.
- **Sequence:** On-demand UniProtKB protein and NCBI RefSeq genomic DNA, transcript
  and CDS records with numbered viewer, clipboard, FASTA and provenance.
  139 offline tests and 16 browser checks passed (15 live, one mocked).
- **Literature:** PubMed direct references and organism-aware related search,
  with attribution and abstract rights handling. Four live entity checks,
  six live browser checks, and two offline literature cases passed.
- **Structure:** Chain-verified RCSB experimental records and independently
  verified AlphaFold predictions with previews and downloads. Four live route
  checks, six live browser checks, and two offline cases passed.
- **Ligand:** RCSB Chemical Component Dictionary metadata and verified deposited
  structures, with separate evidence for cofactor annotations. Live results
  confirmed on four entities and three browser viewports.
- **Interaction:** Verified STRING accession and taxonomy, bounded functional
  associations, channel scores, interactive map, and accessible list.
  Four live routes, six live browser checks, and two offline cases passed.
- **Export:** Entity, literature, structure, and STRING CSVs include identifiers
  and provenance, with formula protection. The numbered Sequence viewer exports
  the selected sequence as provenance-bearing FASTA.
- **Verified:** 146 offline backend tests, 22 live provider cases, and 49 Slice 4
  checks (41 live, three mocked, four proxy security, one offline CSV).
  Production build, lint, typecheck, uv lock check, and Semgrep passed.
  Previous browser suites passed 75 route/layout, 97 learning, 40 Slice 2,
  and 34 mocked Slice 3 checks. No paid AI requests were made.
- **Gate: GO for local Slice 4 verification.** Production readiness and
  deployment remain separate milestones.

## Slice 5 — production readiness

- **Branch:** `feat/production-readiness` from `master` `e46a7fc`.
- **Dependencies:** Next.js 16.2.6 → 16.4.6 cleared critical advisories;
  `npm audit` reports 0 vulnerabilities. `uv audit --locked` clean on Windows
  and Linux x86_64.
- **Hardening:** proxy and client timeouts, upstream JSON enforcement, redirect
  rejection, security headers, NCBI deadlines/paging/validation, bodies read
  with a 5-second cap, structured JSON request logs, strict GeneID parsing,
  NCBI attribution in the footer, and a single `<main>` landmark per page.
- **Verified:** 150 offline backend tests, 22 live provider cases, and browser
  suites at 75 route/layout, 97 learning, 43 Slice 2 (36 live, 7 simulated),
  49 Slice 4, and 34 mocked Slice 3 checks. Gitleaks (history, candidate tree,
  client bundle), Semgrep (76 files), dependency audits, lint, typecheck, and
  the production build passed. No paid AI calls were made.
- **Release assets:** `README.md`, `render.yaml`, `docs/DEPLOYMENT.md`,
  `docs/COMPETITION.md`, updated env examples and AI guide.
- **Hosting:** Vercel Pro + Render 0.5 CPU/512 MB, USD 27/month at base rates.
  Vercel Hobby is non-commercial only.
- **Gate: GO for production readiness.** Committed as `7fcdcf9` and merged to
  `master` via PR #7 (`a063634`). Release strategy is local-first: public
  deployment is postponed, and the Render/Vercel configuration is kept for a
  later approved release.
- **Local release run:** production-built frontend at `http://127.0.0.1:3000`
  and backend at `http://127.0.0.1:8000` use live providers with demo mode off.
  AI is reviewer-only. Manual UAT checklist: `docs/LOCAL-UAT.md`.
- **Open configuration:** `MOLEARN_NCBI_CONTACT_EMAIL` is still unset. No public
  deploy, paid hosting, or paid AI call has occurred.
