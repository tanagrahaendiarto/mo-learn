/** SIMULATED LLM and captured biological records through Next.js + real FastAPI. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.env.AI_BROWSER_BASE_URL ?? "http://127.0.0.1:3002";
const disabledBase = process.env.AI_BROWSER_DISABLED_URL ?? "http://127.0.0.1:3000";
const screenshots = process.env.AI_SCREENSHOT_DIR ?? "screenshots";
const access = "test-reviewer-code-not-a-real-secret";
const proxy = "/api/backend/api/v1";
const protein = "/entity/protein/P04637";
const gene = "/entity/gene/7157";
const viewports = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

const browser = await chromium.launch();
let passed = 0;
function check(label, condition) {
  assert.ok(condition, label);
  passed++;
  console.log(`PASS SIMULATED ${label}`);
}

function studyPanel(page) {
  return page.getByRole("heading", { name: "Study Companion" }).locator("xpath=../..");
}

async function ask(page, question, expected) {
  const panel = studyPanel(page);
  await panel.getByRole("textbox", { name: "Ask a question" }).fill(question);
  await panel.getByRole("button", { name: "Ask Study Companion" }).click();
  await panel.getByText(expected).waitFor();
}

async function measure(panel, heading, name) {
  const metrics = await panel.evaluate((card, headingText) => {
    const title = [...card.querySelectorAll("h2, h3")].find((node) => node.textContent === headingText);
    const rect = card.getBoundingClientRect();
    const button = card.querySelector("button.bg-primary");
    const text = card.querySelector("p.text-body-lg, p.text-body-sm");
    const titleRect = title.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      viewport: innerWidth,
      headingFits: titleRect.width > 0 && title.scrollWidth <= title.clientWidth + 1,
      contentFits: card.scrollWidth <= card.clientWidth + 1,
      font: parseFloat(getComputedStyle(text).fontSize),
      actionHeight: button.getBoundingClientRect().height,
    };
  }, heading);
  console.log(`${name} layout ${JSON.stringify(metrics)}`);
  check(`${name}: content and heading fit with readable text and a 44 px action`,
    metrics.headingFits && metrics.contentFits && metrics.font >= 14 && metrics.actionHeight >= 44
      && metrics.width > 220 && metrics.height > 140 && metrics.left >= 0 && metrics.right <= metrics.viewport);
}

try {
  await mkdir(screenshots, { recursive: true });
  for (const [name, viewport] of Object.entries(viewports)) {
    const page = await browser.newPage({ viewport });
    const aiRequests = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes(`${proxy}/ai/`)) aiRequests.push(request);
    });
    await page.goto(`${base}${protein}`);
    const explanation = page.getByRole("heading", { name: "In simple terms" }).locator("xpath=../../../..");
    const study = studyPanel(page);
    await explanation.getByRole("button", { name: "Generate explanation" }).waitFor();
    check(`${name}: profile opens without AI request and requires reviewer code`,
      aiRequests.length === 0 && await explanation.getByRole("button", { name: "Generate explanation" }).isDisabled());

    await explanation.getByLabel("AI reviewer access code").fill(access);
    await explanation.getByRole("button", { name: "Generate explanation" }).click();
    await explanation.getByText("AI-generated", { exact: true }).waitFor();
    check(`${name}: explanation renders terms, functions, and real source link`,
      await explanation.getByText("DNA-binding protein", { exact: true }).isVisible()
      && await explanation.getByText("p53 can activate transcription of target genes.").isVisible()
      && await explanation.getByRole("link", { name: "UniProtKB P04637" }).first().getAttribute("href")
        === "https://www.uniprot.org/uniprotkb/P04637");
    await measure(explanation, "In simple terms", `${name} explanation`);
    await explanation.screenshot({ path: join(screenshots, `slice3-mock-${name}-explanation.png`) });

    await study.getByRole("button", { name: "Which organism does this record come from?" }).click();
    assert.equal(await study.getByRole("textbox", { name: "Ask a question" }).inputValue(),
      "Which organism does this record come from?");
    check(`${name}: suggestion fills input without another AI request`, aiRequests.length === 1);
    await study.getByRole("button", { name: "Ask Study Companion" }).click();
    await study.getByText("This protein record is from Homo sapiens.").waitFor();
    check(`${name}: question submits with exact selected accession`,
      aiRequests.length === 2 && aiRequests[1].postDataJSON().entity_id === "P04637");
    await measure(study, "Study Companion", `${name} study companion`);
    await study.screenshot({ path: join(screenshots, `slice3-mock-${name}-study.png`) });

    if (name === "desktop") {
      for (const [question, message] of [
        ["Ask for unsupported evidence", "The available source records do not provide enough evidence for this response."],
        ["Simulate model timeout", "The request timed out. Try again."],
        ["Simulate quota exhaustion", "The AI usage limit has been reached."],
        ["Simulate rate limit", "Too many AI requests. Wait a moment and try again."],
        ["Simulate unsafe text", "MoLearn could not verify this answer. Try rephrasing your question or check the original source."],
      ]) {
        await ask(page, question, message);
        check(question, await study.getByText(message).isVisible());
      }
      check("unverified model text stays hidden", await study.getByText("<img alt=test-markup>").count() === 0);

      await study.getByRole("textbox", { name: "Ask a question" }).fill("Simulate slow p53 answer");
      await study.getByRole("button", { name: "Ask Study Companion" }).click();
      await study.getByText("Checking the available evidence…").waitFor();
      check("pending request disables submit", await study.getByRole("button", { name: "Ask Study Companion" }).isDisabled());
      await page.locator(`a[href="${gene}"]`).first().click();
      await page.waitForURL(`${base}${gene}`);
      await study.getByText("Context: TP53 (Gene)").waitFor();
      check("switch from protein to gene clears question and answers",
        await study.getByRole("textbox", { name: "Ask a question" }).inputValue() === ""
        && await study.getByText(/in response to DNA damage/).count() === 0);
      await ask(page, "Which organism does this gene record come from?", "This gene record is from Homo sapiens.");
      check("gene answer uses exact GeneID and NCBI link",
        aiRequests.at(-1).postDataJSON().entity_id === "7157"
        && await study.getByRole("link", { name: "NCBI Gene 7157" }).getAttribute("href")
          === "https://www.ncbi.nlm.nih.gov/gene/7157");
    }
    await page.close();
  }

  const context = await browser.newContext();
  const api = context.request;
  const headers = { "X-MoLearn-AI-Access": access };
  const data = { entity_type: "protein", entity_id: "P04637" };
  check("unrelated POST denied", (await api.post(`${base}${proxy}/search`, { headers, data })).status() === 405);
  check("AI GET denied", (await api.get(`${base}${proxy}/ai/ask`)).status() === 404);
  check("unapproved AI suffix denied", (await api.post(`${base}${proxy}/ai/ask/other`, { headers, data })).status() === 405);
  check("cross-origin POST denied", (await api.post(`${base}${proxy}/ai/explain`, {
    headers: { ...headers, Origin: "https://example.org" }, data,
  })).status() === 403);
  check("well-formed wrong code denied by backend", (await api.post(`${base}${proxy}/ai/explain`, {
    headers: { "X-MoLearn-AI-Access": "x".repeat(40) }, data,
  })).status() === 403);
  check("oversized POST denied", (await api.post(`${base}${proxy}/ai/ask`, {
    headers, data: { ...data, question: "x".repeat(8200) },
  })).status() === 413);
  check("disabled proxy returns explicit unavailable", (await api.post(`${disabledBase}${proxy}/ai/explain`, {
    headers, data,
  })).status() === 503);
  await context.close();
  console.log(`${passed}/${passed} simulated Slice 3 browser checks passed.`);
} finally {
  await browser.close();
}
