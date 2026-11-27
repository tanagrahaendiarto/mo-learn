"use client";

import { useSyncExternalStore } from "react";
import type { SavedEntity, EntityType, EntitySource } from "@/types/molearn";
import { collectionKey } from "@/types/molearn";

/**
 * Penyimpanan lokal "Koleksi Saya" sebagai external store React
 * (tanpa akun, sesuai PRD fase 1).
 *
 * Pola `useSyncExternalStore`:
 *  - Server/SSR memakai snapshot kosong (`getServerSnapshot`),
 *    sehingga tidak menyentuh `window.localStorage`.
 *  - Klien menghidrasi snapshot dari localStorage secara lazy pada
 *    pemanggilan `getSnapshot` pertama (di-guard flag modul, jadi
 *    aman dipanggil berulang dan bebas efek `setState`).
 *  - Setiap mutasi (tambah / hapus / muat demo) ditulis ke localStorage
 *    lalu memnotifikasi subscriber; perubahan tetap tampil in-memory
 *    bila persistensi gagal (private mode / kuota penuh).
 *
 * Identitas kanonik item = `type + source + id` (lihat `collectionKey`).
 * Dedup memakai kunci ini agar record sama dari sumber berbeda tidak
 * tertukar. Record lama tanpa `source` DIPERTAHANKAN dengan provenance
 * unknown (namespace `unknown`), TIDAK digolongkan sebagai demo.
 *
 * Kunci penyimpanan: `molearn_collection` (sesuai blueprint halaman 4).
 */

const STORAGE_KEY = "molearn_collection";

const EMPTY: readonly SavedEntity[] = [];

let snapshot: readonly SavedEntity[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

/** Validasi ringan bentuk item — menolak baris yang tidak dikenali. */
function isSavedEntity(value: unknown): value is SavedEntity {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === "string" &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.organism === "string"
  );
}

/**
 * Migrasi identifier lama → identifier kanonik, HANYA untuk pemetaan yang
 * terverifikasi. Satu-satunya entri: HGNC:11998 → NCBI GeneID 7157
 * (dibuktikan oleh cross-reference NCBI Gene 7157 dan UniProt P04637).
 * Record tanpa pemetaan terverifikasi dipertahankan apa adanya.
 */
const VERIFIED_LEGACY_GENE_IDS: Record<string, string> = {
  "HGNC:11998": "7157",
};

function migrateLegacy(entities: SavedEntity[]): SavedEntity[] {
  const seen = new Set<string>();
  const out: SavedEntity[] = [];
  for (const entity of entities) {
    const verifiedId =
      entity.type === "gene" ? VERIFIED_LEGACY_GENE_IDS[entity.id] : undefined;
    const migrated = verifiedId
      ? { ...entity, id: verifiedId, legacyId: entity.legacyId ?? entity.id }
      : entity;
    const key = collectionKey(migrated.type, migrated.source, migrated.id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(migrated);
  }
  return out;
}

function readStored(): SavedEntity[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(isSavedEntity);
    }
  } catch {
    // JSON rusak / akses ditolak → koleksi mulai kosong, tanpa crash.
  }
  return [];
}

function write(next: readonly SavedEntity[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Persistensi gagal — state tetap in-memory selama sesi ini.
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

export const collectionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * Snapshot klien. Hidrasi dari localStorage terjadi sekali, pada
   * pemanggilan pertama di lingkungan browser (guard `hydrated`),
   * sehingga aman dipanggil berulang tanpa efek samping.
   */
  getSnapshot(): readonly SavedEntity[] {
    if (!hydrated && typeof window !== "undefined") {
      hydrated = true;
      const stored = readStored();
      const migrated = migrateLegacy(stored);
      snapshot = migrated;
      if (migrated.some((item, i) => item !== stored[i])) {
        write(migrated);
      }
    }
    return snapshot;
  },

  /** Snapshot server (SSR) — selalu kosong, tidak menyentuh storage. */
  getServerSnapshot(): readonly SavedEntity[] {
    return EMPTY;
  },

  /**
   * Tambah item. Idempotent: bila record dengan kunci kanonik yang sama
   * (`type + source + id`) sudah ada, tidak menambah duplikat.
   */
  add(item: SavedEntity): void {
    collectionStore.getSnapshot(); // pastikan terhidrasi
    const key = collectionKey(item.type, item.source, item.id);
    if (
      snapshot.some(
        (x) => collectionKey(x.type, x.source, x.id) === key,
      )
    ) {
      return; // sudah tersimpan — cegah duplikat
    }
    snapshot = [...snapshot, item];
    write(snapshot);
    notify();
  },

  /** true bila record dengan kunci kanonik tersebut sudah tersimpan. */
  has(type: EntityType, source: EntitySource | undefined, id: string): boolean {
    collectionStore.getSnapshot(); // pastikan terhidrasi
    const key = collectionKey(type, source, id);
    return snapshot.some(
      (x) => collectionKey(x.type, x.source, x.id) === key,
    );
  },

  /** Hapus item (kunci `type + source + id` unik lintas tipe/sumber). */
  remove(type: EntityType, source: EntitySource | undefined, id: string): void {
    collectionStore.getSnapshot(); // pastikan terhidrasi
    const key = collectionKey(type, source, id);
    snapshot = snapshot.filter(
      (x) => collectionKey(x.type, x.source, x.id) !== key,
    );
    write(snapshot);
    notify();
  },

  /** Muat ulang contoh koleksi (tombol "Muat Contoh Koleksi"). */
  loadDemo(items: readonly SavedEntity[]): void {
    snapshot = items.slice();
    write(snapshot);
    notify();
  },
};

/** Hook ergonomis untuk halaman "Koleksi Saya". */
export function useCollection() {
  const items = useSyncExternalStore(
    collectionStore.subscribe,
    collectionStore.getSnapshot,
    collectionStore.getServerSnapshot,
  );
  return {
    items,
    add: collectionStore.add,
    has: collectionStore.has,
    remove: collectionStore.remove,
    loadDemo: collectionStore.loadDemo,
  };
}
