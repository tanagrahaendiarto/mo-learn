"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GLOSSARY_FIXTURE } from "@/data/fixtures";
import { IconMagnifier } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Biology Glossary — an encyclopedia of core bioinformatics terms.
 *
 * Translated from blueprint Stitch page 5:
 *  - Text filter + alphabetical buttons (first letter of each term).
 *  - Definition cards with "Term #NN", the initial, an example, and a link
 *    to the related module/entity.
 */

const LETTERS = getLetterFilters();

/** Unique first letters from the data (alphabetical), as in the blueprint. */
function getLetterFilters(): string[] {
  const set = new Set<string>();
  for (const entry of GLOSSARY_FIXTURE) {
    set.add(entry.term.charAt(0).toUpperCase());
  }
  return [...set].sort();
}

export default function GlossaryPage() {
  const [letter, setLetter] = useState<string>("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      GLOSSARY_FIXTURE.filter((t) => {
        const matchL =
          letter === "All" || t.term.toUpperCase().startsWith(letter);
        const q = query.trim().toLowerCase();
        const matchQ =
          q === "" ||
          `${t.term} ${t.definition} ${t.example ?? ""}`
            .toLowerCase()
            .includes(q);
        return matchL && matchQ;
      }),
    [letter, query],
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-md py-xl md:px-xl">
      {/* Header */}
      <section className="mb-xl">
        <h1 className="font-headline text-headline-lg-mobile text-on-surface md:text-headline-lg">
          Biology Glossary
        </h1>
        <p className="mt-xs mb-lg max-w-prose font-body text-body-md text-on-surface-variant">
          Understand core bioinformatics and cell-biology terms with short
          definitions, real examples, and direct links to exploration modules.
        </p>

        <div className="flex flex-col justify-between gap-md md:flex-row md:items-center">
          <div className="relative flex max-w-[32rem] flex-1 items-center">
            <IconMagnifier className="pointer-events-none absolute left-md h-5 w-5 text-on-surface-variant" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search biology terms"
              placeholder="Search terms (e.g. Ligand, Isoform, Accession)..."
              className="w-full rounded-md border border-outline-subtle bg-surface-card py-sm pl-2xl pr-md font-body text-body-md text-on-surface-card shadow-card-sm focus:outline-none focus:ring-2 focus:ring-tertiary"
            />
          </div>

          <div
            className="flex flex-wrap items-center gap-xs"
            role="group"
            aria-label="Alphabetical filter"
          >
            <LetterButton active={letter === "All"} onClick={() => setLetter("All")} label="All" />
            {LETTERS.map((l) => (
              <LetterButton key={l} active={letter === l} onClick={() => setLetter(l)} label={l} />
            ))}
          </div>
        </div>
      </section>

      {/* Definition cards grid */}
      {filtered.length > 0 ? (
        <section className="grid grid-cols-1 gap-lg md:grid-cols-2">
          {filtered.map((t, i) => (
            <article
              key={t.term}
              className="flex flex-col justify-between overflow-hidden rounded-lg border border-outline-subtle bg-surface-card shadow-card"
            >
              <div>
                <div className="flex items-center justify-between border-b border-outline-subtle bg-muted-green px-md py-xs">
                  <span className="font-label text-label-sm text-on-surface-variant">
                    Term #{String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="rounded-sm border border-outline-subtle bg-surface-card px-xs font-label text-label-sm">
                    {t.term.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col gap-xs p-lg">
                  <h2 className="font-headline text-headline-sm text-on-surface-card">
                    {t.term}
                  </h2>
                  <p className="font-body text-body-md text-on-surface-card">
                    {t.definition}
                  </p>
                  {t.example && (
                    <p className="mt-xs font-body text-body-sm text-on-surface-variant">
                      <strong>Example:</strong> {t.example}
                    </p>
                  )}
                </div>
              </div>
              <footer className="border-t border-outline-subtle bg-surface px-lg py-sm">
                {t.link && (
                  <Link
                    href={t.link.href}
                    className="font-label text-label-md text-primary hover:underline"
                  >
                    {t.link.label} →
                  </Link>
                )}
              </footer>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-lg border border-outline-subtle bg-surface-card p-xl text-center shadow-card">
          <p className="font-body text-body-md text-on-surface-variant">
            No terms match your search.
          </p>
        </section>
      )}
    </div>
  );
}

function LetterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border border-outline-subtle px-sm py-xs font-label text-label-sm",
        active
          ? "bg-primary text-on-primary"
          : "bg-surface text-on-surface hover:bg-muted-green",
      )}
    >
      {label}
    </button>
  );
}
