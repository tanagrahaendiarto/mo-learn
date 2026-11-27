import type { Metadata } from "next";
import { searchEntities, type EntityTypeFilter } from "@/lib/api";
import { SearchResultsClient } from "./results-client";

export const metadata: Metadata = {
  title: "Search Results",
};

/** `?type=Gene|Protein|All` (legacy) and `?entity_type=gene|protein|all`. */
function parseTypeFilter(raw: string | undefined): EntityTypeFilter {
  const value = raw?.trim().toLowerCase();
  if (value === "gene") return "gene";
  if (value === "protein") return "protein";
  return "all";
}

function filterLabel(type: EntityTypeFilter): "All" | "Gene" | "Protein" {
  if (type === "gene") return "Gene";
  if (type === "protein") return "Protein";
  return "All";
}

/**
 * Halaman hasil pencarian moLearn — transkrip blueprint Stitch
 * (`2._hasil_pencarian_molearn/code.html`) ke App Router.
 *
 * Arsitektur:
 *  - Server component mengambil hasil pertama lewat `searchEntities`
 *    (fixture lokal saat `NEXT_PUBLIC_DEMO_MODE=true`).
 *  - Filter tipe dijalankan di SERVER (parameter `entity_type`), bukan
 *    filter lokal, agar halaman berisi campuran gen+protein yang benar.
 *  - Cursor dibuang saat q/type/page_size berubah; komponen di-remount
 *    lewat `key` sehingga pagination tidak membawa state lama.
 */
export default async function SearchPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await props.searchParams;
  const q = params.q ?? "";
  const entityType = parseTypeFilter(params.entity_type ?? params.type);

  const parsedPageSize = params.page_size
    ? parseInt(params.page_size, 10)
    : undefined;
  const pageSize =
    parsedPageSize && parsedPageSize > 0
      ? Math.min(parsedPageSize, 100)
      : undefined;

  const result = await searchEntities({
    q,
    entity_type: entityType,
    page_size: pageSize,
    cursor: params.cursor,
  });

  return (
    <SearchResultsClient
      key={`${q}:${entityType}:${pageSize ?? ""}`}
      result={result}
      initialQuery={q}
      initialType={filterLabel(entityType)}
      pageSize={pageSize}
    />
  );
}
