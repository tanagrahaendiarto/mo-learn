/**
 * Helper ekspor CSV minimal — tanpa dependensi tambahan.
 * Escape RFC-4180: kutip ganda, koma, baris baru, CRLF antar baris.
 */

/** Escape satu sel CSV (selalu di-quote bila mengandung karakter khusus). */
function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface CsvColumn {
  key: string;
  label: string;
}

/**
 * Ubah deretan record tabular menjadi string CSV.
 * Header memakai `label` kolom; baris memakai `key` kolom.
 */
export function toCsv(
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
): string {
  const header = columns.map((c) => csvCell(c.label)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => csvCell(row[c.key])).join(","),
  );
  return [header, ...body].join("\r\n");
}

/** Unduh string sebagai file (trigger download di browser). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
