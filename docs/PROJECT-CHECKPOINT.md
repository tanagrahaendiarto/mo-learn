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
