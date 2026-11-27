import {
  SEARCH_FIXTURE,
  FEATURED_ENTITIES,
  GENE_PROFILE_FIXTURES,
} from "@/data/fixtures";
import type {
  BiologicalEntitySummary,
  SearchResult,
  EntityProfile,
  EntitySource,
  GeneEntityProfile,
  ProteinEntityProfile,
  ProviderStatus,
} from "@/types/molearn";

/* ============================================================
   moLearn API Adapter — Slice 2 (UniProt protein + NCBI Gene).
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

/* ---------- Tipe internal backend (kontrak final slice 2) ---------- */

interface BackendOrganism {
  scientific_name: string | null;
  taxonomy_id: number | null;
}

interface BackendSummaryBase {
  entity_type: string;
  accession: string;
  primary_name: string | null;
  synonyms: string[];
  gene_symbols: string[];
  organism: BackendOrganism;
  source: string;
  source_url: string;
  retrieved_at: string;
  status: string;
}

interface BackendProteinSummary extends BackendSummaryBase {
  entity_type: "protein";
  reviewed: boolean;
}

interface BackendGeneSummary extends BackendSummaryBase {
  entity_type: "gene";
}

type BackendSummary = BackendProteinSummary | BackendGeneSummary;

interface BackendGeneXref {
  namespace: string;
  id: string;
}

interface BackendProteinLink {
  accession: string;
  primary_name: string | null;
  gene_symbols: string[];
  reviewed: boolean | null;
  source: string;
  source_url: string;
  evidence: string;
}

interface BackendProteinProfile extends BackendProteinSummary {
  gene_crossrefs: BackendGeneXref[];
  length: number | null;
  function_annotations: string[];
}

interface BackendGeneProfile extends BackendGeneSummary {
  description: string | null;
  chromosome: string | null;
  gene_type: string | null;
  cross_references: BackendGeneXref[];
  related_proteins: string[];
  protein_links: BackendProteinLink[];
}

type BackendProviderStatus = {
  name: string;
  status: string;
  detail: string | null;
  count: number;
};

interface BackendSearchResponse {
  query: string;
  match_mode: "exact_accession" | "exact_geneid" | "name";
  results: BackendSummary[];
  next_cursor: string | null;
  provider_status: "available" | "not_found" | "partial" | "error";
  providers: BackendProviderStatus[];
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
  return SOURCE_MAP[key] ?? "Unknown";
}

function uniqueAliases(values: string[], exclude?: string): string[] | undefined {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const alias = value.trim();
    if (!alias || alias === exclude) continue;
    const key = alias.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(alias);
  }
  return out.length > 0 ? out : undefined;
}

function mapSummary(b: BackendSummary): BiologicalEntitySummary {
  const aliases = uniqueAliases(
    [...b.synonyms, ...b.gene_symbols],
    b.primary_name ?? undefined,
  );
  const base = {
    id: b.accession,
    name: b.primary_name ?? b.accession,
    organism: b.organism.scientific_name ?? "Unknown",
    source: normalizeSource(b.source),
    summary: "", // Diisi oleh profile jika tersedia
    aliases,
    partial: b.status !== "available",
    taxonomyId: b.organism.taxonomy_id ?? undefined,
    sourceUrl: b.source_url,
    retrievedAt: b.retrieved_at,
  };

  if (b.entity_type === "gene") {
    return {
      ...base,
      type: "gene",
      symbol: b.primary_name ?? b.gene_symbols[0] ?? undefined,
      badge: "gene",
      icon: "dna",
    };
  }

  return {
    ...base,
    type: "protein",
    symbol: b.gene_symbols[0] ?? b.primary_name ?? undefined,
    badge: "protein",
    icon: "protein",
    reviewed: b.reviewed,
  };
}

function mapProteinProfile(b: BackendProteinProfile): ProteinEntityProfile {
  const summary = mapSummary(b);
  const geneIdXref = b.gene_crossrefs.find(
    (xref) => xref.namespace === "GeneID" && /^[0-9]+$/.test(xref.id),
  );
  return {
    type: "protein",
    id: b.accession,
    name: summary.name,
    symbol: summary.symbol ?? b.accession,
    organism: summary.organism,
    source: summary.source,
    taxonomyId: b.organism.taxonomy_id ?? undefined,
    sourceUrl: b.source_url,
    retrievedAt: b.retrieved_at,
    reviewed: b.reviewed,
    length: b.length ?? undefined,
    // UniProt tidak menyediakan ringkasan ramah pemula tervalidasi.
    // Dibiarkan kosong: UI menampilkan unavailable state, bukan teks karangan.
    summary: undefined,
    functionAnnotations: b.function_annotations,
    geneCrossrefs: b.gene_crossrefs,
    relatedGeneId: geneIdXref?.id,
  };
}

function mapGeneProfile(b: BackendGeneProfile): GeneEntityProfile {
  return {
    type: "gene",
    id: b.accession,
    name: b.primary_name ?? b.accession,
    symbol: b.primary_name ?? b.gene_symbols[0] ?? b.accession,
    organism: b.organism.scientific_name ?? "Unknown",
    source: normalizeSource(b.source),
    taxonomyId: b.organism.taxonomy_id ?? undefined,
    sourceUrl: b.source_url,
    retrievedAt: b.retrieved_at,
    // NCBI summary adalah teks sumber, bukan penjelasan pemula tervalidasi.
    summary: undefined,
    description: b.description ?? undefined,
    chromosome: b.chromosome ?? undefined,
    geneType: b.gene_type ?? undefined,
    synonyms: b.synonyms,
    crossReferences: b.cross_references,
    relatedProteins: b.related_proteins,
    proteinLinks: b.protein_links.map((link) => ({
      accession: link.accession,
      primaryName: link.primary_name ?? undefined,
      geneSymbols: link.gene_symbols,
      reviewed: link.reviewed ?? undefined,
      source: normalizeSource(link.source),
      sourceUrl: link.source_url,
      evidence: link.evidence,
    })),
  };
}

function mapProviders(providers: BackendProviderStatus[]): ProviderStatus[] {
  return providers.map((p) => ({
    name: p.name,
    status:
      p.status === "available" || p.status === "not_found" || p.status === "error"
        ? p.status
        : "error",
    detail: p.detail,
    count: p.count,
  }));
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

/** Kode detail provider → HTTP status sesuai kontrak backend. */
const ERROR_CODE_STATUS: Record<string, number> = {
  provider_error: 502,
  not_found: 404,
  bad_request: 400,
  cursor_invalid: 400,
  query_too_long: 400,
  rate_limited_by_uniprot: 429,
  rate_limited_by_ncbi: 429,
  upstream_uniprot_timeout: 504,
  upstream_ncbi_timeout: 504,
  upstream_uniprot_error: 502,
  upstream_uniprot_malformed: 502,
  upstream_uniprot_malformed_pagination: 502,
  upstream_ncbi_error: 502,
  upstream_ncbi_malformed: 502,
};

const STATUS_CODE: Record<string, number> = {
  provider_error: 502,
  not_found: 404,
  bad_request: 400,
};

function handleBackendError(body: unknown, fallbackStatus: number): ApiError {
  if (typeof body === "object" && body !== null && "detail" in body) {
    const b = body as { status?: string; detail: unknown };
    const detail = typeof b.detail === "string" ? b.detail : "Unknown error";
    const status =
      ERROR_CODE_STATUS[detail] ??
      (b.status ? STATUS_CODE[b.status] : undefined) ??
      fallbackStatus;
    return new ApiError(status, detail);
  }
  return new ApiError(fallbackStatus, "Unknown error");
}

/* ---------- Public API ---------- */

export type EntityTypeFilter = "all" | "gene" | "protein";

export interface SearchParams {
  q: string;
  entity_type?: EntityTypeFilter;
  page_size?: number;
  cursor?: string;
  /** Membatalkan request lama saat filter/query berubah. */
  signal?: AbortSignal;
}

/**
 * Cari entitas biologis (gen + protein).
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
    return {
      query: "",
      entities: [],
      disambiguation: undefined,
      isDemo: false,
      provider_status: "not_found",
      providers: [],
    };
  }

  const url = new URL(resolveUrl("/api/v1/search"), typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  url.searchParams.set("q", q);
  url.searchParams.set("entity_type", params.entity_type ?? "all");
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
      signal: params.signal,
      // 60s timeout handled by proxy
    });

    const body = await response.json();

    if (!response.ok) {
      throw handleBackendError(body, response.status);
    }

    const backend = body as BackendSearchResponse;
    const entities = backend.results.map(mapSummary);

    // Gen dan protein = entitas berbeda. Catatan muncul saat keduanya hadir.
    const hasGeneProteinPair =
      entities.some((e) => e.type === "gene") &&
      entities.some((e) => e.type === "protein");

    return {
      query: backend.query,
      entities,
      disambiguation: hasGeneProteinPair
        ? "Names that look similar can refer to different entities. moLearn keeps genes and proteins separate."
        : undefined,
      isDemo: false,
      next_cursor: backend.next_cursor ?? undefined,
      provider_status: backend.provider_status,
      providers: mapProviders(backend.providers ?? []),
      matchMode: backend.match_mode,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(502, `Connection error: ${error instanceof Error ? error.message : "Unknown"}`);
  }
}

/** Validasi GeneID sesuai kontrak backend (angka positif, maks. 12 digit). */
function isGeneId(value: string): boolean {
  return /^[1-9][0-9]{0,11}$/.test(value);
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
  if (type !== "protein" && type !== "gene") {
    throw new ApiError(404, "Unknown entity type");
  }
  if (type === "gene" && !isGeneId(id)) {
    throw new ApiError(422, "invalid gene_id: expected a positive numeric NCBI GeneID");
  }

  if (IS_DEMO_MODE) {
    return fetchEntityProfileDemo(type, id);
  }

  const path =
    type === "protein"
      ? `/api/v1/entities/protein/${encodeURIComponent(id)}`
      : `/api/v1/entities/gene/${encodeURIComponent(id)}`;
  const url = new URL(resolveUrl(path), typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const body = await response.json();

    if (response.status === 404) {
      throw new ApiError(404, `${type}_not_found`);
    }
    if (!response.ok) {
      throw handleBackendError(body, response.status);
    }

    if (type === "protein") {
      return mapProteinProfile(body as BackendProteinProfile);
    }
    return mapGeneProfile(body as BackendGeneProfile);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, `Connection error: ${error instanceof Error ? error.message : "Unknown"}`);
  }
}

/* ---------- Demo mode implementations ---------- */

function searchEntitiesDemo(params: SearchParams): SearchResult {
  const q = params.q.trim().toLowerCase();
  const typeFilter = params.entity_type ?? "all";

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

  const entities = baseEntities.filter(
    (e) => matchesQuery(e) && (typeFilter === "all" || e.type === typeFilter),
  );

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
    provider_status: entities.length > 0 ? "available" : "not_found",
    matchMode: "name",
  };
}

function fetchEntityProfileDemo(type: string, id: string): EntityProfile {
  if (type === "gene") {
    const gene = GENE_PROFILE_FIXTURES.find((g) => g.id === id);
    if (!gene) {
      throw new ApiError(404, "gene_not_found");
    }
    return gene;
  }

  const all = [...FEATURED_ENTITIES, ...SEARCH_FIXTURE];
  const found = all.find((e) => e.type === type && e.id === id);

  if (!found) {
    throw new ApiError(404, "protein_not_found");
  }

  // Cross-reference demo yang TERVALIDASI (dikurasi dari fixture gen/protein).
  const demoCrossrefs: Record<string, { namespace: string; id: string }[]> = {
    P04637: [
      { namespace: "GeneID", id: "7157" },
      { namespace: "HGNC", id: "HGNC:11998" },
    ],
  };

  return {
    type: "protein",
    id: found.id,
    name: found.name,
    symbol: found.symbol ?? found.name,
    organism: found.organism,
    source: found.source,
    summary: found.summary,
    functionAnnotations: [],
    geneCrossrefs: demoCrossrefs[found.id] ?? [],
    relatedGeneId: found.id === "P04637" ? "7157" : undefined,
    sourceUrl: found.id.startsWith("P")
      ? `https://www.uniprot.org/uniprotkb/${found.id}`
      : undefined,
  };
}
