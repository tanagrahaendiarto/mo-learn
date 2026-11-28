"use client";

import { PixelCard } from "@/components/PixelCard";
import { HelpTooltip } from "@/components/HelpTooltip";
import { PixelButton } from "@/components/PixelButton";
import { LearningAccessInput, LearningClaim, LearningNotice, useLearningRequest } from "@/components/LearningAccess";

/**
 * ExplanationPanel — tata letak bersama untuk penjelasan pemula dan
 * fungsi biologis kunci (dipakai profil protein & gen).
 *
 * Existing validated summaries stay separate from on-demand AI output.
 */
export function ExplanationPanel({
  summary,
  keyFunctions,
  type,
  entityId,
  title = "In simple terms",
}: {
  /** Ringkasan bahasa sederhana yang sudah tervalidasi. */
  summary?: string | null;
  /** Fungsi biologis kunci yang sudah tervalidasi. */
  keyFunctions?: readonly string[];
  type: "gene" | "protein";
  entityId: string;
  title?: string;
}) {
  const functions = keyFunctions ?? [];
  const { enabled, hasCode, loading, error, result, run } = useLearningRequest({ type, id: entityId }, "explain");

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
              text="Read a validated summary where available, or request an AI-generated explanation. The original annotation is shown separately."
            />
          </div>
          {result?.answer && <p className="mt-xs font-label text-label-sm text-on-surface-variant">AI-generated</p>}
          {result?.answer ? (
            <p className="mt-xs font-body text-body-lg text-on-surface">
              <LearningClaim claim={result.answer} sources={result.sources} />
            </p>
          ) : summary ? (
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
          {result?.key_functions.length ? (
            <ul className="mt-xs flex flex-col gap-xs font-body text-body-sm text-on-surface">
              {result.key_functions.map((claim, index) => (
                <li key={index}><LearningClaim claim={claim} sources={result.sources} /></li>
              ))}
            </ul>
          ) : functions.length > 0 ? (
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

        {!!result?.terms.length && (
          <section className="border-t border-outline-subtle pt-lg">
            <h2 className="font-label text-label-sm text-on-surface-variant">Key terms</h2>
            <dl className="mt-xs flex flex-col gap-xs font-body text-body-sm text-on-surface">
              {result.terms.map((term, index) => (
                <div key={index}>
                  <dt className="font-semibold wrap-anywhere">{term.term}</dt>
                  <dd><LearningClaim claim={term} sources={result.sources} /></dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {enabled ? (
          <div className="flex flex-col gap-sm">
            <LearningAccessInput />
            <div>
              <PixelButton
                disabled={!hasCode || loading}
                className="disabled:opacity-60"
                onClick={() => void run()}
              >
                {result ? "Generate again" : "Generate explanation"}
              </PixelButton>
            </div>
            <div role="status" className="font-body text-body-sm text-on-surface-variant">
              {loading && <p>Generating an explanation…</p>}
              {error && <p>{error}</p>}
              {result && (
                <>
                  <p className="sr-only">AI explanation request finished.</p>
                  <LearningNotice result={result} />
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="font-body text-body-sm text-on-surface-variant">AI explanations are unavailable.</p>
        )}
      </div>
    </PixelCard>
  );
}
