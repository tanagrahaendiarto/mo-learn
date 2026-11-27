"use client";

import { useSyncExternalStore } from "react";
import type { SavedEntity } from "@/types/molearn";

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
 *  - Setiap mutasi (hapus / muat demo) ditulis ke localStorage lalu
 *    memnotifikasi subscriber; perubahan tetap tampil in-memory
 *    bila persistensi gagal (private mode / kuota penuh).
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
      snapshot = readStored();
    }
    return snapshot;
  },

  /** Snapshot server (SSR) — selalu kosong, tidak menyentuh storage. */
  getServerSnapshot(): readonly SavedEntity[] {
    return EMPTY;
  },

  /** Hapus item (kunci `type + id` unik lintas tipe). */
  remove(type: SavedEntity["type"], id: string): void {
    snapshot = snapshot.filter((x) => !(x.type === type && x.id === id));
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
    remove: collectionStore.remove,
    loadDemo: collectionStore.loadDemo,
  };
}
