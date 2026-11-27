import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL?.replace(/\/+$/, "") ?? "";

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

function isAllowed(pathname: string): boolean {
  if (pathname === "/api/v1/health") return true;
  if (pathname === "/api/v1/search") return true;

  const match = /^\/api\/v1\/entities\/(protein|gene)\/([^/]+)$/.exec(pathname);
  if (!match) return false;

  const id = decodeSegment(match[2]);
  if (!id) return false;

  if (match[1] === "protein") return PROTEIN_ACCESSION.test(id.toUpperCase());
  return GENE_ID.test(id);
}

export async function GET(request: NextRequest) {
  if (!BACKEND_API_URL) {
    return NextResponse.json(
      { status: "misconfigured", detail: "BACKEND_API_URL tidak di-set" },
      { status: 500 },
    );
  }

  const url = request.nextUrl;
  const backendPath = url.pathname.replace(/^\/api\/backend/, "") || "/";

  if (!isAllowed(backendPath)) {
    return NextResponse.json(
      { status: "not_found", detail: "Endpoint tidak diizinkan" },
      { status: 404 },
    );
  }

  const backendUrl = `${BACKEND_API_URL}${backendPath}${url.search}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const response = await fetch(backendUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    // Forward the upstream body and status unchanged (JSON contract).
    const body = await response.text();
    const contentType = response.headers.get("content-type") ?? "application/json";
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": contentType },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isTimeout = message.includes("abort") || message.includes("timeout");
    return NextResponse.json(
      { status: "provider_error", detail: isTimeout ? "upstream_timeout" : "connection_error" },
      { status: isTimeout ? 504 : 502 },
    );
  }
}

export async function POST() {
  return NextResponse.json({ status: "method_not_allowed", detail: "POST tidak diizinkan" }, { status: 405 });
}
export async function PUT() {
  return NextResponse.json({ status: "method_not_allowed", detail: "PUT tidak diizinkan" }, { status: 405 });
}
export async function PATCH() {
  return NextResponse.json({ status: "method_not_allowed", detail: "PATCH tidak diizinkan" }, { status: 405 });
}
export async function DELETE() {
  return NextResponse.json({ status: "method_not_allowed", detail: "DELETE tidak diizinkan" }, { status: 405 });
}
