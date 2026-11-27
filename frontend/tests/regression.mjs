/**
 * moLearn regression test — routes, responsive layout, and search integration.
 *
 * Uses Playwright (already a devDependency — no new dependencies added).
 *
 * Prerequisite:
 *   - Frontend running on http://localhost:3000 (`npm run dev` or `npm start`).
 *   - Backend on http://localhost:8000 for the live search-integration check.
 *     If the backend is unreachable, that single check is reported as SKIP and
 *     does not fail the run.
 *
 * Run: npm run test:regression
 *
 * What it guards:
 *   1. Every route responds with the expected HTTP status and renders.
 *   2. No horizontal overflow at 1440x900 / 768x1024 / 390x844.
 *   3. No clipped headings (scrollWidth <= clientWidth) — this catches the
 *      Tailwind v4 `max-w-*` spacing/container collision that once collapsed
 *      every text container.
 *   4. When the backend is reachable, `/search?q=p53` renders protein result
 *      cards (proves the proxy + adapter path end-to-end).
 */

import { chromium } from "playwright";

const BASE = process.env.REGRESSION_BASE_URL ?? "http://localhost:3000";

const ROUTES = [
  { path: "/", name: "landing", status: 200 },
  { path: "/search?q=p53&page_size=2", name: "search", status: 200 },
  { path: "/search?q=TP53&page_size=2&type=Gene", name: "search-gene", status: 200 },
  { path: "/entity/protein/P04637", name: "entity-protein", status: 200 },
  { path: "/entity/gene/7157", name: "entity-gene", status: 200 },
  { path: "/collection", name: "collection", status: 200 },
  { path: "/glosarium", name: "glossary", status: 200 },
  { path: "/this-route-does-not-exist", name: "notfound", status: 404 },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function backendReachable() {
  try {
    const res = await fetch(`${BASE}/api/backend/api/v1/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const browser = await chromium.launch({ headless: true });

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
  });

  for (const route of ROUTES) {
    const response = await page.goto(`${BASE}${route.path}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    const status = response?.status() ?? 0;

    const layout = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflowX = doc.scrollWidth - doc.clientWidth;
      const clipped = [];
      for (const el of document.querySelectorAll("h1, h2, h3")) {
        if (el.scrollWidth > el.clientWidth + 2) {
          clipped.push((el.textContent || "").trim().slice(0, 40));
        }
      }
      return { overflowX, clipped };
    });

    check(
      `${vp.name} ${route.name} status`,
      status === route.status,
      `expected ${route.status}, got ${status}`,
    );
    check(
      `${vp.name} ${route.name} no overflow`,
      layout.overflowX <= 0,
      `overflowX=${layout.overflowX}`,
    );
    check(
      `${vp.name} ${route.name} no clipped heading`,
      layout.clipped.length === 0,
      layout.clipped.join(" | "),
    );
  }

  await page.close();
}

// Live search integration (only when the backend is reachable).
if (await backendReachable()) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/search?q=p53&page_size=2`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  const counts = await page.evaluate(() => ({
    protein: document.querySelectorAll('a[href^="/entity/protein/"]').length,
    gene: document.querySelectorAll('a[href^="/entity/gene/"]').length,
  }));
  check("live search renders protein cards", counts.protein > 0, `${counts.protein} cards`);
  check("live search renders gene cards", counts.gene > 0, `${counts.gene} cards`);

  await page.goto(`${BASE}/search?q=TP53&entity_type=gene&page_size=5`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  const filtered = await page.evaluate(() => ({
    gene: document.querySelectorAll('a[href^="/entity/gene/"]').length,
    protein: document.querySelectorAll('a[href^="/entity/protein/"]').length,
  }));
  check(
    "server-side Gene filter returns genes only",
    filtered.gene > 0 && filtered.protein === 0,
    `gene=${filtered.gene} protein=${filtered.protein}`,
  );
  await page.close();
} else {
  console.log("SKIP  live search integration — backend unreachable at /api/backend/api/v1/health");
}

await browser.close();

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed > 0) process.exit(1);
