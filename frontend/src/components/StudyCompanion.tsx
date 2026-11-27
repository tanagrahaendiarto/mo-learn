import type { EntityType } from "@/types/molearn";
import { ENTITY_TYPE_LABELS } from "@/types/molearn";
import { PixelCard } from "@/components/PixelCard";

/**
 * StudyCompanion — antarmuka kontekstual pendamping belajar (Task G).
 *
 * INTERFACE ONLY: belum ada LLM / endpoint server-side, jadi seluruh
 * area interaksi dinonaktifkan dan fitur ditandai "Unavailable" secara
 * jujur. TIDAK ada kunci API di kode, TIDAK ada jawaban tiruan.
 *
 * Struktur siap untuk integrasi Slice 2: konteks entitas, pertanyaan
 * saran, area input + respons, dan tempat presentasi sitasi.
 */

const SUGGESTED_QUESTIONS = [
  "What does this entity do?",
  "Which organism does this record come from?",
  "How is this gene related to its protein?",
  "Where can I verify this information?",
];

export function StudyCompanion({
  entityName,
  type,
}: {
  entityName: string;
  type: EntityType;
}) {
  return (
    <PixelCard className="p-lg">
      <div className="mb-sm flex flex-wrap items-center justify-between gap-sm">
        <h3 className="font-headline text-headline-md text-on-surface-card">
          Study Companion
        </h3>
        <span className="rounded-md border border-outline-subtle bg-surface px-sm py-xs font-label text-label-sm text-on-surface-variant">
          Unavailable
        </span>
      </div>

      <p className="font-body text-body-sm text-on-surface-variant">
        Context: {entityName} ({ENTITY_TYPE_LABELS[type]})
      </p>

      <div className="mt-md">
        <p className="mb-xs font-label text-label-sm text-on-surface-variant">
          Suggested questions
        </p>
        <ul className="flex flex-col gap-xs" aria-label="Suggested questions">
          {SUGGESTED_QUESTIONS.map((q) => (
            <li key={q}>
              <button
                type="button"
                disabled
                className="w-full cursor-not-allowed rounded-md border border-outline-subtle bg-surface px-md py-xs text-left font-body text-body-sm text-on-surface-variant"
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-md flex flex-col gap-sm">
        <label
          htmlFor="study-companion-input"
          className="font-label text-label-sm text-on-surface-variant"
        >
          Ask a question
        </label>
        <textarea
          id="study-companion-input"
          disabled
          rows={2}
          placeholder="Ask a question about this entity…"
          className="w-full resize-none rounded-md border border-outline-subtle bg-surface px-md py-sm font-body text-body-md text-on-surface-variant placeholder:text-on-surface-variant/60 focus:outline-none"
        />
      </div>

      <div className="mt-md">
        <p className="mb-xs font-label text-label-sm text-on-surface-variant">
          Response
        </p>
        <div
          aria-live="polite"
          className="rounded-md border border-outline-subtle bg-surface px-md py-sm font-body text-body-sm text-on-surface-variant"
        >
          Answers will appear here once the Study Companion is connected to a
          reviewed backend.
        </div>
      </div>

      <div className="mt-md">
        <p className="mb-xs font-label text-label-sm text-on-surface-variant">
          Sources
        </p>
        <div className="rounded-md border border-outline-subtle bg-surface px-md py-sm font-body text-body-sm text-on-surface-variant">
          Citations will appear here with their sources.
        </div>
      </div>

      <p className="mt-md font-body text-body-sm text-on-surface-variant">
        This feature is unavailable until the server-side AI integration is
        approved and connected.
      </p>
    </PixelCard>
  );
}
