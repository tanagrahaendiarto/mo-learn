# Slice 5.1 — interactive structure viewer and exploration width

Status: **proposal awaiting approval; no feature implementation or viewer installation**.
Date: 2026-11-28. Workspace: `D:/Projects/MoLearn-3d-viewer`.
Branch/base inspected: `feat/interactive-structure-viewer`, `d928291`.

## 1. Scope and evidence

Preserve backend contracts, source verification, exports, learning panels, provider states, and reviewer-only AI controls. No simulations, docking, AI calls, arbitrary URL proxy, unrelated redesign, commit, push, merge, or deployment.

Source discussion is known only through the partial excerpts recorded in `HANDOFF-interactive-structure-viewer.md`; omitted passages are not requirements. The interaction details, layout solution, default view, and resource limits below are proposals, not recovered agreements.

Actual code inspected:

| Evidence | Consequence |
|---|---|
| `frontend/package.json`: Next 16.4.6, React 19.2.4, Tailwind 4, Playwright; no molecular viewer | Add one viewer only after approval; native CSS handles layout. |
| `StructureResults.tsx:8–62`: structure selector, provenance, coverage, static image, source/download links | Keep this shell; insert a client-only viewer without replacing metadata or exports. AlphaFold image is PAE, not a molecular rendering. |
| `ExplorationModules.tsx:59–125`: on-demand metadata fetch, abort, retry, expanded column spans, conditional child mounting | Reuse loading behavior. Closing module unmounts viewer; dispose resources and cancel pending work. |
| `entity/[type]/[id]/page.tsx:199–244,371`: exploration nested in two-thirds column inside `max-w-5xl` | Increasing viewer width alone cannot escape parent constraints. |
| `GeneProfile.tsx:94–132`: same nested exploration pattern | Fix both protein and gene exploration, not protein alone. |
| `lib/exploration.ts:50–60`, `backend/app/adapters/structure.py:20–77` | Contract has downloads and coverage, but no explicit assembly ID, label chain IDs, operators, or residue-level alignment. Keep wire contract unchanged. |
| `rcsb.py:85–97`: coverage verified against `auth_asym_ids` and matching UniProt reference | Experimental coverage chains are author IDs, not label IDs. Coverage ranges are not coordinate-residue numbering. |
| `structure.py:45–51` | Preview uses first reported assembly; `.cif` download is entry coordinates. Preview and loaded coordinates need separate labels. |
| `alphafold.py:13–46` | Existing identity/sequence checks and exact file-URL validation stay intact. Confidence is not experimental resolution. |

### Fresh bounded checks

Headless Playwright using installed Edge measured the expanded protein structure card, including its real computed parent widths. No screenshot interpretation or molecular coordinate dump was needed.

| Viewport | Profile inner grid | Expanded module/card | Inner card content | Horizontal page overflow at measurement |
|---|---:|---:|---:|---|
| 1440 px | 960 px | 632 px | 598 px | No |
| 768 px | 704 px | 461 px | 427 px | No |
| 390 px | 358 px | 358 px | 324 px | No |

These measurements establish the parent bottleneck, not complete loaded-content UAT. Gene layout was inspected in code, not measured in browser.

RCSB live metadata checks returned HTTP 200:
- `https://data.rcsb.org/rest/v1/core/entry/6XRE`: assembly IDs `["1"]`, 13 polymer entities, 2 non-polymer entities, model ID 1.
- GraphQL at `https://data.rcsb.org/graphql`, selecting only entity descriptions and chain/reference identifiers: `6XRE_13` is cellular tumor antigen p53, UniProt `P04637`, author chain `M`, label chain `M`. Other polymer entities are RNA polymerase subunits. **The whole 6XRE complex is not p53.** Do not hardcode M outside this fixture.
- Entry/entity metadata does not prove observed residues, assembly copy counts, or coordinate transport/CORS. Those remain acceptance checks.

Local frontend root returned 200; backend `/api/v1/health` returned 200/version 0.3.0. Initial `/health` and `/api/backend/health` guesses returned 404; these are wrong paths, not proof of backend failure. No server restart was needed, and ports 3000/8000 were not used.

## 2. Library decision: recommend Mol*, conditional on integration gate

**Recommend Mol* with a small embedded `PluginContext`, not its full standalone application.** Its structure/model/assembly semantics fit chain identity, transformed assembly copies, and residue picking better than maintaining scientific bookkeeping around a simpler canvas. Use its parser and structure model; do not write an mmCIF parser. Provide a small MoLearn toolbar rather than exposing all expert panels/extensions.

3Dmol.js is a credible alternative: official docs confirm mmCIF, cartoons/sticks, property selections, picking, and touch controls. It is attractive for a small coordinate-only viewer. It is not rejected as incapable of assembly handling. Mol* is preferred because this task explicitly requires assembly provenance and author/label identity; fewer application-owned scientific transformations outweigh a simpler initial embed.

Costs: Mol* integration and bundle size need measurement. Do not claim a size or React 19 compatibility result before testing. Official docs warn that the full Viewer wrapper includes optional extensions; avoid video export, density streaming, trajectories and unrelated tools. No CDN `@latest`, iframe, library fork, or second renderer.

After approval: inspect installed Next lazy-loading guidance, choose/pin a compatible Mol* release, run build/typecheck and a small real render/picking/assembly check. If that gate fails, report evidence and request a revised library decision; do not silently install both libraries.

References consulted:
- https://molstar.org/docs/v5/
- https://molstar.org/docs/v5/plugin/instance/
- https://3dmol.org/doc/ (redirects to official 3Dmol documentation)

## 3. Viewer behavior and integration boundary

Keep `StructureResults` responsible for the existing record selector, scientific labels, coverage, and links. Add one small client-only viewer component. Dynamically import the viewer/library only when the structure module has valid records and is open. No coordinate request or viewer chunk on initial page load or opening another module.

Proposed defaults: first model, deposited entry coordinates for PDB; supplied prediction coordinates for AlphaFold. Show full loaded structure with verified target chains highlighted and other polymers subdued. Never label a multi-protein complex merely “p53.” No automatic animation.

Controls:
- Rotate, zoom, pan; reset camera; visible zoom and rotation buttons for keyboard users.
- Structure selector remains grouped experimental/predicted.
- Full loaded structure, focus target, and target-only modes; focus changes camera, target-only explicitly changes visibility. Disable target controls with explanation when mapping is unavailable/ambiguous.
- Cartoon for polymers by default; sticks for selected residues/small molecules. Offer cartoon/stick choice without forcing an entire large complex into costly sticks by default.
- Separate visibility for non-polymer small molecules/ions and water; preserve other polymers including nucleic acids. A ligand toggle must not mean “hide every non-target chain.” No claim that a displayed component is an inhibitor or binding site.
- Click/tap residue or component to populate a textual identity panel; selection also available through labeled chain and observed-residue controls. Show source/model, component/residue name, author chain/number/insertion code, label chain/sequence ID when available, and assembly copy/operator when relevant.
- Mouse/touch gestures use documented bindings of the pinned version and visible help. Exact pan gesture remains to be verified; no promise based on another library’s bindings. Preserve page scrolling outside canvas and provide an explicit touch interaction affordance.

Use `ResizeObserver`; do not use viewport-sized canvas widths. Abort coordinate fetch on switch/unmount. A monotonically increasing request generation must guard asynchronous import, parse, and representation creation as well as download: slow A must never replace selected B. Dispose stale results, renderer, observers, handlers and subscriptions, including React development remounts. Keep only active structure resources; reset stale selection on structure/model/assembly changes.

### Frontend/backend fit and responsibility

User ownership is frontend: interactive rendering, user controls, and existing Structure/Exploration layout. Backend remains scientific source of truth; frontend consumes its verified records rather than re-resolving protein identity through a new provider API.

| Need | Existing backend contract | Frontend responsibility / gap policy |
|---|---|---|
| Structure identity and provenance | `kind`, `protein_accession`, source fields, methods | Preserve labels and selector; no new identity endpoint. |
| Coordinates | `downloads[{format,url}]` | Prefer supplied mmCIF; browser fetch, validation, parsing and fallback. No new backend download route. |
| Target chain | `coverage[{chain,start,end}]` | Match author chains to parsed polymer identities; unknown mapping stays unknown. |
| Biological assembly | Not explicit in JSON; entry mmCIF download supplied | Read assembly definitions/operators from the file. Never derive assembly from preview URL. No backend change required for this proposal. |
| Ligands and observed residue identity | Not in structure JSON | Read coordinate entities/residues; keep separate existing ligand module untouched. |
| Confidence and resolution | `mean_plddt`, `resolution_angstrom`, PAE preview | Retain distinct scientific meaning; no inferred measurements. |

**No backend edits proposed.** Missing mmCIF assembly metadata yields coordinate-only mode, not an automatic contract extension. If the approved scope later requires assembly metadata before downloading coordinates, exact UniProt residue alignment, or reliable transport where browser CORS fails, document a concrete failing case and propose the smallest additive backend change for separate approval. Any future transport endpoint must accept validated provider identifiers, not arbitrary URLs, and preserve existing response compatibility, timeouts and security. These are conditional needs, not implementation authorization.

## 4. Chain and residue semantics

Resolve experimental target chains by matching backend `coverage.chain` to parsed polymer **author** chain IDs, then retain corresponding label chain/entity IDs. Do not zip independently returned author/label arrays or assume both namespaces are identical. Restrict matching to polymer chains so a non-polymer sharing an author ID is not called target protein.

Internal selection identity must retain model + label chain + author chain + label sequence ID + author residue number + insertion code, plus operator/copy identity for assemblies. These are proposed viewer-local fields, not a new backend response contract. Missing fields remain unknown.

The UniProt coverage range is contextual sequence coverage, not an offset for converting coordinate numbering. Report only observed residues as selectable. Gaps remain gaps. Do not reconstruct unresolved residues or infer UniProt residue numbers from author numbering. Exact residue-to-UniProt synchronization would require validated alignment (e.g. SIFTS) and is deferred.

For AlphaFold, keep backend protein/sequence validation; resolve supplied chain identity against parsed coordinates. If absent/ambiguous, show model without verified target highlighting. Do not assume every prediction uses chain A. Mean pLDDT stays separate from experimental resolution; per-residue confidence colors are optional only if parsed values and their semantics are verified. PAE image remains separately labeled.

## 5. Assembly handling

Do not infer assembly ID from thumbnail URL. For experimental mmCIF, use parsed assembly definitions/operators through Mol*, retaining original chain identity plus transformed copy identity.

Proposed initial default is **deposited coordinates**, explicitly labeled. Offer an assembly selector only for valid parsed assembly definitions; choosing one constructs that biological assembly through library operations and displays assembly ID. Never relabel raw entry coordinates as a biological assembly merely because an assembly preview exists.

Target selection in an assembly includes verified copies of the mapped polymer chain and distinguishes those copies in picking. No symmetry expansion beyond chosen biological assembly. Missing/invalid assembly metadata means coordinate-only view plus notice and external RCSB link. Assembly failure must not silently display coordinates under the previous assembly label.

AlphaFold is labeled “Predicted model”; no biological-assembly claim. Multiple-model files start at model 1 with an explicit label; model switching is deferred pending scope approval.

## 6. Width correction

Keep global navbar/footer and unrelated pages unchanged. Recommended minimal layout change:
1. Keep the existing entity page `max-w-5xl` cap and profile/sidebar layout. Fix exploration's nested two-thirds constraint first; do not widen or redesign unrelated profile content. A larger exploration-only cap is an optional follow-up requiring evidence and approval, not part of this default proposal.
2. Move exploration into a full-width sibling section after the profile main/sidebar row in both protein and gene views. Preserve evidence/advanced panels and Study Companion in their existing profile containers; only relocate the exploration section. Do not duplicate panels or use viewport-breakout hacks.
3. Preserve current expanded-card spans; add `min-w-0` at relevant grid/flex boundaries. Expanded modules use full exploration width, not only viewer.
4. Proposed viewer height: 480 px desktop, 360 px mobile; toolbar wraps, metadata stays readable below canvas. At short landscape heights allow normal page scrolling rather than clipping controls. No global `overflow-x:hidden` masking a defect.

At 1440 px, keeping the current cap yields a proposed 960 px exploration width instead of 632 px, before card padding; verify actual computed result after implementation. Sidebar remains present, but not beside expanded exploration. If simultaneous sidebar/viewer visibility is required, that needs a different approved layout.

## 7. Failure, security and resource policy

Keep metadata, static preview (when available), downloads and source links visible for unsupported WebGL, lost context, failed chunk/download, CORS denial, timeout, malformed file, oversized structure, or renderer failure. PAE fallback must never be described as a 3D preview. Retry is explicit and scoped; no infinite retry loop. Empty/no verified records mounts no viewer.

Use browser downloads only from validated HTTPS provider URLs already in the contract: exact RCSB download origin/path and AlphaFold files origin/path. Reject credentials, unexpected ports, arbitrary hosts and unsupported formats; omit credentials/referrer. Validate redirect destination, or reject redirects rather than following to unapproved origins. Do not let library defaults contact unrelated model/density services. No server-side proxy or URL input.

Proposed safety limits, pending calibration: 30-second coordinate fetch timeout, 25 MiB streamed response cap even without Content-Length, and 250,000 rendered atoms after assembly expansion. Check expanded size before allocating representations; use fallback with reason rather than freezing browser. Confirm these limits allow 6XRE on target hardware; revise explicitly if they do not.

## 8. Acceptance plan — not yet executed

| Gate | Required evidence |
|---|---|
| Lazy loading | Network trace: zero viewer chunk/coordinate traffic before opening structure; one active viewer afterward. Record cold/warm first-render time, transferred JS/CSS/coordinate bytes, and baseline versus new build chunk sizes. No invented bundle budget. |
| Scientific identity | Deterministic fixture for 6XRE/P04637 highlights polymer M only; full complex remains distinguishable. Separate fixture has differing author/label chain IDs, insertion codes, missing residues and shared non-polymer author ID. Unknown mapping disables target actions. |
| Assemblies | Coordinate and assembly modes have correct labels and independently checked copy counts; picks retain operator identity. Missing/invalid assembly definitions and expansion limit use honest fallback. |
| Interaction | Rotate/zoom/pan/reset, representation, focus versus target-only, component visibility, residue click and keyboard/text alternative work. Selection resets on switching. |
| Races/lifecycle | Delay A then select B; B wins through import/parse/render. Close/reopen/navigate away repeatedly; no growing active canvas/context count, leaked handlers or late state updates. Context-loss fallback works. |
| Failure/security | Simulate 404, timeout, CORS denial, bad mmCIF, oversized stream, absent WebGL, chunk failure and disallowed/redirected origin. Text, metadata and links remain usable; no arbitrary proxy or paid AI traffic. |
| Responsive layout | Measure gene and protein at 1440, 1024, 768 and 390 px plus 200% zoom/short landscape. Expanded card spans exploration container within rounding; no page overflow; controls/metadata visible; learning/evidence panels retained. |
| Regression | Existing sequences/FASTA, literature/CSV, structure CSV, ligand and interaction modules, relationship explorer, collection, source/provenance, empty/partial/error states and reviewer-only AI restrictions remain intact. |

Use deterministic intercepted metadata and local coordinate fixtures with recorded source/license/provenance for browser tests; explicitly label synthetic edge fixtures. Real RCSB/AlphaFold smoke checks are separate, not a requirement for offline test success. Never print coordinate files into model context.

Planned checks after approval: frontend `npm run lint`, `npm run typecheck`, `npm run build`; backend existing offline pytest suite with live marker excluded; focused fixture browser tests; then optional live scientific smoke. Existing `tests/slice4-exploration.mjs` defaults to port 3124 and mixes live/intercepted checks. Set `EXPLORATION_BROWSER_URL=http://127.0.0.1:3001` explicitly and inspect other suites individually. Do not accidentally run against 3000/8000.

Tool constraints: Playwright package 1.65.1 is available, but its bundled Chromium executable is absent. Installed Edge launched successfully for the width probe; use an explicitly selected Edge test channel or request browser-install approval later. Node is 22.23.2, not README's recommended 24. Earlier handoff test results are historical; no full regression/build suite was rerun for this documentation-only task.

## 9. Decisions requiring approval

1. Mol* over 3Dmol.js, with pinned-version integration gate and no full expert UI.
2. Coordinate-first default plus explicit biological-assembly selection, versus assembly-first default. Source excerpts do not decide this.
3. Full-width exploration below main/sidebar row; sidebar retained but not adjacent to viewer.
4. Proposed minimal controls, first-model-only scope, deferred residue-to-UniProt synchronization, and optional confidence coloring. These were not confirmed verbatim by source discussion.
5. Proposed sizing and resource limits; acceptable target devices and performance/bundle thresholds remain unspecified.

Approval should explicitly authorize local implementation and installation of the chosen viewer dependency. It does not authorize commit/push/merge/deploy or paid AI. Until approval, changes are limited to this new document.

Tool selection followed `project-toolkit` and catalog `C:/Users/ozane/Documents/Tool Inventory/DAILY-TOOLS.md` (snapshot 27 November): existing Git/Node/Playwright, bounded source reads, official docs and metadata probes. No graph exists in this worktree; stale old-worktree graph was not used. `token-saver` applied as bounded output/batched reads, without changing proxy settings or invoking external advisors.
