/**
 * CSV serialization for spreadsheet downloads.
 * Escape quotes, separators and line breaks with RFC 4180 rules.
 */

/** Escape satu sel CSV (selalu di-quote bila mengandung karakter khusus). */
function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (typeof value === "string" && (/^[\s\p{Cf}]*[=+\-@＝＋－＠]/u.test(s) || /^[ \t]*[\t\r\n]/.test(s))) {
    s = `'${s}`;
  }
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
  downloadText(filename, csv, "text/csv;charset=utf-8;");
}

export function downloadText(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
