import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL?.replace(/\/+$/, "") ?? "";

function isAllowed(pathname: string): boolean {
  if (pathname === "/api/v1/health") return true;
  if (pathname === "/api/v1/search" || pathname.startsWith("/api/v1/search?")) return true;
  if (pathname.startsWith("/api/v1/entities/protein/")) return true;
  return false;
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

    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    return NextResponse.json(body, { status: response.status });
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
