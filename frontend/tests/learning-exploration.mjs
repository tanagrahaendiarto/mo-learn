/**
 * moLearn — Learning Exploration regression (Tasks A–G).
 *
 * Uses Playwright (existing devDependency). No new dependencies.
 *
 * Prerequisite: frontend running on BASE (default http://localhost:3000).
 *   - In live mode, the backend must be reachable for the protein profile.
 *   - Demo checks (gene template, demo badges) only run when
 *     LEARNING_DEMO=true points at a demo-mode server.
 *
 * Run:
 *   LEARNING_BASE_URL=http://localhost:3000 node tests/learning-exploration.mjs
 *   LEARNING_DEMO=true LEARNING_BASE_URL=http://localhost:3001 node tests/learning-exploration.mjs
 */

import { chromium } from "playwright";

const BASE = process.env.LEARNING_BASE_URL ?? "http://localhost:3000";
const DEMO = process.env.LEARNING_DEMO === "true";

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

/* ---------- helpers ---------- */

async function goto(path) {
  const res = await page.goto(`${BASE}${path}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  return res?.status() ?? 0;
}

async function clearCollection() {
  await goto("/");
  await page.evaluate(() => localStorage.removeItem("molearn_collection"));
}

async function collectionCount() {
  await goto("/collection");
  return page.evaluate(
    () => document.querySelectorAll("main article").length,
  );
}

const saveButton = () =>
  page.getByRole("button", { name: /Save to Collection|Remove from Collection/ });

/* ============================================================
   A. Collection — save, persist, dedup, remove, navigate
   ============================================================ */

await clearCollection();

// Profile has a working Save button.
let status = await goto("/entity/protein/P04637");
check("profile loads (live or demo)", status === 200, `status ${status}`);

const savedBefore = await saveButton().getAttribute("aria-pressed");
check("save button present and unsaved", savedBefore === "false", `aria-pressed=${savedBefore}`);

await saveButton().click();
await page.waitForFunction(
  () =>
    /Remove from Collection/.test(
      document.querySelector("button[aria-pressed]")?.textContent ?? "",
    ),
  { timeout: 5000 },
);
check("saved state toggles to remove", true);

// Persistence after reload + dedup-aware state.
await page.reload({ waitUntil: "networkidle" });
const afterReload = await saveButton().getAttribute("aria-pressed");
check("collection state persists after reload", afterReload === "true", `aria-pressed=${afterReload}`);

const afterSaveCount = await collectionCount();
check("exactly one saved record (no duplicate)", afterSaveCount === 1, `${afterSaveCount} items`);

// Identity display: identifier, organism, source.
await goto("/collection");
const cardText = await page.evaluate(
  () => document.querySelector("main article")?.textContent ?? "",
);
check("collection shows identifier", cardText.includes("P04637"));
check("collection shows organism", cardText.includes("Homo sapiens"));
check("collection shows source", cardText.includes("UniProt"));

// Navigation back to the correct profile.
await page.getByRole("link", { name: "Open Profile" }).first().click();
await page.waitForURL(/\/entity\/protein\/P04637/);
check("navigate from collection to profile", /\/entity\/protein\/P04637/.test(page.url()), page.url());

// Remove.
await goto("/entity/protein/P04637");
await saveButton().click();
await page.waitForTimeout(300);
const afterRemoveCount = await collectionCount();
check("remove deletes the record", afterRemoveCount === 0, `${afterRemoveCount} items`);

/* ============================================================
   A2. Legacy record: unknown provenance, NOT auto-demo
   ============================================================ */

const legacy = [
  {
    type: "protein",
    id: "LEGACY1",
    name: "Legacy Record",
    organism: "Homo sapiens",
    savedAt: "2026-01-01T00:00:00Z",
  },
];
await page.evaluate(
  (data) => localStorage.setItem("molearn_collection", data),
  JSON.stringify(legacy),
);
await goto("/collection");
const legacyText = await page.evaluate(
  () => document.querySelector("main article")?.textContent ?? "",
);
check("legacy record preserved", legacyText.includes("Legacy Record"));
check("legacy provenance shown as unknown", legacyText.includes("Unknown source"));
check("legacy NOT mislabeled as demo", !/Demo/.test(legacyText));

await clearCollection();

/* ============================================================
   B. Profile sections (honest states)
   ============================================================ */

await goto("/entity/protein/P04637");
const bodyText = await page.evaluate(() => document.body.textContent ?? "");
for (const heading of [
  "In simple terms",
  "Key biological functions",
  "Original scientific annotation",
  "Source & evidence",
  "Related entities",
  "Advanced details",
  "Exploration modules",
  "Study Companion",
]) {
  check(`profile section: ${heading}`, bodyText.includes(heading));
}
check("profile shows identifier", bodyText.includes("P04637"));
check("profile shows organism", bodyText.includes("Homo sapiens"));
check("no fabricated localization", !/Cytoplasm, nucleus/.test(bodyText));

const identity = await page.evaluate(() => ({
  h1: document.querySelector("h1")?.textContent?.trim() ?? "",
  emText: [...document.querySelectorAll("main em")].map(
    (el) => el.textContent?.trim() ?? "",
  ),
  pubmed: [...document.querySelectorAll('a[href^="https://pubmed.ncbi.nlm.nih.gov/"]')].map(
    (a) => a.getAttribute("href") ?? "",
  ),
  details: [...document.querySelectorAll("details summary")].map(
    (s) => s.textContent?.trim() ?? "",
  ),
}));

check(
  "h1 is the protein name (not the gene symbol)",
  identity.h1 === "Cellular tumor antigen p53",
  identity.h1,
);
check("gene symbol shown separately", bodyText.includes("Gene symbol"));
check(
  "organism displayed in italics",
  identity.emText.includes("Homo sapiens"),
  identity.emText.join(" | "),
);

if (!DEMO) {
  check(
    "raw annotation prose preserved",
    bodyText.includes("Multifunctional transcription factor"),
  );
  check(
    "no inline PubMed citation markers",
    !bodyText.includes("PubMed:"),
  );
  check(
    "PubMed references are clickable",
    identity.pubmed.length > 0 &&
      identity.pubmed.every((href) =>
        /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/.test(href),
      ),
    `${identity.pubmed.length} links`,
  );
  check(
    "annotation collapsed into expandable details",
    identity.details.some((t) => t.includes("Original scientific annotation")),
  );
  check(
    "annotation provenance shown",
    bodyText.includes("Unedited text from UniProt"),
  );
}

/* ============================================================
   D. Relationship explorer — labels, evidence, list fallback
   ============================================================ */

check("relationship label present", bodyText.includes("cross-reference"));
check("relationship evidence present", /Cross-reference from/.test(bodyText));
check("selected node details present", bodyText.includes("Selected node"));
check("accessible list heading present", bodyText.includes("Relationships"));

/* ============================================================
   F. Exploration modules — honest states
   ============================================================ */

check("module unavailable state shown", bodyText.includes("Unavailable"));
check("module export available", bodyText.includes("Download CSV"));

/* ============================================================
   C. Glossary — required terms
   ============================================================ */

await goto("/glosarium");
const glossaryText = await page.evaluate(() => document.body.textContent ?? "");
const terms = [
  "Gene",
  "Protein",
  "Enzyme",
  "Hormone",
  "Accession",
  "GeneID",
  "Organism",
  "Taxonomy ID",
  "Amino acid",
  "Reviewed entry",
  "Unreviewed entry",
  "Cross-reference",
  "Gene–protein relationship",
  "Biological sequence",
  "Experimental structure",
  "Predicted structure",
];
for (const t of terms) {
  check(`glossary term: ${t}`, glossaryText.includes(t));
}

/* ============================================================
   E. Gene template (demo mode only)
   ============================================================ */

if (DEMO) {
  status = await goto("/entity/gene/HGNC%3A11998");
  check("gene template loads", status === 200, `status ${status}`);
  const geneText = await page.evaluate(() => document.body.textContent ?? "");
  for (const h of [
    "About",
    "Gene function",
    "Synonyms",
    "Chromosomal location",
    "Related proteins",
    "Source & evidence",
    "Demo",
  ]) {
    check(`gene template: ${h}`, geneText.includes(h));
  }
  check("gene template has honest unavailable field", geneText.includes("not available yet"));
  // Related protein link navigates to a protein profile.
  const relHref = await page.evaluate(() => {
    const a = [...document.querySelectorAll("a")].find((x) =>
      /\/entity\/protein\//.test(x.getAttribute("href") ?? ""),
    );
    return a?.getAttribute("href") ?? null;
  });
  check("gene related-protein link present", Boolean(relHref), relHref ?? "none");

  // Demo badge on demo protein profile.
  await goto("/entity/protein/P04637");
  const demoBody = await page.evaluate(() => document.body.textContent ?? "");
  check("demo profile labelled Demo", demoBody.includes("Demo"));
  check("demo profile has beginner summary", demoBody.includes("guardian") || demoBody.includes("Guardian"));
} else {
  // Live mode: gene stays Coming Soon (honest, no speculative endpoint).
  status = await goto("/entity/gene/HGNC%3A11998");
  const liveGene = await page.evaluate(() => document.body.textContent ?? "");
  check("live gene still Coming Soon", status === 200 && liveGene.includes("Coming Soon"));
}

/* ============================================================
   Responsive: no overflow / clipped headings on new pages
   ============================================================ */

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];
const RESP_ROUTES = [
  "/collection",
  "/glosarium",
  "/entity/protein/P04637",
  ...(DEMO ? ["/entity/gene/HGNC%3A11998"] : []),
];

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  for (const route of RESP_ROUTES) {
    await goto(route);
    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflowX = doc.scrollWidth - doc.clientWidth;
      const clipped = [];
      for (const el of document.querySelectorAll("h1, h2, h3, h4")) {
        if (el.scrollWidth > el.clientWidth + 2) {
          clipped.push((el.textContent || "").trim().slice(0, 40));
        }
      }
      return { overflowX, clipped };
    });
    check(`${vp.name} ${route} no overflow`, layout.overflowX <= 0, `overflowX=${layout.overflowX}`);
    check(`${vp.name} ${route} no clipped heading`, layout.clipped.length === 0, layout.clipped.join(" | "));
  }
}

await browser.close();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed > 0) process.exit(1);
