/**
 * Ekstraksi sitasi PubMed dari anotasi panjang UniProt.
 *
 * Teks asli tidak diubah maknanya: penanda sitasi `(PubMed:123, ...)`
 * dipindahkan dari paragraf ke daftar referensi yang dapat diklik.
 * Semua ID tetap dipertahankan (unik, urutan kemunculan).
 */

const CITATION_GROUP = /\(\s*PubMed:\s*\d+(?:\s*,\s*PubMed:\s*\d+)*\s*\)/gi;
const BARE_CITATION = /PubMed:\s*(\d+)/gi;

export interface ParsedAnnotation {
  /** Teks anotasi tanpa penanda sitasi inline. */
  text: string;
  /** ID PubMed unik, urutan kemunculan. */
  pubmedIds: string[];
}

export function pubmedUrl(id: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(id)}/`;
}

function collectIds(fragment: string, out: string[]): void {
  for (const match of fragment.matchAll(/PubMed:\s*(\d+)/gi)) {
    out.push(match[1]);
  }
}

export function parseAnnotation(raw: string): ParsedAnnotation {
  const ids: string[] = [];

  // 1. Buang grup sitasi lengkap dalam tanda kurung.
  let text = raw.replace(CITATION_GROUP, (group) => {
    collectIds(group, ids);
    return "";
  });

  // 2. Buang penanda sitasi yang tersisa tanpa tanda kurung.
  text = text.replace(BARE_CITATION, (_match, id: string) => {
    ids.push(id);
    return "";
  });

  // 3. Rapikan spasi/tanda baca yang tertinggal.
  text = text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();

  return { text, pubmedIds: [...new Set(ids)] };
}
