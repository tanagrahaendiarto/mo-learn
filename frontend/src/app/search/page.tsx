import type { Metadata } from "next";
import { searchEntities } from "@/lib/api";
import { SearchResultsClient } from "./results-client";

export const metadata: Metadata = {
  title: "Search Results",
};

/**
 * Halaman hasil pencarian moLearn — transkripsi blueprint Stitch
 * (`2._hasil_pencarian_molearn/code.html`) ke App Router.
 *
 * Arsitektur fase 1 (disederhanakan, tanpa TanStack Query):
 *  - Server component mengambil hasil `?q=&page_size=&cursor=` lewat
 *    `searchEntities` (fixture lokal saat `NEXT_PUBLIC_DEMO_MODE=true`,
 *    ditandai `isDemo: true`).
 *  - Filter tipe/organisme sisa dijalankan di client di atas hasil
 *    yang sudah diambil (tanpa ulang request).
 *  - Tombol "state demo" pada blueprint (Normal/Loading/Data Parsial/
 *    Kosong) TIDAK ditranskripsikan: di aplikasi nyata state
 *    loading/empty/error muncul dari kondisi data apa adanya.
 *
 * Bug blueprint yang diperbaiki: setiap kartu hasil kini merute ke
 * profil entitasnya sendiri, bukan semuanya ke `?entity=p53`.
 */
export default async function SearchPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await props.searchParams;
  const q = params.q ?? "";

  const pageSize = params.page_size ? parseInt(params.page_size, 10) : undefined;

  const result = await searchEntities({
    q,
    page_size: pageSize && pageSize > 0 ? pageSize : undefined,
    cursor: params.cursor,
  });

  return (
    <SearchResultsClient
      key={`${q}:${pageSize ?? ""}`}
      result={result}
      initialQuery={q}
      initialType="All"
      pageSize={pageSize}
    />
  );
}
