import { cn } from "@/lib/cn";
import { ENTITY_TYPE_LABELS, type EntityType } from "@/types/molearn";

/**
 * EntityBadge — chip tipe entitas (GEN / PROTEIN / HORMON / ENZIM)
 * dengan warna aksen pastel per tipe. Dipakai di kartu hasil & kartu
 * ensiklopedia. Label memakai DM Sans (bukan pixel font) agar tetap
 * mudah dibaca; warna aksen lembut mempertahankan identitas kategori.
 */
const badgeStyles: Record<EntityType, string> = {
  gene: "bg-secondary-container text-on-secondary-container",
  protein: "bg-tertiary-container text-on-tertiary-container",
};

export function EntityBadge({
  type,
  className,
}: {
  type: EntityType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-outline-subtle px-sm py-xs font-label text-label-md",
        badgeStyles[type],
        className,
      )}
    >
      {ENTITY_TYPE_LABELS[type]}
    </span>
  );
}
