import { PixelCard } from "@/components/PixelCard";
import { HelpTooltip } from "@/components/HelpTooltip";

/**
 * ExplanationPanel — tata letak bersama untuk penjelasan pemula dan
 * fungsi biologis kunci (dipakai profil protein & gen).
 *
 * Kontrak data: `summary` dan `keyFunctions` HANYA diisi dari penjelasan
 * yang sudah tervalidasi (atau integrasi LLM resmi nanti). Bila kosong,
 * komponen menampilkan status jujur "belum tersedia" — tidak pernah
 * menghasilkan ringkasan sendiri.
 */
export function ExplanationPanel({
  summary,
  keyFunctions,
  title = "In simple terms",
}: {
  /** Ringkasan bahasa sederhana yang sudah tervalidasi. */
  summary?: string | null;
  /** Fungsi biologis kunci yang sudah tervalidasi. */
  keyFunctions?: readonly string[];
  title?: string;
}) {
  const functions = keyFunctions ?? [];

  return (
    <PixelCard className="p-lg">
      <div className="flex flex-col gap-lg">
        <section>
          <div className="flex items-center gap-sm">
            <h2 className="font-label text-label-sm text-on-surface-variant">
              {title}
            </h2>
            <HelpTooltip
              label="About beginner-friendly explanations"
              text="This is a validated plain-language summary. When no such summary exists, the source annotation is shown instead — never invented text."
            />
          </div>
          {summary ? (
            <p className="mt-xs font-body text-body-lg text-on-surface">
              {summary}
            </p>
          ) : (
            <p className="mt-xs font-body text-body-md text-on-surface-variant">
              No validated beginner-friendly explanation is available for this
              entity yet. The original scientific annotation is shown below
              when available.
            </p>
          )}
        </section>

        <section className="border-t border-outline-subtle pt-lg">
          <h2 className="font-label text-label-sm text-on-surface-variant">
            Key biological functions
          </h2>
          {functions.length > 0 ? (
            <ul className="mt-xs flex flex-col gap-xs">
              {functions.map((item) => (
                <li
                  key={item}
                  className="font-body text-body-sm text-on-surface"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-xs font-body text-body-sm text-on-surface-variant">
              Not available yet. Key functions will appear here once validated
              explanations are available.
            </p>
          )}
        </section>
      </div>
    </PixelCard>
  );
}
