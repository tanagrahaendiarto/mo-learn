"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * HelpTooltip — bantuan kontekstual aksesibel.
 *
 * Tombol "?" dengan `aria-describedby` menunjuk ke tooltip (role="tooltip").
 * Tooltip tampil saat hover (pointer) ATAU focus (keyboard) via Tailwind
 * `group-hover` / `group-focus-within`, tanpa JavaScript tambahan.
 * `prefers-reduced-motion` ditangani global di globals.css.
 */
export function HelpTooltip({
  label,
  text,
  className,
}: {
  /** Nama singkat aksesibel tombol (mis. "About Reviewed entry"). */
  label: string;
  /** Isi bantuan yang ditampilkan. */
  text: string;
  className?: string;
}) {
  const id = useId();
  return (
    <span className={cn("group relative inline-flex items-center", className)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-outline-subtle bg-muted-green font-label text-label-sm leading-none text-on-muted-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary"
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-xs hidden w-64 max-w-[80vw] rounded-md border border-outline-subtle bg-surface-card p-sm text-left font-body text-body-sm text-on-surface-card shadow-card group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}
