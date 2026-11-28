/**
 * moLearn — Slice 2 integration test (NCBI Gene + unified search).
 *
 * Live section runs against a real stack:
 *   - Next.js frontend on LIVE_BASE_URL (default http://localhost:3000)
 *   - MoLearn FastAPI backend behind the Next proxy
 *   Checks: unified search filters, exact identifier routing, gene profile,
 *   verified gene↔protein navigation, collection identity, legacy migration.
 *
 * SIMULATED section runs against a second frontend pointed at
 * tests/stub-backend.mjs (not a real provider):
 *   - SIM_BASE_URL (e.g. http://localhost:3001), STUB_URL=http://127.0.0.1:8099
 *   Checks: partial provider failure keeps healthy results, empty-after-failure
 *   is distinct from "no such entity", unreachable backend does not fall back
 *   to fixtures. Skipped when SIM_BASE_URL is not set.
 *
 * Uses Playwright only. No new dependencies.
 */

import { chromium } from "playwright";

const LIVE = process.env.LIVE_BASE_URL ?? "http://localhost:3000";
const SIM = process.env.SIM_BASE_URL;
const STUB = process.env.STUB_URL ?? "http://127.0.0.1:8099";

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function goto(base, path) {
  const res = await page.goto(`${base}${path}`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  return res?.status() ?? 0;
}

async function text() {
  return page.evaluate(() => document.body.textContent ?? "");
}

const saveButton = () =>
  page.getByRole("button", { name: /Save to Collection|Remove from Collection/ });

async function clearCollection(base) {
  await goto(base, "/");
  await page.evaluate(() => localStorage.removeItem("molearn_collection"));
}

/* ============================================================
   1. Contract version through the proxy
   ============================================================ */

const health = await fetch(`${LIVE}/api/backend/api/v1/health`);
const healthBody = await health.json();
check(
  "backend contract version is 0.3.0",
  health.ok && healthBody.version === "0.3.0",
  `status ${health.status} version ${healthBody.version}`,
);

/* ============================================================
   2. Unified search — All / Gene / Protein, server-side
   ============================================================ */

await goto(LIVE, "/search?q=TP53&page_size=5");
const allCounts = await page.evaluate(() => ({
  gene: document.querySelectorAll('a[href^="/entity/gene/"]').length,
  protein: document.querySelectorAll('a[href^="/entity/protein/"]').length,
  geneDisabled: (() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.textContent?.trim() === "Gene",
    );
    return b ? b.disabled : null;
  })(),
}));
check("All: mixed gene+protein results", allCounts.gene > 0 && allCounts.protein > 0, JSON.stringify(allCounts));
check("Gene filter is enabled", allCounts.geneDisabled === false);

await goto(LIVE, "/search?q=TP53&entity_type=gene&page_size=5");
const geneOnly = await page.evaluate(() => ({
  gene: document.querySelectorAll('a[href^="/entity/gene/"]').length,
  protein: document.querySelectorAll('a[href^="/entity/protein/"]').length,
}));
check("Gene filter returns genes only", geneOnly.gene > 0 && geneOnly.protein === 0, JSON.stringify(geneOnly));

await goto(LIVE, "/search?q=TP53&entity_type=protein&page_size=5");
const proteinOnly = await page.evaluate(() => ({
  gene: document.querySelectorAll('a[href^="/entity/gene/"]').length,
  protein: document.querySelectorAll('a[href^="/entity/protein/"]').length,
}));
check("Protein filter returns proteins only", proteinOnly.gene === 0 && proteinOnly.protein > 0, JSON.stringify(proteinOnly));

/* ============================================================
   3. Exact identifier routing (never degrades to name search)
   ============================================================ */

await goto(LIVE, "/search?q=7157");
const geneIdText = await text();
const geneIdHref = await page.evaluate(
  () => document.querySelector('a[href^="/entity/gene/"]')?.getAttribute("href") ?? null,
);
check("exact GeneID 7157 resolves to the gene record", geneIdHref === "/entity/gene/7157", geneIdHref ?? "none");
check("exact GeneID result carries no unrelated name matches", !geneIdText.includes("Cellular tumor antigen p53"));

await goto(LIVE, "/search?q=7157&entity_type=protein");
check(
  "GeneID under Protein filter explains the exclusion",
  (await text()).includes("GeneID Excluded by Filter"),
);

await goto(LIVE, "/search?q=P04637&entity_type=gene");
check(
  "protein accession under Gene filter explains the exclusion",
  (await text()).includes("Protein Accession Excluded by Filter"),
);

await goto(LIVE, "/search?q=P04637&entity_type=protein");
const accHref = await page.evaluate(
  () => document.querySelector('a[href^="/entity/protein/"]')?.getAttribute("href") ?? null,
);
check("exact accession P04637 resolves to the protein", accHref === "/entity/protein/P04637", accHref ?? "none");

/* ============================================================
   4. Gene profile — real NCBI data, canonical GeneID
   ============================================================ */

await goto(LIVE, "/entity/gene/7157");
const genePage = await text();
check("gene profile: symbol", genePage.includes("TP53"));
check("gene profile: organism", genePage.includes("Homo sapiens"));
check("gene profile: chromosome", genePage.includes("17p13.1"));
check("gene profile: source link", await page.evaluate(() => Boolean(document.querySelector('a[href="https://www.ncbi.nlm.nih.gov/gene/7157"]'))));
check("gene profile: no Coming Soon", !genePage.includes("Coming Soon"));
await goto(LIVE, "/search?q=TP53");
const searchNote = await text();
check(
  "search states human-only gene name limitation",
  searchNote.includes("Gene name search currently covers human genes only"),
);
check(
  "search states exact GeneID lookup is unrestricted",
  searchNote.includes("Exact GeneID lookup is not restricted"),
);

/* ============================================================
   5. Verified relationships both directions
   ============================================================ */

await goto(LIVE, "/entity/gene/7157");
const geneToProtein = await page.evaluate(
  () => document.querySelector('a[href="/entity/protein/P04637"]') !== null,
);
check("gene 7157 → protein P04637 verified link", geneToProtein);
check("gene→protein evidence label", (await text()).includes("GeneID cross-reference"));

await goto(LIVE, "/entity/protein/P04637");
const proteinToGene = await page.evaluate(
  () => document.querySelector('a[href="/entity/gene/7157"]') !== null,
);
check("protein P04637 → gene 7157 verified link", proteinToGene);
check("protein→gene evidence label", (await text()).includes("GeneID cross-reference"));

/* ============================================================
   6. Invalid / nonexistent identifiers
   ============================================================ */

check("non-numeric GeneID returns 404", (await goto(LIVE, "/entity/gene/abc")) === 404);
check("zero GeneID returns 404", (await goto(LIVE, "/entity/gene/0")) === 404);
check(
  "nonexistent GeneID returns 404",
  (await goto(LIVE, "/entity/gene/999999999")) === 404,
);

/* ============================================================
   7. Cursor pagination
   ============================================================ */

await goto(LIVE, "/search?q=TP53&page_size=2");
const before = await page.evaluate(
  () => document.querySelectorAll('a[href^="/entity/"]').length,
);
const more = page.getByRole("button", { name: /^Load More$/ });
if (await more.isVisible()) {
  await more.click();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(
    () => document.querySelectorAll('a[href^="/entity/"]').length,
  );
  check("Load More appends results", after > before, `${before} → ${after}`);
} else {
  check("Load More available for multi-page query", false, "button not visible");
}

/* ============================================================
   8. Collection — distinct gene and protein identities
   ============================================================ */

await clearCollection(LIVE);

await goto(LIVE, "/entity/gene/7157");
await saveButton().click();
await page.waitForTimeout(300);
await page.reload({ waitUntil: "networkidle" });
check(
  "gene save persists after reload",
  (await saveButton().getAttribute("aria-pressed")) === "true",
);

await goto(LIVE, "/entity/protein/P04637");
await saveButton().click();
await page.waitForTimeout(300);

await goto(LIVE, "/collection");
const collectionText = await text();
const items = await page.evaluate(() => document.querySelectorAll("main article").length);
check("gene and protein stored separately", items === 2, `${items} items`);
check("collection keeps GeneID", collectionText.includes("7157"));
check("collection keeps protein accession", collectionText.includes("P04637"));
const openHrefs = await page.evaluate(() =>
  [...document.querySelectorAll('a[href^="/entity/"]')].map((a) =>
    a.getAttribute("href"),
  ),
);
check(
  "collection links use canonical routes",
  openHrefs.includes("/entity/gene/7157") && openHrefs.includes("/entity/protein/P04637"),
  openHrefs.join(" "),
);

/* ============================================================
   9. Legacy collection migration — verified mapping only
   ============================================================ */

const legacy = [
  {
    type: "gene",
    id: "HGNC:11998",
    name: "Tumor protein p53",
    organism: "Homo sapiens",
    source: "NCBI Gene",
    savedAt: "2026-01-01T00:00:00Z",
  },
  {
    type: "gene",
    id: "HGNC:99999",
    name: "Unmapped legacy gene",
    organism: "Homo sapiens",
    savedAt: "2026-01-01T00:00:00Z",
  },
];
await page.evaluate(
  (data) => localStorage.setItem("molearn_collection", data),
  JSON.stringify(legacy),
);
await goto(LIVE, "/collection");
const migratedText = await text();
check("verified legacy HGNC:11998 migrates to 7157", migratedText.includes("7157"));
check("migration provenance is shown", migratedText.includes("Migrated from HGNC:11998"));
check("unmapped legacy record is preserved", migratedText.includes("HGNC:99999"));
await clearCollection(LIVE);

/* ============================================================
   SIMULATED provider failures (stub backend, not a real provider)
   ============================================================ */

async function setStubMode(mode) {
  const res = await fetch(`${STUB}/__mode/${mode}`);
  if (!res.ok) throw new Error(`stub mode ${mode} failed`);
}

if (SIM) {
  console.log("\n--- SIMULATED provider scenarios (stub backend) ---");

  await setStubMode("partial");
  await goto(SIM, "/search?q=p53&page_size=5");
  const partialText = await text();
  const partialCards = await page.evaluate(
    () => document.querySelectorAll('a[href^="/entity/protein/"]').length,
  );
  check(
    "SIMULATED partial: warning names the failed provider",
    partialText.includes("Some providers did not respond") &&
      partialText.includes("NCBI Gene"),
  );
  check(
    "SIMULATED partial: healthy results stay visible",
    partialCards > 0,
    `${partialCards} cards`,
  );
  check(
    "SIMULATED partial: not reported as a hard error",
    !partialText.includes("Unable to Load Results"),
  );

  await setStubMode("partial-empty");
  await goto(SIM, "/search?q=zzzz");
  const emptyText = await text();
  check(
    "SIMULATED empty-after-failure is distinct from no-match",
    emptyText.includes("No Results From Available Providers"),
  );
  check(
    "SIMULATED empty-after-failure keeps the warning",
    emptyText.includes("Some providers did not respond"),
  );

  await setStubMode("down");
  let downStatus = 0;
  try {
    downStatus = await goto(SIM, "/search?q=p53");
  } catch {
    downStatus = -1;
  }
  const downText = await text();
  check(
    "SIMULATED backend down shows an error state",
    downText.includes("Unable to Load Data") || downText.includes("Unable to Load Results"),
    `status ${downStatus}`,
  );
  check(
    "SIMULATED backend down does not substitute fixtures",
    !downText.includes("Guardian of the genome"),
  );

  await setStubMode("ok");
} else {
  console.log("\nSKIP  SIMULATED provider scenarios — set SIM_BASE_URL to run them");
}

await browser.close();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed > 0) process.exit(1);
