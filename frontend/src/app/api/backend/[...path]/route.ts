import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL?.replace(/\/+$/, "") ?? "";
const AI_POST_PATHS = new Set(["/api/v1/ai/explain", "/api/v1/ai/ask"]);
const MAX_AI_BODY_BYTES = 8192;
export const maxDuration = 70;

/**
 * Identifier patterns copied from the backend contract:
 * - UniProtKB accession (uppercased before matching, same as backend).
 * - NCBI GeneID: positive numeric, max 12 digits (backend `_GENEID_RE`).
 */
const PROTEIN_ACCESSION =
  /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})$/;
const GENE_ID = /^[1-9][0-9]{0,11}$/;

function decodeSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function isAllowed(pathname: string, search: string): boolean {
  if (pathname === "/api/v1/health") return true;
  if (pathname === "/api/v1/search") return true;

  const match = /^\/api\/v1\/entities\/(protein|gene)\/([^/]+)(?:\/(sequence|literature|structure|ligand|interaction))?$/.exec(pathname);
  if (!match) return false;
  if (match[3] && search) return false;

  const id = decodeSegment(match[2]);
  if (!id) return false;

  if (match[1] === "protein") return PROTEIN_ACCESSION.test(id.toUpperCase());
  return GENE_ID.test(id);
}

export async function GET(request: NextRequest) {
  if (!BACKEND_API_URL) {
    return NextResponse.json(
      { status: "misconfigured", detail: "backend_not_configured" },
      { status: 500 },
    );
  }

  const url = request.nextUrl;
  const backendPath = url.pathname.replace(/^\/api\/backend/, "") || "/";

  if (!isAllowed(backendPath, url.search)) {
    return NextResponse.json(
      { status: "not_found", detail: "endpoint_not_allowed" },
      { status: 404 },
    );
  }

  const backendUrl = `${BACKEND_API_URL}${backendPath}${url.search}`;

  const deadline = AbortSignal.timeout(60_000);
  try {
    const response = await fetch(backendUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: deadline,
      cache: "no-store",
      redirect: "error",
    });
    return await forwardJson(response);
  } catch {
    return deadline.aborted
      ? apiError(504, "provider_error", "upstream_timeout")
      : apiError(502, "provider_error", "connection_error");
  }
}

function apiError(httpStatus: number, status: string, detail: string) {
  return NextResponse.json({ status, detail }, {
    status: httpStatus,
    headers: { "Cache-Control": "no-store" },
  });
}

async function forwardJson(response: Response) {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    await response.body?.cancel();
    return apiError(response.status === 503 ? 503 : 502, "provider_error", "upstream_unavailable");
  }
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  const path = url.pathname.slice("/api/backend".length);
  if (!AI_POST_PATHS.has(path) || url.search) {
    return apiError(405, "method_not_allowed", "endpoint_not_allowed");
  }
  if (!BACKEND_API_URL || process.env.MOLEARN_AI_UI_ENABLED !== "true") {
    return apiError(503, "unavailable", "ai_not_configured");
  }
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  // Next can normalize nextUrl.origin to the bound server name. Host is the
  // requested name; browser fetch metadata also checks scheme and origin.
  if (origin && (
    !URL.canParse(origin) || new URL(origin).host !== request.headers.get("host")
    || (fetchSite && fetchSite !== "same-origin")
  )) {
    return apiError(403, "access_required", "origin_not_allowed");
  }
  const access = request.headers.get("x-molearn-ai-access") ?? "";
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(access)) {
    return apiError(403, "access_required", "reviewer_access_required");
  }
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json" || !request.body) {
    return apiError(415, "bad_request", "expected_json");
  }

  const deadline = AbortSignal.timeout(40_000);
  const reader = request.body.getReader();
  const cancelRead = () => { void reader.cancel().catch(() => {}); };
  deadline.addEventListener("abort", cancelRead, { once: true });
  const body = new Uint8Array(MAX_AI_BODY_BYTES);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.byteLength > body.byteLength) {
        cancelRead();
        return apiError(413, "bad_request", "body_too_large");
      }
      body.set(value, length);
      length += value.byteLength;
    }
    deadline.throwIfAborted();
    const response = await fetch(`${BACKEND_API_URL}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-MoLearn-AI-Access": access,
      },
      body: body.subarray(0, length),
      cache: "no-store",
      redirect: "error",
      signal: deadline,
    });
    return await forwardJson(response);
  } catch {
    return deadline.aborted
      ? apiError(504, "timeout", "upstream_timeout")
      : apiError(502, "provider_error", "connection_error");
  } finally {
    deadline.removeEventListener("abort", cancelRead);
    reader.releaseLock();
  }
}
export async function PUT() {
  return apiError(405, "method_not_allowed", "endpoint_not_allowed");
}
export async function PATCH() {
  return apiError(405, "method_not_allowed", "endpoint_not_allowed");
}
export async function DELETE() {
  return apiError(405, "method_not_allowed", "endpoint_not_allowed");
}
