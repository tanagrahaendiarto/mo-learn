/**
 * Capture visual-regression screenshots for Tasks A–G.
 *
 * Usage:
 *   CAPTURE_BASE_URL=http://localhost:3000 CAPTURE_PREFIX=live node tests/capture-screenshots.mjs
 *   CAPTURE_BASE_URL=http://localhost:3000 CAPTURE_PREFIX=demo CAPTURE_DEMO=true node tests/capture-screenshots.mjs
 *
 * Output: frontend/screenshots/<prefix>-<name>-<viewport>.png
 */

import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const BASE = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const PREFIX = process.env.CAPTURE_PREFIX ?? "live";
const DEMO = process.env.CAPTURE_DEMO === "true";

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "screenshots",
);
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

const ROUTES = [
  { path: "/", name: "landing" },
  { path: "/search?q=p53&page_size=2", name: "search-p53" },
  { path: "/entity/protein/P04637", name: "protein-profile" },
  { path: "/entity/gene/HGNC%3A11998", name: DEMO ? "gene-profile" : "gene-soon" },
  { path: "/glosarium", name: "glossary" },
];

const browser = await chromium.launch({ headless: true });

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
  });

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route.path}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.screenshot({
      path: path.join(OUT, `${PREFIX}-${route.name}-${vp.name}.png`),
      fullPage: true,
    });
  }

  // Collection with one saved item (proves identity/source layout).
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("molearn_collection"));
  await page.goto(`${BASE}/entity/protein/P04637`, { waitUntil: "networkidle" });
  const save = page.getByRole("button", { name: /Save to Collection|Remove from Collection/ });
  if (await save.isVisible()) {
    const pressed = await save.getAttribute("aria-pressed");
    if (pressed === "false") await save.click();
    await page.waitForTimeout(200);
  }
  await page.goto(`${BASE}/collection`, { waitUntil: "networkidle" });
  await page.screenshot({
    path: path.join(OUT, `${PREFIX}-collection-${vp.name}.png`),
    fullPage: true,
  });

  await page.close();
}

await browser.close();
console.log(`screenshots written to ${OUT} (prefix ${PREFIX})`);
