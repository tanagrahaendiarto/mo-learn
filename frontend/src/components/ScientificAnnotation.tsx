import { PixelCard } from "@/components/PixelCard";
import { parseAnnotation, pubmedUrl } from "@/lib/citations";

/**
 * ScientificAnnotation — anotasi ilmiah mentah dari sumber (UniProt).
 *
 * Anotasi panjang dilipat di balik `<details>` agar profil tetap ramah
 * pemula. Isi teks dipertahankan; penanda sitasi `(PubMed:...)` hanya
 * dipindahkan ke daftar referensi yang dapat diklik — tidak ada kalimat
 * yang ditambah, diringkas, atau diubah maknanya.
 *
 * Tanpa JavaScript: `<details>`/`<summary>` native, aksesibel keyboard.
 */
export function ScientificAnnotation({
  annotations,
  source,
}: {
  annotations: string[];
  source: string;
}) {
  if (annotations.length === 0) return null;

  const parsed = annotations.map(parseAnnotation);
  const references = [...new Set(parsed.flatMap((p) => p.pubmedIds))];

  return (
    <PixelCard className="p-lg">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-sm font-label text-label-md text-on-surface-card">
          <span>Original scientific annotation</span>
          <span className="font-body text-body-sm text-on-surface-variant">
            {annotations.length} source{" "}
            {annotations.length === 1 ? "note" : "notes"}
            {references.length > 0
              ? ` · ${references.length} references`
              : ""}
          </span>
        </summary>

        <p className="mt-sm font-body text-body-sm text-on-surface-variant">
          Unedited text from {source}. Citation markers are listed as
          references below; the wording is unchanged.
        </p>

        <div className="mt-md flex flex-col gap-md">
          {parsed.map((item, index) => (
            <p
              key={index}
              className="border-b border-outline-subtle pb-md font-body text-body-sm text-on-surface last:border-b-0 last:pb-0"
            >
              {item.text}
            </p>
          ))}
        </div>

        {references.length > 0 && (
          <div className="mt-md">
            <h3 className="mb-xs font-label text-label-sm text-on-surface-variant">
              References (PubMed)
            </h3>
            <ul className="flex flex-wrap gap-x-md gap-y-xs">
              {references.map((id) => (
                <li key={id}>
                  <a
                    href={pubmedUrl(id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-mono-sm text-primary hover:underline"
                  >
                    PubMed {id} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </details>
    </PixelCard>
  );
}
