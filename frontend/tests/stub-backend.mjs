/**
 * SIMULATED backend for slice-2 failure scenarios.
 *
 * This server is NOT a real provider. It returns canned responses so the
 * partial-failure, empty-after-failure, and backend-down paths can be tested
 * without breaking a healthy provider. Every response it serves is simulated
 * and the test output labels those checks SIMULATED.
 *
 * Usage:
 *   node tests/stub-backend.mjs
 *   STUB_PORT=8099 node tests/stub-backend.mjs
 *
 * Mode control (test-only):
 *   GET /__mode/ok | partial | partial-empty | down
 */

import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 8099);
let mode = "ok";

const ORGANISM = { scientific_name: "Homo sapiens", taxonomy_id: 9606 };

const PROTEIN = {
  entity_type: "protein",
  accession: "P04637",
  primary_name: "Cellular tumor antigen p53",
  synonyms: ["Tumor suppressor p53"],
  gene_symbols: ["TP53"],
  organism: ORGANISM,
  source: "uniprot",
  source_url: "https://www.uniprot.org/uniprotkb/P04637",
  retrieved_at: "2026-01-01T00:00:00Z",
  status: "available",
  reviewed: true,
};

const GENE = {
  entity_type: "gene",
  accession: "7157",
  primary_name: "TP53",
  synonyms: ["p53", "LFS1"],
  gene_symbols: ["TP53"],
  organism: ORGANISM,
  source: "ncbi_gene",
  source_url: "https://www.ncbi.nlm.nih.gov/gene/7157",
  retrieved_at: "2026-01-01T00:00:00Z",
  status: "available",
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

function searchResponse() {
  if (mode === "partial") {
    return {
      query: "p53",
      match_mode: "name",
      results: [PROTEIN],
      next_cursor: null,
      provider_status: "partial",
      providers: [
        { name: "uniprot", status: "available", detail: null, count: 1 },
        {
          name: "ncbi_gene",
          status: "error",
          detail: "rate_limited_by_ncbi",
          count: 0,
        },
      ],
    };
  }
  if (mode === "partial-empty") {
    return {
      query: "zzzz",
      match_mode: "name",
      results: [],
      next_cursor: null,
      provider_status: "partial",
      providers: [
        {
          name: "uniprot",
          status: "error",
          detail: "upstream_uniprot_error",
          count: 0,
        },
        { name: "ncbi_gene", status: "not_found", detail: null, count: 0 },
      ],
    };
  }
  return {
    query: "p53",
    match_mode: "name",
    results: [PROTEIN, GENE],
    next_cursor: null,
    provider_status: "available",
    providers: [
      { name: "uniprot", status: "available", detail: null, count: 1 },
      { name: "ncbi_gene", status: "available", detail: null, count: 1 },
    ],
  };
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");

  if (url.pathname.startsWith("/__mode/")) {
    mode = url.pathname.slice("/__mode/".length);
    return sendJson(res, 200, { mode });
  }

  if (mode === "down") {
    // Simulate an unreachable backend: drop the connection.
    req.socket.destroy();
    return;
  }

  if (url.pathname === "/api/v1/health") {
    return sendJson(res, 200, {
      status: "ok",
      service: "simulated-backend",
      version: "0.2.0",
    });
  }

  if (url.pathname === "/api/v1/search") {
    return sendJson(res, 200, searchResponse());
  }

  if (url.pathname === "/api/v1/entities/gene/7157") {
    return sendJson(res, 200, {
      ...GENE,
      description: "Simulated gene summary.",
      chromosome: "17p13.1",
      gene_type: "protein-coding",
      cross_references: [{ namespace: "HGNC", id: "HGNC:11998" }],
      related_proteins: [],
      protein_links: [],
    });
  }

  return sendJson(res, 404, { status: "not_found", detail: "simulated_not_found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`SIMULATED backend on http://127.0.0.1:${PORT} (mode ${mode})`);
});
