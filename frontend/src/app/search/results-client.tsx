"use client";

/**
 * Interactive search results — server-side type filter + cursor pagination.
 *
 * Filtering happens in the backend (`entity_type`), so a page can contain
 * genes and proteins together. Every filter change discards the cursor and
 * starts a fresh request; stale responses are ignored and in-flight requests
 * are aborted. Duplicate records are dropped by `type + source + id`.
 */

import { useMemo, useRef, useState } from "react";
import type {
  BiologicalEntitySummary,
  ProviderStatus,
  SearchResult,
} from "@/types/molearn";
import type { EntityTypeFilter } from "@/lib/api";
import { ResultCard } from "@/components/EntityCard";
import { EmptyState, DemoBanner, ErrorState, LoadingState } from "@/components/states";
import { SearchInput } from "@/components/SearchInput";
import { SourceBadge } from "@/components/SourceBadge";
import { IconInfo } from "@/components/icons";
import { PixelButton, PixelButtonLink } from "@/components/PixelButton";
import { cn } from "@/lib/cn";
import { ApiError, IS_DEMO_MODE, searchEntities } from "@/lib/api";

const TYPE_FILTERS = ["All", "Protein", "Gene"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

function filterToParam(label: TypeFilter): EntityTypeFilter {
  const map: Record<TypeFilter, EntityTypeFilter> = {
    All: "all",
    Protein: "protein",
    Gene: "gene",
  };
  return map[label];
}

const GENE_ID_RE = /^[1-9][0-9]{0,11}$/;
const ACCESSION_RE =
  /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})$/i;

function providerLabel(name: string): string {
  if (name === "uniprot") return "UniProt";
  if (name === "ncbi_gene") return "NCBI Gene";
  return name;
}

function recordKey(entity: BiologicalEntitySummary): string {
  return `${entity.type}\u0000${entity.source}\u0000${entity.id}`;
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
  const [providers, setProviders] = useState<ProviderStatus[]>(
    result.providers ?? [],
  );
  const [providerStatus, setProviderStatus] = useState<string | undefined>(
    result.provider_status,
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<ApiError | null>(null);

  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  function beginRequest(): { id: number; controller: AbortController } {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    return { id: ++requestRef.current, controller };
  }

  function applyResult(next: SearchResult) {
    setEntities(next.entities);
    setCursor(next.next_cursor);
    setProviders(next.providers ?? []);
    setProviderStatus(next.provider_status);
  }

  // Filter change = new query against the backend. Cursor is discarded.
  async function selectType(nextLabel: TypeFilter) {
    if (nextLabel === type && !filterError) return;
    setType(nextLabel);
    setFilterError(null);
    setLoadError(null);
    setEntities([]);
    setCursor(undefined);
    setProviders([]);
    setProviderStatus(undefined);
    setLoading(true);

    const { id, controller } = beginRequest();
    try {
      const next = await searchEntities({
        q: initialQuery,
        entity_type: filterToParam(nextLabel),
        page_size: pageSize,
        signal: controller.signal,
      });
      if (id !== requestRef.current) return;
      applyResult(next);
    } catch (error) {
      if (id !== requestRef.current) return;
      if (error instanceof Error && error.name === "AbortError") return;
      setFilterError(
        error instanceof ApiError
          ? error
          : new ApiError(502, "Failed to load results"),
      );
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setLoadError(null);

    const { id, controller } = beginRequest();
    try {
      const next = await searchEntities({
        q: initialQuery,
        entity_type: filterToParam(type),
        page_size: pageSize,
        cursor,
        signal: controller.signal,
      });
      if (id !== requestRef.current) return;
      setEntities((prev) => {
        const seen = new Set(prev.map(recordKey));
        return [
          ...prev,
          ...next.entities.filter((e) => !seen.has(recordKey(e))),
        ];
      });
      setCursor(next.next_cursor);
      setProviders(next.providers ?? []);
      setProviderStatus(next.provider_status);
    } catch (error) {
      if (id !== requestRef.current) return;
      if (error instanceof Error && error.name === "AbortError") return;
      // Keep already-loaded results visible.
      setLoadError(
        error instanceof Error ? error.message : "Failed to load more results",
      );
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }

  const failedProviders = useMemo(
    () => providers.filter((p) => p.status === "error"),
    [providers],
  );
  const showPartialProviderWarning =
    providerStatus === "partial" || failedProviders.length > 0;

  const hasPair =
    entities.some((e) => e.type === "gene") &&
    entities.some((e) => e.type === "protein");

  const trimmedQuery = initialQuery.trim();
  const isGeneIdQuery = GENE_ID_RE.test(trimmedQuery);
  const isAccessionQuery = ACCESSION_RE.test(trimmedQuery);

  const emptyCopy = (() => {
    if (isGeneIdQuery && filterToParam(type) === "protein") {
      return {
        title: "GeneID Excluded by Filter",
        description: `${trimmedQuery} is an NCBI GeneID. The Protein filter excludes gene records. Switch to Gene or All.`,
      };
    }
    if (isAccessionQuery && filterToParam(type) === "gene") {
      return {
        title: "Protein Accession Excluded by Filter",
        description: `${trimmedQuery} is a UniProt accession. The Gene filter excludes protein records. Switch to Protein or All.`,
      };
    }
    if (isGeneIdQuery || isAccessionQuery) {
      return {
        title: "Identifier Not Found",
        description: `No record matched the exact identifier ${trimmedQuery}. Check the identifier or clear the type filter.`,
      };
    }
    if (providerStatus === "partial") {
      return {
        title: "No Results From Available Providers",
        description:
          "One provider failed and the other returned no matches. This is not the same as confirming that no record exists.",
      };
    }
    return {
      title: "No Entities Found",
      description:
        "We couldn't find a gene or protein matching that keyword. Check the symbol spelling or try an exact GeneID or UniProt accession.",
    };
  })();

  return (
    <div className="mx-auto w-full max-w-7xl px-md py-xl md:px-xl">
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
              Showing {entities.length} biological{" "}
              {entities.length === 1 ? "entity" : "entities"}
              {showPartialProviderWarning ? " from available providers" : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-sm">
            {result.isDemo ? (
              <SourceBadge source="Local (demo)" />
            ) : (
              <>
                <SourceBadge source="UniProt" />
                <SourceBadge source="NCBI Gene" />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Gene vs Protein identification note (when both are present). */}
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

      {/* Partial provider failure: healthy results stay visible. */}
      {showPartialProviderWarning && (
        <aside
          role="status"
          className="mb-lg flex items-start gap-md rounded-md border border-outline-subtle bg-warning-container p-md text-on-warning-container"
        >
          <IconInfo className="h-7 w-7 shrink-0" />
          <div>
            <p className="font-label text-label-lg">
              Some providers did not respond
            </p>
            <p className="font-body text-body-sm">
              {failedProviders.length > 0
                ? `${failedProviders
                    .map(
                      (p) =>
                        `${providerLabel(p.name)}${
                          p.detail ? ` (${p.detail})` : ""
                        }`,
                    )
                    .join(", ")} failed. Results from the other provider are still valid and shown below.`
                : "One provider failed. Results from the healthy provider are still valid and shown below."}
            </p>
          </div>
        </aside>
      )}

      {/* Demo data marker (only in demo / fixture mode). */}
      {result.isDemo && <DemoBanner visible={true} />}

      {/* Type filter controls (server-side) */}
      <section className="mb-lg border-b border-outline-subtle pb-md">
        <div
          className="flex flex-wrap items-center gap-sm"
          role="group"
          aria-label="Filter by entity type"
        >
          <span className="font-label text-label-md text-on-surface-variant">
            Type:
          </span>
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={filter === type}
              onClick={() => selectType(filter)}
              disabled={loading}
              className={cn(
                "rounded-md border border-outline-subtle px-md py-xs font-label text-label-md",
                filter === type
                  ? "bg-primary text-on-primary"
                  : "bg-surface-card text-on-surface-card hover:bg-muted-green",
                loading && "cursor-wait opacity-60",
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        {!IS_DEMO_MODE && filterToParam(type) !== "protein" && (
          <p className="mt-sm font-body text-body-sm text-on-surface-variant">
            Gene name search currently covers human genes only (NCBI taxid
            9606). Exact GeneID lookup is not restricted.
          </p>
        )}
      </section>

      {/* Results grid / loading / error / empty */}
      {loading && entities.length === 0 ? (
        <LoadingState />
      ) : filterError ? (
        <ErrorState
          title={
            filterError.status === 429
              ? "A Provider Is Rate-Limiting Requests"
              : filterError.status === 504
                ? "A Provider Timed Out"
                : "Unable to Load Results"
          }
          description={filterError.detail}
          action={
            <PixelButton
              variant="primary"
              size="md"
              onClick={() => selectType(type)}
            >
              Try Again
            </PixelButton>
          }
        />
      ) : entities.length > 0 ? (
        <section className="grid grid-cols-1 gap-lg md:grid-cols-2">
          {entities.map((entity) => (
            <ResultCard key={recordKey(entity)} entity={entity} />
          ))}
        </section>
      ) : (
        <EmptyState
          title={emptyCopy.title}
          description={emptyCopy.description}
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
    </div>
  );
}
