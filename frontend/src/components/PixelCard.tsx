import { cn } from "@/lib/cn";
import type { ElementType, HTMLAttributes } from "react";

/**
 * PixelCard — panel dasar moLearn: permukaan kartu, border halus 1px,
 * sudut lembut, dan shadow lembut (bukan offset solid 16-bit) sehingga
 * tampil modern & mudah dibaca. Pixel identity dipertahankan lewat
 * aksen kecil (ikon logo/ikon biologis), bukan lewat panel besar.
 * `as` mendukung anchor interaktif (kartu ensiklopedia).
 *
 * Aksen kategori (gene/protein/enzyme/hormone) dikoordinasikan oleh
 * konsumen lewat `accentHeader()` — kartu tetap komposisional.
 */

interface PixelCardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** Anchor target — hanya bermakna saat `as="a"`. */
  href?: string;
  /** Shadow besar (panel utama) atau kecil (badge/komponen ringkas). */
  shadow?: "lg" | "sm";
  /** Kartu interaktif: naik halus saat hover. */
  hoverable?: boolean;
  children: React.ReactNode;
}

export function PixelCard({
  as: Tag = "div",
  shadow = "lg",
  hoverable = false,
  className,
  children,
  ...rest
}: PixelCardProps) {
  return (
    <Tag
      {...rest}
      className={cn(
        "bg-surface-card text-on-surface-card border border-outline-subtle rounded-md",
        shadow === "lg" ? "shadow-card" : "shadow-card-sm",
        hoverable &&
          "transition-transform duration-press ease-press hover:-translate-y-0.5 hover:shadow-card",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Kelas chip aksen kategori entitas — pastel solid diganti chip kecil
 * non-all-caps agar tidak terasa "game-like". Dipakai di header kartu.
 */
export function accentHeader(category: "gene" | "protein" | "hormone" | "enzyme") {
  const map: Record<"gene" | "protein" | "hormone" | "enzyme", string> = {
    gene: "bg-secondary-container text-on-secondary-container",
    protein: "bg-tertiary-container text-on-tertiary-container",
    hormone: "bg-tertiary-container text-on-tertiary-container",
    enzyme: "bg-amber-container text-on-amber-container",
  };
  return map[category];
}
