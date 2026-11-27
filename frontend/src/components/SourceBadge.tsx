import { cn } from "@/lib/cn";
import type { EntitySource } from "@/types/molearn";

/**
 * SourceBadge — label sumber data (UniProt, NCBI Gene, PDB, STRING,
 * atau "Lokal (demo)" saat fixture dipakai). Penanda demo dibuat
 * menonjol (aksen amber) agar tidak disalahartikan sebagai data live.
 */
export function SourceBadge({
  source,
  className,
}: {
  source: EntitySource;
  className?: string;
}) {
  const isDemo = source === "Local (demo)";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-xs rounded-md border border-outline-subtle px-sm py-xs font-label text-label-sm",
        isDemo
          ? "bg-amber-container text-on-amber-container"
          : "bg-muted-green text-on-muted-green",
        className,
      )}
    >
      {source}
    </span>
  );
}
