/** Scientific UI checks. Provider calls are live unless explicitly intercepted. */
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { toCsv } from "../src/lib/csv.ts";

const base = process.env.EXPLORATION_BROWSER_URL ?? "http://127.0.0.1:3124";
const screenshots = process.env.EXPLORATION_SCREENSHOT_DIR ?? "screenshots";
const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

const browser = await chromium.launch();
let passed = 0;

function check(mode, label, condition) {
  assert.ok(condition, label);
  passed++;
  console.log(`PASS ${mode} ${label}`);
}

async function downloadAsText(page, name) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return readFile(await (await event).path(), "utf8");
}

try {
  await mkdir(screenshots, { recursive: true });
  const columns = [{ key: "cell", label: "Cell" }];
  const escaped = toCsv([{ cell: 'Title, "quote"\r\nnext line' }, { cell: " =1+1" },
    { cell: "\t@SUM(A1)" }, { cell: "－1+2" }, { cell: -2 }], columns);
  check("OFFLINE", "CSV escapes delimiters and neutralizes spreadsheet formulas",
    escaped === 'Cell\r\n"Title, ""quote""\r\nnext line"\r\n\' =1+1\r\n\'\t@SUM(A1)\r\n\'－1+2\r\n-2');
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    const page = await browser.newPage({ viewport, permissions: ["clipboard-read", "clipboard-write"] });
    let requests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/backend/") && request.url().endsWith("/sequence")) requests++;
    });
    const gene = viewportName !== "desktop";
    const path = gene ? "/entity/gene/7157" : "/entity/protein/P04637";
    assert.equal((await page.goto(base + path)).status(), 200);
    const load = page.getByRole("button", { name: "Load sequence" });
    await load.waitFor();
    check("LIVE", `${viewportName} sequence is on demand`, requests === 0);
    await load.click();
    await page.getByLabel("Numbered sequence").waitFor({ timeout: 28_000 });
    check("LIVE", `${viewportName} sequence fetched once`, requests === 1);
    if (gene) {
      const select = page.getByLabel("Sequence type");
      assert.equal(await select.locator("option").count(), 3);
      await select.selectOption({ label: "Coding sequence (CDS)" });
    }
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download FASTA" }).click();
    const download = await downloadEvent;
    const fasta = await readFile(await download.path(), "utf8");
    const [header, ...lines] = fasta.trim().split("\n");
    const sequence = lines.join("");
    check("LIVE", `${viewportName} FASTA provenance and length`,
      header.includes(gene ? "NM_000546.6:143-1324(+)" : "P04637") &&
      header.includes("taxid=9606") && sequence.length === (gene ? 1182 : 393));
    await page.getByRole("button", { name: "Copy sequence" }).click();
    await page.getByText("Sequence copied.", { exact: true }).waitFor();
    check("LIVE", `${viewportName} clipboard matches FASTA`, await page.evaluate(() => navigator.clipboard.readText()) === sequence);
    check("LIVE", `${viewportName} no page overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const card = page.getByRole("heading", { name: "4. Sequence" }).locator("xpath=../..");
    await card.evaluate((element) => element.scrollIntoView({ block: "start" }));
    await card.screenshot({ path: join(screenshots, `slice4-sequence-${viewportName}.png`) });
    await page.getByRole("button", { name: "Hide sequence" }).click();
    await page.getByRole("button", { name: "Load literature" }).click();
    const directHeading = page.getByRole("heading", { name: "Directly linked publications" });
    await directHeading.waitFor({ timeout: 45_000 });
    const directArticle = directHeading.locator("..").getByRole("listitem").first();
    const relatedHeading = page.getByRole("heading", { name: "Search-based related literature" });
    check("LIVE", `${viewportName} publication metadata and source links`,
      await directArticle.getByRole("link", { name: /PubMed · PMID/ }).count() === 1 &&
      /https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/[0-9]+\//.test(await directArticle.getByRole("heading").getByRole("link").getAttribute("href")) &&
      await relatedHeading.locator("..").getByRole("listitem").count() > 0);
    if (!gene) {
      const csv = await downloadAsText(page, "Download literature CSV");
      check("LIVE", "literature CSV includes identifiers, provenance and relationship type",
        csv.includes("source_url,retrieved_at,result_status") && csv.includes("PubMed,4006916,https://pubmed.ncbi.nlm.nih.gov/4006916/") &&
        csv.includes(",direct,UniProtKB,") && csv.includes(",related,PubMed entity and organism search,"));
    }
    check("LIVE", `${viewportName} literature no page overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole("heading", { name: "5. Scientific Literature" }).locator("xpath=../..")
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: join(screenshots, `slice4-literature-${viewportName}.png`) });
    await page.getByRole("button", { name: "Hide literature" }).click();
    await page.getByRole("button", { name: "Load structure" }).click();
    const structureSelect = page.getByLabel("Select a structure");
    await structureSelect.waitFor({ timeout: 38_000 });
    const experiment = page.getByRole("img", { name: "RCSB PDB biological assembly rendering" });
    await experiment.waitFor();
    await experiment.scrollIntoViewIfNeeded();
    await experiment.evaluate((image) => image.decode());
    check("LIVE", `${viewportName} experimental structure and preview`,
      await page.getByText(/Resolution: [\d.]+ Å/).count() === 1 &&
      await page.getByRole("link", { name: "Download mmCIF" }).count() === 1);
    if (!gene) {
      const heading = page.getByRole("heading", { name: "1. Structure" });
      await heading.evaluate((element) => {
        element.scrollIntoView({ block: "start" });
        window.scrollBy(0, -100);
      });
      await page.screenshot({ path: join(screenshots, "slice4-structure-experimental-desktop.png") });
    }
    await structureSelect.selectOption({ label: "AF-P04637-F1" });
    const prediction = page.getByRole("img", { name: "AlphaFold predicted aligned error heatmap" });
    await prediction.scrollIntoViewIfNeeded();
    await prediction.evaluate((image) => image.decode());
    check("LIVE", `${viewportName} AlphaFold confidence and preview`,
      await page.getByText(/Mean pLDDT: [\d.]+ \/ 100/).count() === 1 &&
      await page.getByRole("link", { name: "Download PDB" }).count() === 1);
    if (!gene) {
      const csv = await downloadAsText(page, "Download structure CSV");
      check("LIVE", "structure CSV includes kind, mapping, confidence and provenance",
        csv.includes("mean_plddt") && csv.includes(",predicted,P04637,") && csv.includes(",experimental,P04637,") &&
        csv.includes("https://alphafold.ebi.ac.uk/entry/P04637"));
    }
    await page.getByRole("heading", { name: "1. Structure" }).locator("xpath=../..")
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: join(screenshots, `slice4-structure-${viewportName}.png`) });
    await page.getByRole("button", { name: "Hide structure" }).click();
    await page.getByRole("button", { name: "Load ligand" }).click();
    const zinc = page.getByRole("link", { name: "ZN · ZINC ION" });
    await zinc.waitFor({ timeout: 25_000 });
    const zincRecord = zinc.locator("xpath=../..");
    check("LIVE", `${viewportName} chemical component evidence and role`,
      await zinc.getAttribute("href") === "https://www.rcsb.org/ligand/ZN" &&
      await zincRecord.getByText("Ion · Formula: Zn").count() === 1 &&
      await zincRecord.getByRole("link", { name: "6XRE" }).count() === 1 &&
      await zincRecord.getByRole("link", { name: "UniProtKB cofactor annotation" }).count() === 1);
    const ligandHeading = page.getByRole("heading", { name: "2. Ligand" });
    await ligandHeading.evaluate((element) => {
      element.scrollIntoView({ block: "start" });
      window.scrollBy(0, -100);
    });
    await page.screenshot({ path: join(screenshots, `slice4-ligand-${viewportName}.png`) });
    await page.getByRole("button", { name: "Hide ligand" }).click();
    await page.getByRole("button", { name: "Load interaction" }).click();
    const interactionHeading = page.getByRole("heading", { name: "3. Protein Interaction" });
    const interaction = interactionHeading.locator("xpath=../..");
    const map = interaction.getByRole("img", { name: /Relationship map/ });
    await map.waitFor({ timeout: 35_000 });
    const edges = interaction.getByRole("listitem");
    const firstEdge = edges.first();
    const partner = firstEdge.getByRole("link").last();
    check("LIVE", `${viewportName} STRING list and evidence`,
      await edges.count() === 10 && /Score: 0\./.test(await firstEdge.textContent()) &&
      (await partner.getAttribute("href")).startsWith("https://version-12-0.string-db.org/network/9606.") &&
      await interaction.getByText(/does not confirm direct physical interaction/).count() === 1);
    await map.getByText(await partner.textContent(), { exact: true }).click();
    check("LIVE", `${viewportName} STRING graph selects a partner`,
      await interaction.getByRole("link", { name: "Open on STRING" }).getAttribute("href") === await partner.getAttribute("href") &&
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (!gene) {
      const nodePicker = interaction.getByLabel("Select a protein node");
      await nodePicker.focus();
      await nodePicker.press("Home");
      check("LIVE", "STRING node picker supports keyboard selection of the verified seed",
        await interaction.getByRole("link", { name: "Open Protein Profile" }).getAttribute("href") === "/entity/protein/P04637");
      const interactions = await downloadAsText(page, "Download interaction CSV");
      check("LIVE", "interaction CSV includes STRING evidence and network context",
        interactions.includes("network_type,score,required_score,evidence") &&
        interactions.includes(",functional,") && interactions.includes("9606.ENSP00000269305") &&
        interactions.includes("https://version-12-0.string-db.org/api/json/interaction_partners?"));
      const entity = await downloadAsText(page, "Download CSV");
      check("LIVE", "entity CSV preserves taxonomy and source provenance",
        entity.includes("Taxonomy ID,Source,Source ID,Source URL,Retrieved at") &&
        entity.includes("Homo sapiens,9606,UniProt,P04637,https://www.uniprot.org/uniprotkb/P04637"));
    }
    await interactionHeading.evaluate((element) => {
      element.scrollIntoView({ block: "start" });
      window.scrollBy(0, -100);
    });
    await page.screenshot({ path: join(screenshots, `slice4-interaction-${viewportName}.png`) });
    await page.close();
  }

  const page = await browser.newPage();
  let retry = false;
  await page.route("**/api/backend/api/v1/entities/protein/P04637/sequence", (route) => {
    if (!retry) return route.fulfill({ status: 504, json: { detail: "test timeout" } });
    return route.fulfill({ json: { status: "empty", records: [], notices: [] } });
  });
  await page.goto(base + "/entity/protein/P04637");
  await page.getByRole("button", { name: "Load sequence" }).click();
  await page.getByText("Source error", { exact: true }).waitFor();
  retry = true;
  await page.getByRole("button", { name: "Retry source" }).click();
  await page.getByText("No verified records were found.", { exact: true }).waitFor();
  check("MOCKED", "sequence provider error retries and renders an empty response", true);
  let release;
  const upstream = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/backend/api/v1/entities/protein/P04637/interaction", async (route) => {
    await upstream;
    await route.fulfill({ json: { status: "unavailable", records: [],
      notices: [{ source: "STRING", code: "unsupported", message: "No verified mapping." }] } });
  });
  await page.getByRole("button", { name: "Load interaction" }).click();
  const interactionStatus = page.getByRole("heading", { name: "3. Protein Interaction" }).locator("xpath=../..").getByRole("status");
  await interactionStatus.filter({ hasText: /^Loading$/ }).waitFor();
  release();
  await page.getByText("STRING: No verified mapping.", { exact: true }).waitFor();
  check("MOCKED", "loading transitions to unavailable with source explanation",
    await interactionStatus.textContent() === "Unavailable");
  await page.route("**/api/backend/api/v1/entities/protein/P04637/literature", (route) =>
    route.fulfill({ json: {
      status: "partial",
      identity: { entity_type: "protein", accession: "P04637", taxonomy_id: 9606, organism: "Homo sapiens" },
      records: [{ title: '=Mocked, "article"', authors: [], journal: null, year: 2026, pmid: "1", doi: null,
        relation: "direct", relation_source: "UniProtKB", abstract_available: false,
        source: "PubMed", source_id: "1", source_url: "https://pubmed.ncbi.nlm.nih.gov/1/", retrieved_at: "2026-11-28T00:00:00Z" }],
      notices: [{ source: "PubMed", code: "timeout", message: "Related search timed out." }],
    } }));
  await page.getByRole("button", { name: "Load literature" }).click();
  await page.getByRole("status").filter({ hasText: "Partial results" }).waitFor();
  const csv = await downloadAsText(page, "Download literature CSV");
  check("MOCKED", "partial CSV keeps source notice and neutralizes unsafe title",
    csv.includes(",partial,PubMed:timeout,") && csv.includes(`"'=Mocked, ""article"""`));
  const scope = `${base}/api/backend/api/v1/entities/protein/P04637`;
  for (const suffix of ["/undocumented", "/sequence/extra", "/structure?url=https://example.test"]) {
    check("SECURITY", `proxy denies ${suffix}`, (await page.request.get(scope + suffix)).status() === 404);
  }
  check("SECURITY", "proxy denies POST on scientific route", (await page.request.post(scope + "/sequence")).status() === 405);
  await page.close();
} finally {
  await browser.close();
}
console.log(`${passed} exploration checks passed.`);
