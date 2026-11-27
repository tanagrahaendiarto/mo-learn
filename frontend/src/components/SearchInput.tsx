"use client";

import { cn } from "@/lib/cn";
import { IconMagnifier } from "@/components/icons";
import { PixelButton } from "@/components/PixelButton";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

/**
 * SearchInput — form pencarian entitas (hero landing & halaman /search).
 * Mengirim ke `/search?q=...` (router Next). `as` prop membolehkan
 * penggunaan di server component via render dari komponen client.
 *
 * Layout: pada `column` (mobile) input memanjang penuh lalu tombol
 * mengikuti di bawah; pada `sm:flex-row` input melebar (flex-1) dan
 * tombol tetap di samping. `min-h` menjamin touch target nyaman.
 */

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  /** Label tombol submit. */
  submitLabel?: string;
  /** Isi default dari URL (halaman /search). */
  defaultValue?: string;
  /** Elemen tambahan di sisi kanan form (mis. filter, tombol state demo). */
  trailing?: ReactNode;
  /** Arah: kolom (mobile hero) atau baris (toolbar). */
  orientation?: "column" | "row";
  /** Handler kustom — membatalkan submit bawaan router. */
  onSearch?: (query: string) => void;
}

export function SearchInput({
  submitLabel = "Search",
  defaultValue,
  trailing,
  orientation = "column",
  onSearch,
  className,
  ...inputProps
}: SearchInputProps) {
  const router = useRouter();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement)
      .value;
    if (onSearch) {
      onSearch(q);
      return;
    }
    const clean = q.trim();
    router.push(clean ? `/search?q=${encodeURIComponent(clean)}` : "/search");
  }

  const isColumn = orientation === "column";

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn(
        "flex gap-sm",
        isColumn
          ? "mt-xs flex-col sm:max-w-[42rem] sm:flex-row sm:items-center"
          : "flex-col",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex min-w-0 items-center",
          isColumn && "w-full sm:flex-1",
          !isColumn && "flex-1",
        )}
      >
        <IconMagnifier className="pointer-events-none absolute left-md h-5 w-5 text-on-surface-variant" />
        <input
          name="q"
          type="search"
          defaultValue={defaultValue}
          aria-label="Search genes, proteins, or accession IDs"
          placeholder="Search genes, proteins, or accession IDs..."
          className={cn(
            "w-full min-h-12 rounded-md border border-outline-subtle bg-surface-card px-md pl-2xl font-body text-body-md text-on-surface-card shadow-card-sm placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-tertiary",
          )}
          {...inputProps}
        />
      </div>
      <div className={cn("flex items-center gap-sm", isColumn && "sm:shrink-0")}>
        <PixelButton type="submit" size={isColumn ? "md" : "sm"}>
          {submitLabel}
        </PixelButton>
        {trailing}
      </div>
    </form>
  );
}
