"use client";

/**
 * Interactive search results (client-side type filter + cursor pagination).
 * Initial data is fetched once by the server component (page), then filtered
 * and paginated locally — without refetching on filter changes.
 */

import { useMemo, useState } from "react";
import type { BiologicalEntitySummary, SearchResult } from "@/types/molearn";
import { ResultCard } from "@/components/EntityCard";
import { EmptyState, DemoBanner } from "@/components/states";
import { SearchInput } from "@/components/SearchInput";
import { SourceBadge } from "@/components/SourceBadge";
import { IconInfo } from "@/components/icons";
import { PixelButton, PixelButtonLink } from "@/components/PixelButton";
import { cn } from "@/lib/cn";
import { IS_DEMO_MODE, searchEntities } from "@/lib/api";

const TYPE_FILTERS = ["All", "Protein", "Gene"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

/** Display label → domain type */
function filterToParam(label: TypeFilter): string {
  const map: Record<TypeFilter, string> = {
    All: "All",
    Protein: "protein",
    Gene: "gene",
  };
  return map[label];
}

export function SearchResultsClient({
  result,
  initialQuery,
  initialType,
  pageSize,
}: {
  result: SearchResult;
  /** Query from the URL (defaultValue for the search box). */
  initialQuery: string;
  /** Type label from the URL (e.g. `?type=Gene`), or `All`. */
  initialType: string;
  /** Page size for pagination (from `?page_size=`). */
  pageSize?: number;
}) {
  const [type, setType] = useState<TypeFilter>(
    (TYPE_FILTERS as readonly string[]).includes(initialType)
      ? (initialType as TypeFilter)
      : "All",
  );

  const [entities, setEntities] = useState<BiologicalEntitySummary[]>(
    result.entities,
  );
  const [cursor, setCursor] = useState<string | undefined>(result.next_cursor);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reset pagination when the type filter changes (query & page_size reset
  // via the `key` on this component in `page.tsx`).
  function selectType(next: TypeFilter) {
    setType(next);
    setEntities(result.entities);
    setCursor(result.next_cursor);
    setLoadError(null);
  }

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setLoadError(null);
    try {
      const next = await searchEntities({
        q: initialQuery,
        page_size: pageSize,
        cursor,
      });
      setEntities((prev) => {
        const seen = new Set(prev.map((e) => `${e.type}-${e.id}`));
        return [
          ...prev,
          ...next.entities.filter((e) => !seen.has(`${e.type}-${e.id}`)),
        ];
      });
      setCursor(next.next_cursor);
    } catch (error) {
      // Keep already-loaded results visible.
      setLoadError(
        error instanceof Error ? error.message : "Failed to load more results",
      );
    } finally {
      setLoading(false);
    }
  }

  // Local filter over already-fetched results.
  const filtered = useMemo(() => {
    const t = filterToParam(type);
    return entities.filter((e) => t === "All" || e.type === t);
  }, [entities, type]);

  const hasPair =
    filtered.some((e) => e.type === "gene") &&
    filtered.some((e) => e.type === "protein");

  return (
    <main className="mx-auto w-full max-w-7xl px-md py-xl md:px-xl">
      {/* Persistent search bar */}
      <section className="mb-xl">
        <SearchInput
          defaultValue={initialQuery}
          submitLabel="Search"
          className="sm:max-w-none"
        />

        <div className="mt-lg flex flex-col justify-between gap-md lg:flex-row lg:items-center">
          <div>
            <h1 className="font-headline text-headline-lg-mobile text-on-surface md:text-headline-lg">
              {initialQuery
                ? `Results for “${initialQuery}”`
                : "Entity Directory"}
            </h1>
            <p className="mt-xs font-body text-body-sm tabular-nums text-on-surface-variant">
              Showing {filtered.length} biological {filtered.length === 1 ? "entity" : "entities"}
            </p>
          </div>

          <div className="flex items-center gap-sm">
            <SourceBadge source={result.isDemo ? "Local (demo)" : "UniProt"} />
          </div>
        </div>
      </section>

      {/* Gene vs Protein identification note (when present). */}
      {(result.disambiguation || hasPair) && (
        <aside className="mb-lg flex items-center gap-md rounded-md border border-outline-subtle bg-info-container p-md text-on-info-container">
          <IconInfo className="h-7 w-7 shrink-0" />
          <div>
            <p className="font-label text-label-lg">Gene vs Protein</p>
            <p className="font-body text-body-sm">
              {result.disambiguation ??
                "Similar names can refer to different entities or organisms. TP53 is a gene on DNA, while p53 is the protein it encodes. moLearn never merges the two automatically."}
            </p>
          </div>
        </aside>
      )}

      {/* Demo data marker (only in demo / fixture mode). */}
      {result.isDemo && <DemoBanner visible={true} />}

      {/* Type filter controls */}
      <section className="mb-lg flex flex-col justify-between gap-md border-b border-outline-subtle pb-md sm:flex-row sm:items-center">
        <div className="flex items-center gap-sm">
          <span className="font-label text-label-md text-on-surface-variant">
            Type:
          </span>
          {TYPE_FILTERS.map((filter) => {
            const isDisabled = !IS_DEMO_MODE && filter === "Gene";
            return (
              <button
                key={filter}
                type="button"
                disabled={isDisabled}
                onClick={() => selectType(filter)}
                className={cn(
                  "rounded-md border border-outline-subtle px-md py-xs font-label text-label-md",
                  filter === type
                    ? "bg-primary text-on-primary"
                    : "bg-surface-card text-on-surface-card hover:bg-muted-green",
                  isDisabled && "cursor-not-allowed opacity-50",
                )}
              >
                {filter}
                {isDisabled && " (soon)"}
              </button>
            );
          })}
        </div>
      </section>

      {/* Results grid / empty */}
      {filtered.length > 0 ? (
        <section className="grid grid-cols-1 gap-lg md:grid-cols-2">
          {filtered.map((entity) => (
            <ResultCard key={`${entity.type}-${entity.id}`} entity={entity} />
          ))}
        </section>
      ) : (
        <EmptyState
          action={
            <PixelButtonLink href="/search?q=TP53" size="sm">
              Reset to TP53 Example
            </PixelButtonLink>
          }
        />
      )}

      {/* Cursor pagination: shown only while the backend has more pages.
          Existing results stay visible while loading or on error. */}
      {cursor && (
        <div className="mt-xl flex flex-col items-center gap-sm">
          <PixelButton
            variant="ghost"
            size="md"
            onClick={loadMore}
            disabled={loading}
            aria-live="polite"
            className={cn(loading && "cursor-wait opacity-60")}
          >
            {loading ? "Loading…" : "Load More"}
          </PixelButton>
          {loadError && (
            <p role="alert" className="font-body text-body-sm text-error">
              {loadError} — try again or narrow your search.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
