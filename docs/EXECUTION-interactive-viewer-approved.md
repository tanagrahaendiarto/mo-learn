# Approved local execution — interactive viewer

Date: 2026-11-28. Read DESIGN-interactive-structure-viewer.md and HANDOFF-interactive-structure-viewer.md first. This note records user approval; preserve both previous documents.

## Permissions and limits

Implement locally only in D:/Projects/MoLearn-3d-viewer. Install one pinned project Mol* dependency and update lockfile. No global installs, second renderer, backend changes, commits, pushes, merges, deployments, paid AI calls, docking, simulations, or unrelated features. Do not touch D:/Projects/MoLearn or its servers on 3000/8000. Use 3001 frontend and 8001 backend, AI disabled. Existing untracked frontend/AGENTS.md and design/handoff files must be preserved.

## Approved decisions

- Mol* only. npm metadata checked: 5.13.1 requires Node >=22, React >=16.14; current Node 22.23.2. Verify actual integration rather than treating metadata as proof.
- PDB default deposited coordinates with explicit label; biological assembly only when valid definitions can be correctly processed. AlphaFold predicted model. 6XRE entire complex is not p53.
- Exploration full-width row below existing profile/sidebar on protein AND gene. Preserve page cap, other panels and unrelated pages.
- Rotate/zoom/pan/reset, record selector, cartoon/stick, target focus versus target-only, small molecule/ion/water visibility, residue identity with keyboard/text alternative. First model only; defer residue-to-UniProt synchronization and additional confidence coloring.
- Initial heights desktop 480/mobile 360 px. Fetch timeout 30 seconds; response cap 25 MiB; rendered atoms after assembly expansion cap 250,000. Verify 6XRE on this laptop; do not silently raise limits.

## Executor environment note

Hermes resolves Node/npm under `C:/Users/ozane/AppData/Local/hermes/node/`, not Program Files. If executor PowerShell lacks PATH entries, use the absolute `node.exe` and `npm.cmd` there and prepend that directory to the process-local PATH. Do not change global PATH or install Node. Use headless Playwright Edge, not desktop UI automation, for browser evidence. Keep source searches narrow and avoid recursive node_modules dumps.

## Stage A — mandatory feasibility gate

Install pinned Mol*. Establish actual render, resize, picking, verified 6XRE target chain mapping, one biological assembly, RCSB/AlphaFold browser coordinate transport, typecheck/build, lazy loading with no viewer or coordinate loads before Structure opens. Record exact identities/operator and measurements, not screenshot-only evidence. Stop if library, scientific identity or transport blocker; do not build full toolbar on failed feasibility. Write new stage report under docs/.

## Stage B — only after A passes

Proceed without requesting approval again. Implement approved controls, exploration layout, fallback, lifecycle and regressions. Preserve metadata/source links when viewer fails. No backend edits without demonstrated necessity and separate approval.

## Verification and artifacts

Use existing Playwright with installed Edge (`channel: 'msedge'`); bundled Chromium absent, no browser install needed. TDD vertical slices: a runnable failing test before production behavior, then green. Inspect frontend/AGENTS.md and installed Next docs before edits.

Keep fixture/offline tests separate from real provider checks. Never hardcode chain M for all entries. Test author/label/residue/operator identities, fast switching, close/reopen, cleanup, failed provider, oversized structures, no WebGL. Test gene/protein at 1440/1024/768/390 px. Run frontend lint/typecheck/build, backend offline regression, relevant browser tests against this checkout only. Inspect test URL defaults before running.

Record actual bundle bytes and cold/warm render timings; no fabricated performance or universal FPS/RAM rules. Save browser screenshots and append-only stage/implementation reports to docs/ with test evidence, limitations and exact try-it commands. Code/docs English; final user report Indonesian. Do not print coordinate files or large JSON.
