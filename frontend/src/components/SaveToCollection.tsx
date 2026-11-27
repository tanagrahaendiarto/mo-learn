"use client";

import { useCollection } from "@/lib/use-collection";
import { collectionKey, type EntitySource, type EntityType } from "@/types/molearn";
import { PixelButton } from "@/components/PixelButton";

/**
 * SaveToCollection — tombol simpan/hapus pada profil entitas.
 *
 * Idempotent lewat identitas kanonik (`type + source + id`): tombol
 * menampilkan status tersimpan/tidak dan beralih antara "Save" dan
 * "Remove". Record tersimpan membawa `source` + `isDemo` agar koleksi
 * dapat membedakan demo dari data live.
 */
export interface SaveTarget {
  type: EntityType;
  id: string;
  name: string;
  symbol?: string;
  organism: string;
  source: EntitySource;
  isDemo?: boolean;
}

export function SaveToCollection({ entity }: { entity: SaveTarget }) {
  const { items, add, remove } = useCollection();
  const key = collectionKey(entity.type, entity.source, entity.id);
  const saved = items.some(
    (x) => collectionKey(x.type, x.source, x.id) === key,
  );

  function toggle() {
    if (saved) {
      remove(entity.type, entity.source, entity.id);
    } else {
      add({
        type: entity.type,
        id: entity.id,
        name: entity.name,
        symbol: entity.symbol,
        organism: entity.organism,
        source: entity.source,
        isDemo: entity.isDemo,
        savedAt: new Date().toISOString(),
      });
    }
  }

  return (
    <PixelButton
      variant={saved ? "ghost" : "primary"}
      size="md"
      onClick={toggle}
      aria-pressed={saved}
    >
      {saved ? "Remove from Collection" : "Save to Collection"}
    </PixelButton>
  );
}
