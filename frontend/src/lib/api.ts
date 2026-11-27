import { SEARCH_FIXTURE, FEATURED_ENTITIES } from "@/data/fixtures";
import type {
  BiologicalEntitySummary,
  SearchResult,
  EntityProfile,
  EntitySource,
} from "@/types/molearn";

/* ============================================================
   moLearn API Adapter — Slice 1 (protein UniProt via proxy).
   ============================================================

   Arsitektur:
   - Browser mengirim request ke Next.js proxy (same-origin).
   - Proxy meneruskan ke FastAPI (BACKEND_API_URL, server-side only).
   - Adapter memetakan respons backend → tipe domain frontend.

   Mode:
   - Demo (NEXT_PUBLIC_DEMO_MODE=true): pakai fixture lokal.
   - Live  : panggil proxy, mapping field-by-field.

   JANGAN ada silent fallback. API gagal → ErrorState eksplisit.
   ============================================================ */

/** Server-side only: dibaca oleh proxy Route Handler, tidak di-expose ke browser. */
export const BACKEND_API_URL =
  (typeof process !== "undefined"
    ? process.env.BACKEND_API_URL
    : undefined)?.replace(/\/+$/, "") ?? "";

/** Client-side flag: true = gunakan fixture demo. */
export const IS_DEMO_MODE: boolean =
  (typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_DEMO_MODE
    : undefined) === "true";

/* ---------- Tipe internal backend (slice 1) ---------- */

interface BackendSearchResponse {
  query: string;
  match_mode: "exact_accession" | "name";
  results: BackendProteinSummary[];
  next_cursor: string | null;
  provider_status: "available" | "not_found";
}

interface BackendOrganism {
  scientific_name: string | null;
  taxonomy_id: number | null;
}

interface BackendProteinSummary {
  entity_type: string;
  accession: string;
  primary_name: string | null;
  synonyms: string[];
  gene_symbols: string[];
  organism: BackendOrganism;
  reviewed: boolean;
  source: string;
  source_url: string;
  retrieved_at: string;
  status: string;
}

interface BackendGeneXref {
  namespace: string;
  id: string;
}

interface BackendProteinProfile extends BackendProteinSummary {
  gene_crossrefs: BackendGeneXref[];
  length: number | null;
  function_annotations: string[];
}

/* ---------- URL resolution ---------- */

const PROXY_PREFIX = "/api/backend";

function resolveUrl(path: string): string {
  if (typeof window !== "undefined") return `${PROXY_PREFIX}${path}`;
  if (!BACKEND_API_URL) throw new ApiError(500, "misconfigured: BACKEND_API_URL is not set");
  return `${BACKEND_API_URL}${path}`;
}

/* ---------- Mapping helpers ---------- */

/** Normalisasi namespace sumber backend → EntitySource kanonik. */
const SOURCE_MAP: Record<string, EntitySource> = {
  uniprot: "UniProt",
  uniprotkb: "UniProt",
  "ncbi gene": "NCBI Gene",
  ncbi_gene: "NCBI Gene",
  ncbi: "NCBI Gene",
  pdb: "PDB",
  string: "STRING",
};

function normalizeSource(source: string): EntitySource {
  const key = source.trim().toLowerCase();
  return SOURCE_MAP[key] ?? "UniProt";
}

function mapSummary(b: BackendProteinSummary): BiologicalEntitySummary {
  const aliases = [
    ...b.synonyms,
    ...b.gene_symbols,
  ];
  return {
    type: "protein",
    id: b.accession,
    name: b.primary_name ?? b.accession,
    symbol: b.gene_symbols[0] ?? b.primary_name ?? undefined,
    organism: b.organism.scientific_name ?? "Unknown",
    source: normalizeSource(b.source),
    summary: "",  // Diisi oleh profile jika tersedia
    aliases: aliases.length > 0 ? aliases : undefined,
    badge: "protein",
    icon: "protein",
    partial: b.status !== "available",
  };
}

function mapProfile(b: BackendProteinProfile): EntityProfile {
  const base = mapSummary(b);
  return {
    type: "protein",
    id: b.accession,
    name: base.name,
    symbol: base.symbol ?? b.accession,
    organism: base.organism,
    source: base.source,
    reviewed: b.reviewed,
    taxonomyId: b.organism.taxonomy_id ?? undefined,
    length: b.length ?? undefined,
    // UniProt tidak menyediakan ringkasan ramah pemula tervalidasi.
    // Dibiarkan kosong: UI menampilkan unavailable state, bukan teks karangan.
    summary: undefined,
    functionAnnotations: b.function_annotations,
    geneCrossrefs: b.gene_crossrefs,
    relatedGeneId:
      b.gene_symbols[0] ??
      b.gene_crossrefs.find((g) => g.namespace === "HGNC")?.id,
    references: {
      uniprotUrl: b.source_url,
    },
  };
}

/* ---------- Error handling ---------- */

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function handleBackendError(body: unknown, fallbackStatus: number): ApiError {
  if (typeof body === "object" && body !== null && "status" in body && "detail" in body) {
    const b = body as { status: string; detail: string };
    const statusMap: Record<string, number> = {
      provider_error: 502,
      not_found: 404,
      bad_request: 400,
      rate_limited_by_uniprot: 429,
      upstream_uniprot_timeout: 504,
      upstream_uniprot_error: 502,
      upstream_uniprot_malformed: 502,
      upstream_uniprot_malformed_pagination: 502,
    };
    return new ApiError(statusMap[b.status] ?? fallbackStatus, b.detail);
  }
  return new ApiError(fallbackStatus, "Unknown error");
}

/* ---------- Public API ---------- */

export interface SearchParams {
  q: string;
  page_size?: number;
  cursor?: string;
}

/**
 * Cari entitas biologis.
 * - Demo mode: filter fixture lokal.
 * - Live mode: panggil proxy FastAPI.
 *
 * JANGAN fallback diam-diam ke fixture saat API gagal.
 */
export async function searchEntities(
  params: SearchParams,
): Promise<SearchResult> {
  if (IS_DEMO_MODE) {
    return searchEntitiesDemo(params);
  }

  const q = params.q.trim();
  if (!q) {
    return { query: "", entities: [], disambiguation: undefined, isDemo: false };
  }

  const url = new URL(resolveUrl("/api/v1/search"), typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  url.searchParams.set("q", q);
  if (params.page_size && params.page_size > 0) {
    url.searchParams.set("page_size", String(params.page_size));
  }
  if (params.cursor) {
    url.searchParams.set("cursor", params.cursor);
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      // 60s timeout handled by proxy
    });

    const body = await response.json();

    if (!response.ok) {
      throw handleBackendError(body, response.status);
    }

    const backend = body as BackendSearchResponse;
    const entities = backend.results.map(mapSummary);

    // Disambiguasi: ada gene_symbols + synonym yang sama → tampilkan catatan
    const hasGeneProteinPair = entities.some(
      (e) => e.type === "protein" && e.symbol && e.aliases?.some((a) => a.toLowerCase() === q.toLowerCase()),
    );

    return {
      query: backend.query,
      entities,
      disambiguation: hasGeneProteinPair
        ? "Names that look similar can refer to different entities. moLearn keeps genes and proteins separate."
        : undefined,
      isDemo: false,
      next_cursor: backend.next_cursor ?? undefined,
      provider_status: backend.provider_status,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, `Connection error: ${error instanceof Error ? error.message : "Unknown"}`);
  }
}

/**
 * Profil entitas.
 * - Demo mode: cari di fixture.
 * - Live mode: panggil proxy FastAPI.
 */
export async function fetchEntityProfile(
  type: string,
  id: string,
): Promise<EntityProfile> {
  if (type !== "protein") {
    throw new ApiError(404, "Only protein profiles available in slice 1. Gene profiles coming in slice 2.");
  }

  if (IS_DEMO_MODE) {
    return fetchEntityProfileDemo(type, id);
  }

  const url = new URL(resolveUrl(`/api/v1/entities/protein/${encodeURIComponent(id)}`), typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const body = await response.json();

    if (response.status === 404) {
      throw new ApiError(404, "protein_not_found");
    }
    if (!response.ok) {
      throw handleBackendError(body, response.status);
    }

    const backend = body as BackendProteinProfile;
    return mapProfile(backend);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, `Connection error: ${error instanceof Error ? error.message : "Unknown"}`);
  }
}

/* ---------- Demo mode implementations ---------- */

function searchEntitiesDemo(params: SearchParams): SearchResult {
  const q = params.q.trim().toLowerCase();

  // Gabungkan SEARCH_FIXTURE + FEATURED_ENTITIES (tanpa duplikat)
  const baseEntities: BiologicalEntitySummary[] = [...SEARCH_FIXTURE];
  for (const extra of FEATURED_ENTITIES) {
    if (!baseEntities.some((e) => e.id === extra.id && e.type === extra.type)) {
      baseEntities.push(extra);
    }
  }

  function matchesQuery(e: BiologicalEntitySummary): boolean {
    if (q === "") return true;
    if (e.name.toLowerCase().includes(q)) return true;
    if (e.symbol && e.symbol.toLowerCase().includes(q)) return true;
    if (e.aliases?.some((a) => a.toLowerCase().includes(q))) return true;
    return false;
  }

  const entities = baseEntities.filter((e) => matchesQuery(e));

  const hasPair =
    entities.some((e) => e.type === "gene") &&
    entities.some((e) => e.type === "protein");

  return {
    query: params.q,
    entities,
    disambiguation: hasPair
      ? "Names that look similar can refer to different entities. moLearn keeps genes and proteins separate."
      : undefined,
    isDemo: true,
  };
}

function fetchEntityProfileDemo(type: string, id: string): EntityProfile {
  const all = [...FEATURED_ENTITIES, ...SEARCH_FIXTURE];
  const found = all.find((e) => e.type === type && e.id === id);

  if (!found) {
    throw new ApiError(404, "protein_not_found");
  }

  // Cross-reference demo yang TERVALIDASI (dikurasi dari fixture gen/protein).
  const demoCrossrefs: Record<string, { namespace: string; id: string }[]> = {
    P04637: [{ namespace: "HGNC", id: "HGNC:11998" }],
  };

  return {
    type: found.type as EntityProfile["type"],
    id: found.id,
    name: found.name,
    symbol: found.symbol ?? found.name,
    organism: found.organism,
    source: found.source,
    summary: found.summary,
    functionAnnotations: [],
    geneCrossrefs: demoCrossrefs[found.id] ?? [],
    relatedGeneId:
      found.id === "P04637" ? "HGNC:11998" : undefined,
    references: {
      uniprotUrl: found.id.startsWith("P")
        ? `https://www.uniprot.org/uniprotkb/${found.id}`
        : undefined,
    },
  };
}
