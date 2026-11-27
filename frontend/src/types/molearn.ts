/**
 * Tipe data domain moLearn.
 *
 * Gen dan protein adalah entitas yang BERBEDA: moLearn tidak pernah
 * menggabungkan keduanya secara otomatis (lihat PRD, bagian identifikasi).
 */

/**
 * Tipe entitas biologis yang dikenal moLearn.
 * Hanya gen dan protein yang merupakan *entity type*. Enzim dan hormon
 * adalah kategori fungsional (ditampilkan sebagai badge/ikon), bukan
 * tipe entitas mandiri, sehingga tidak punya rute profil sendiri.
 */
export type EntityType = "gene" | "protein";

/** Label tampilan tipe entitas. */
export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  gene: "Gene",
  protein: "Protein",
};

/** Validasi tipe dari URL/parameter. */
export const ENTITY_TYPES: readonly EntityType[] = [
  "gene",
  "protein",
] as const;

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

/** Penyedia data eksternal yang dirujuk oleh entitas. */
export type EntitySource =
  | "UniProt"
  | "NCBI Gene"
  | "PDB"
  | "STRING"
  | "Local (demo)"
  | "Unknown";

/** Label sumber tak dikenal (provenance hilang pada record lama). */
export const UNKNOWN_SOURCE_LABEL = "Unknown source";

/**
 * Ringkasan entitas biologis — unit data hasil pencarian
 * (kontrak provisional `GET /api/v1/search` + fixture dev).
 */
export interface BiologicalEntitySummary {
  /** Tipe entitas. */
  type: EntityType;
  /** Identifikator unik per tipe, mis. `P04637` (UniProt) atau `HGNC:11998`. */
  id: string;
  /** Nama panjang / deskriptif entitas. */
  name: string;
  /** Simbol pendek (mis. `TP53`, `p53`, `Ins`). */
  symbol?: string;
  /** Organisme sumber, binomial Latin, mis. `Homo sapiens`. */
  organism: string;
  /** Penyedia data asal. */
  source: EntitySource;
  /** Deskripsi singkat ramah pemula (Bahasa Indonesia). */
  summary: string;
  /** ID taksonomi dari penyedia (bila tersedia). */
  taxonomyId?: number;
  /** Tautan record asli di penyedia data. */
  sourceUrl?: string;
  /** Waktu pengambilan record dari penyedia (ISO 8601 UTC). */
  retrievedAt?: string;
  /** Status review UniProt — hanya ada pada record protein. */
  reviewed?: boolean;
  /**
   * true bila bagian data (mis. struktur/interaksi) belum tersedia
   * di penyedia — membedakan "Data belum tersedia" vs error jaringan.
   */
  partial?: boolean;
  /**
   * Badge visual kartu (sesuai blueprint Stitch): warna aksen per kategori
   * kartu, bukan per tipe data. Digunakan oleh `EntityCard`.
   */
  badge?: "gene" | "protein" | "hormone" | "enzyme";
  /** Ikon kartu pixel-art. */
  icon?: "dna" | "protein" | "hormone" | "enzyme";
  /** Kode DEX (mis. `#001`) bila entitas ditampilkan di ensiklopedia. */
  dexCode?: string;
  /**
   * Nama lain/alias entitas (mis. gen `TP53` ↔ protein `p53`),
   * dipakai pemadanan pencarian agar pasangan gene/protein sama
   * muncul dan catatan disambiguasi bisa ditampilkan.
   */
  aliases?: string[];
}

/** Hasil pencarian - entitas + catatan disambiguasi bila relevan. */
export interface SearchResult {
  query: string;
  entities: BiologicalEntitySummary[];
  /**
   * Catatan identifikasi Gen vs Protein - hanya muncul saat ada nama
   * yang mirip merujuk dua entitas berbeda (lihat halaman pencarian Stitch).
   */
  disambiguation?: string;
  /** true bila data berasal dari fixture lokal (backend belum terhubung). */
  isDemo: boolean;
  /** Cursor opaque lintas provider; null/undefined = tidak ada halaman lagi. */
  next_cursor?: string;
  /** Status gabungan penyedia data. */
  provider_status?: "available" | "not_found" | "partial" | "error";
  /** Status per penyedia (UniProt / NCBI Gene). */
  providers?: ProviderStatus[];
  /** Cara query dicocokkan oleh backend. */
  matchMode?: "exact_accession" | "exact_geneid" | "name";
}

/** Status satu penyedia pada pencarian campuran. */
export interface ProviderStatus {
  name: string;
  status: "available" | "not_found" | "error";
  detail?: string | null;
  count: number;
}

/**
 * Entitas tersimpan di "Koleksi Saya" (localStorage, tanpa akun).
 *
 * Identitas kanonik = `type + source + id` (lihat `collectionKey`).
 * `source`/`isDemo` bersifat opsional untuk kompatibilitas record lama:
 * record tanpa `source` DIPERTAHANKAN dengan provenance "unknown",
 * TIDAK otomatis digolongkan sebagai data demo.
 */
export interface SavedEntity {
  type: EntityType;
  id: string;
  name: string;
  /** Simbol pendek (mis. `TP53`, `p53`). */
  symbol?: string;
  organism: string;
  /** Namespace sumber (UniProt, NCBI Gene, ...). */
  source?: EntitySource;
  /** true bila record berasal dari fixture demo lokal. */
  isDemo?: boolean;
  /** Catatan singkat yang disimpan bersama item koleksi. */
  note?: string;
  /**
   * Identifier lama yang sudah dimigrasikan ke identifier kanonik.
   * Dipertahankan agar konversi tidak menghapus jejak provenance.
   */
  legacyId?: string;
  /** Waktu disimpan (ISO 8601). */
  savedAt: string;
}

/**
 * Kunci kanonik item koleksi: tipe + namespace sumber + identifier.
 * Dipakai dedup agar record yang sama dari sumber berbeda tidak
 * tertukar, dan record lama tanpa `source` tetap bisa dibedakan
 * (namespace `unknown`).
 */
export function collectionKey(
  type: EntityType,
  source: EntitySource | undefined,
  id: string,
): string {
  return `${type}\u0000${source ?? "unknown"}\u0000${id}`;
}

/** Istilah glosarium biologi. */
export interface GlossaryEntry {
  term: string;
  definition: string;
  /** Contoh nyata singkat yang menyertai definisi (dari blueprint glosarium). */
  example?: string;
  /** Tautan internal ke entitas/hasil pencarian terkait. */
  link?: { label: string; href: string };
  /** Rujukan entitas terkait (mis. accession). */
  relatedEntity?: string;
}

/** Modul eksplorasi yang tersedia di profil entitas. */
export type ExplorationModule =
  | "structure"
  | "ligand"
  | "interaction"
  | "sequence"
  | "literature"
  | "export";

/** Status konten modul eksplorasi (honest, tanpa fabrikasi). */
export type ExplorationModuleState =
  | "available"
  | "loading"
  | "empty"
  | "unavailable"
  | "provider-error";

/** Kontrak data satu modul eksplorasi untuk dipakai komponen UI. */
export interface ExplorationModuleData {
  module: ExplorationModule;
  title: string;
  description: string;
  state: ExplorationModuleState;
  /** Teks penjelasan saat state bukan `available` (jujur, tidak mengarang). */
  detail?: string;
}

/** Field identitas yang dimiliki semua profil entitas. */
export interface EntityProfileBase {
  type: EntityType;
  id: string;
  name: string;
  symbol: string;
  organism: string;
  source: EntitySource;
  /** ID taksonomi dari penyedia. */
  taxonomyId?: number;
  /**
   * Ringkasan ramah pemula yang tervalidasi. Bila kosong, TIDAK ada
   * penjelasan tervalidasi → UI menampilkan unavailable state, bukan
   * teks karangan.
   */
  summary?: string;
  /** Tautan record asli di penyedia data. */
  sourceUrl?: string;
  /** Waktu pengambilan record dari penyedia (ISO 8601 UTC). */
  retrievedAt?: string;
}

/** Cross-reference yang dilaporkan penyedia (namespace + id). */
export interface EntityCrossReference {
  namespace: string;
  id: string;
}

/** Protein yang terhubung ke gen, dengan bukti cross-reference GeneID UniProt. */
export interface ProteinLink {
  accession: string;
  primaryName?: string;
  geneSymbols: string[];
  reviewed?: boolean;
  source: EntitySource;
  sourceUrl: string;
  evidence: string;
}

/** Profil protein — `GET /api/v1/entities/protein/{accession}`. */
export interface ProteinEntityProfile extends EntityProfileBase {
  type: "protein";
  /** true = UniProt reviewed (Swiss-Prot); false = unreviewed (TrEMBL). */
  reviewed?: boolean;
  /** Panjang sekuens (jumlah asam amino) — METADATA, bukan sekuens itu sendiri. */
  length?: number;
  /** Anotasi fungsi mentah dari sumber (verbatim, boleh kosong). */
  functionAnnotations: string[];
  /** Cross-reference gen dari sumber (namespace + id), termasuk GeneID/HGNC. */
  geneCrossrefs: EntityCrossReference[];
  /** GeneID kanonik bila sumber menyediakannya. */
  relatedGeneId?: string;
}

/** Profil gen — `GET /api/v1/entities/gene/{gene_id}` (NCBI Gene). */
export interface GeneEntityProfile extends EntityProfileBase {
  type: "gene";
  /** Ringkasan NCBI (`Entrezgene_summary`), verbatim — bukan penjelasan pemula. */
  description?: string;
  /** Lokasi sitogenetik, mis. `17p13.1`. */
  chromosome?: string;
  /** Jenis gen NCBI, mis. `protein-coding`. */
  geneType?: string;
  synonyms: string[];
  crossReferences: EntityCrossReference[];
  /** Nama protein dari NCBI — nama saja, tanpa accession. */
  relatedProteins: string[];
  /** Link gen→protein yang didukung bukti cross-reference GeneID UniProt. */
  proteinLinks: ProteinLink[];
}

/** Profil entitas bertipe (discriminated union gen | protein). */
export type EntityProfile = ProteinEntityProfile | GeneEntityProfile;

/* ---------- Relationship Explorer (Task D) ---------- */

/** Node relasi bertipe (gene | protein). */
export interface RelationshipNode {
  /** Kunci unik internal node. */
  key: string;
  type: EntityType;
  id: string;
  symbol?: string;
  name: string;
  organism?: string;
  /** true bila node berasal dari fixture demo. */
  isDemo?: boolean;
}

/** Relasi bertipe antara dua node, dengan sumber/evidence eksplisit. */
export interface RelationshipEdge {
  id: string;
  from: string; // node key
  to: string; // node key
  /** Label relasi eksplisit (mis. "cross-reference"), TIDAK disimpulkan. */
  label: string;
  /** Namespace sumber yang mendukung relasi ini. */
  source: string;
  /** Evidence/keterangan pendukung bila tersedia. */
  evidence?: string;
  isDemo?: boolean;
}

/** Graf relasi internal frontend (independen dari implementasi visualisasi). */
export interface RelationshipGraph {
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  isDemo: boolean;
}

