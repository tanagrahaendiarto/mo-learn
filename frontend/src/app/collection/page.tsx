"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ENTITY_TYPE_LABELS,
  UNKNOWN_SOURCE_LABEL,
  type EntityType,
} from "@/types/molearn";
import { useCollection } from "@/lib/use-collection";
import { DEMO_COLLECTION, COLLECTION_SLOT_CAP } from "@/data/fixtures";
import { SourceBadge } from "@/components/SourceBadge";
import {
  IconMagnifier,
  IconCollectionGene,
  IconCollectionProtein,
} from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * My Collection — local storage (localStorage), no account.
 *
 * Translated from blueprint Stitch page 4:
 *  - Inventory "slots" with a `N / 20 slots` counter.
 *  - Category filter + text filter box.
 *  - Grid of slot cards, each with "Open Profile" + "Remove".
 *  - Empty state with a "Load Sample Collection" button.
 */

const CATEGORY_FILTERS: { key: string; label: string; type?: EntityType }[] = [
  { key: "All", label: "All" },
  { key: "Gene", label: "Gene", type: "gene" },
  { key: "Protein", label: "Protein", type: "protein" },
];

export default function CollectionPage() {
  const { items, remove, loadDemo } = useCollection();
  const [category, setCategory] = useState<string>("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const activeType = CATEGORY_FILTERS.find((c) => c.key === category)?.type;
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const matchCat = !activeType || it.type === activeType;
      const matchQ =
        q === "" ||
        `${it.name} ${it.symbol ?? ""} ${it.id}`.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [items, category, query]);

  return (
    <div className="mx-auto w-full max-w-7xl px-md py-xl md:px-xl">
      {/* Header */}
      <section className="mb-xl">
        <div className="flex flex-col justify-between gap-md md:flex-row md:items-end">
          <div>
            <h1 className="font-headline text-headline-lg-mobile text-on-surface md:text-headline-lg">
              My Collection
            </h1>
            <p className="mt-xs font-body text-body-md text-on-surface-variant">
              Stored locally in your browser — no account or cloud sync
              required.
            </p>
            <p className="mt-xs font-mono text-mono-sm tabular-nums text-on-surface-variant">
              {items.length} / {COLLECTION_SLOT_CAP} slots
            </p>
          </div>

          <div className="relative flex w-full items-center sm:w-64">
            <IconMagnifier className="pointer-events-none absolute left-sm h-4 w-4 text-on-surface-variant" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search in collection"
              placeholder="Filter collection..."
              className="w-full rounded-md border border-outline-subtle bg-surface-card py-xs pl-2xl pr-md font-body text-body-sm text-on-surface-card shadow-card-sm focus:outline-none focus:ring-2 focus:ring-tertiary"
            />
          </div>
        </div>
      </section>

      {/* Category filter controls */}
      <section
        className="mb-lg flex flex-wrap items-center gap-sm"
        role="group"
        aria-label="Filter collection by category"
      >
        <span className="font-label text-label-md text-on-surface-variant">
          Category:
        </span>
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={cn(
              "rounded-md border border-outline-subtle px-md py-xs font-label text-label-md",
              category === c.key
                ? "bg-primary text-on-primary"
                : "bg-surface-card text-on-surface-card hover:bg-muted-green",
            )}
          >
            {c.label}
          </button>
        ))}
      </section>

      {/* Inventory grid / empty state */}
      {filtered.length > 0 ? (
        <section className="grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((it, idx) => (
            <article
              key={`${it.type}-${it.id}`}
              className="flex flex-col justify-between overflow-hidden rounded-lg border border-outline-subtle bg-surface-card shadow-card"
            >
              <div>
                <div
                  className={cn(
                    "flex items-center justify-between border-b border-outline-subtle px-md py-sm font-label text-label-sm",
                    it.type === "gene"
                      ? "bg-secondary-container text-on-secondary-container"
                      : "bg-tertiary-container text-on-tertiary-container",
                  )}
                >
                  <span>Slot #{String(idx + 1).padStart(2, "0")}</span>
                  <span>{ENTITY_TYPE_LABELS[it.type]}</span>
                </div>
                <div className="flex flex-col gap-sm p-lg">
                  <div className="flex items-start gap-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-outline-subtle bg-surface">
                      {it.type === "gene" ? (
                        <IconCollectionGene className="h-6 w-6" />
                      ) : (
                        <IconCollectionProtein className="h-6 w-6" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-headline text-headline-sm text-on-surface-card">
                        {it.name}
                      </h2>
                      <p className="font-mono text-mono-sm text-primary">
                        {it.symbol ?? it.id} • {it.id}
                      </p>
                      {it.legacyId && (
                        <p className="font-body text-body-sm text-on-surface-variant">
                          Migrated from {it.legacyId}
                        </p>
                      )}
                    </div>
                  </div>
                  <dl className="flex flex-col gap-xs font-body text-body-sm text-on-surface-variant">
                    <div>
                      <dt className="sr-only">Organism</dt>
                      <dd>{it.organism}</dd>
                    </div>
                    <div className="flex flex-wrap items-center gap-xs">
                      <dt className="sr-only">Source</dt>
                      <dd>
                        {it.source ? (
                          <SourceBadge source={it.source} />
                        ) : (
                          <span className="rounded-md border border-outline-subtle bg-surface px-sm py-xs font-label text-label-sm text-on-surface-variant">
                            {UNKNOWN_SOURCE_LABEL}
                          </span>
                        )}
                      </dd>
                      {it.isDemo && (
                        <span className="rounded-md border border-outline-subtle bg-amber-container px-sm py-xs font-label text-label-sm text-on-amber-container">
                          Demo
                        </span>
                      )}
                    </div>
                  </dl>
                  {it.note && (
                    <p className="font-body text-body-sm text-on-surface-variant">
                      {it.note}
                    </p>
                  )}
                </div>
              </div>
              <footer className="flex items-center justify-between gap-sm border-t border-outline-subtle bg-surface px-lg py-sm">
                <Link
                  href={`/entity/${it.type}/${encodeURIComponent(it.id)}`}
                  className="rounded-md border border-outline-subtle bg-primary px-md py-xs font-label text-label-md text-on-primary shadow-card-sm hover:bg-secondary hover:text-on-secondary"
                >
                  Open Profile
                </Link>
                <button
                  type="button"
                  onClick={() => remove(it.type, it.source, it.id)}
                  className="rounded-md border border-outline-subtle bg-surface-card px-sm py-xs font-label text-label-sm text-error hover:bg-error-container"
                >
                  Remove
                </button>
              </footer>
            </article>
          ))}
        </section>
      ) : (
        <section className="mx-auto my-xl max-w-[36rem] rounded-lg border border-outline-subtle bg-surface-card p-xl text-center shadow-card">
          <h2 className="mb-xs font-headline text-headline-md text-on-surface">
            {items.length === 0 ? "Your Collection Is Empty" : "Nothing Matches"}
          </h2>
          <p className="mb-lg font-body text-body-md text-on-surface-variant">
            {items.length === 0
              ? "You haven't saved any genes or proteins yet. Explore entities and click \"Save to Collection\"."
              : "No collection items match the current filters."}
          </p>
          <div className="flex flex-wrap justify-center gap-sm">
            <Link
              href="/search"
              className="rounded-md border border-outline-subtle bg-primary px-lg py-sm font-label text-label-md text-on-primary shadow-card-sm hover:bg-secondary hover:text-on-secondary"
            >
              Start Exploring
            </Link>
            <button
              type="button"
              onClick={() => {
                setCategory("All");
                setQuery("");
                loadDemo(DEMO_COLLECTION);
              }}
              className="rounded-md border border-outline-subtle bg-surface px-lg py-sm font-label text-label-md text-on-surface hover:bg-muted-green"
            >
              Load Sample Collection
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
