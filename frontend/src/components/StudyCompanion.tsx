"use client";

import { useState } from "react";
import { ENTITY_TYPE_LABELS } from "@/types/molearn";
import { PixelCard } from "@/components/PixelCard";
import { PixelButton } from "@/components/PixelButton";
import { LearningAccessInput, LearningClaim, LearningNotice, useLearningRequest } from "@/components/LearningAccess";

/**
 * StudyCompanion — antarmuka kontekstual pendamping belajar (Task G).
 *
 * Questions are sent individually with the selected canonical entity.
 */

const SUGGESTED_QUESTIONS = [
  "What does this entity do?",
  "Which organism does this record come from?",
  "How is this gene related to its protein?",
  "Where can I verify this information?",
];

export function StudyCompanion({
  entityName,
  entityId,
  type,
}: {
  entityName: string;
  entityId: string;
  type: "gene" | "protein";
}) {
  const [question, setQuestion] = useState("");
  const { enabled, hasCode, result, error, loading, run } = useLearningRequest({ type, id: entityId }, "ask");
  return (
    <PixelCard className="p-lg">
      <div className="mb-sm flex flex-wrap items-center justify-between gap-sm">
        <h3 className="font-headline text-headline-md text-on-surface-card">
          Study Companion
        </h3>
        <span className="rounded-md border border-outline-subtle bg-surface px-sm py-xs font-label text-label-sm text-on-surface-variant">
          {enabled ? "Reviewer access" : "Unavailable"}
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
                  disabled={!enabled}
                  onClick={() => setQuestion(q)}
                  className="min-h-10 w-full rounded-md border border-outline-subtle bg-surface px-md py-xs text-left font-body text-body-sm text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed"
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <form className="mt-md flex flex-col gap-sm" onSubmit={(event) => {
        event.preventDefault();
        if (question.trim() && hasCode && !loading) void run(question.trim());
      }}>
        <label
          htmlFor="study-companion-input"
          className="font-label text-label-sm text-on-surface-variant"
        >
          Ask a question
        </label>
        <textarea
          id="study-companion-input"
          disabled={!enabled}
          rows={2}
          maxLength={600}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question about this entity…"
          className="w-full resize-none rounded-md border border-outline-subtle bg-surface px-md py-sm font-body text-body-md text-on-surface-variant placeholder:text-on-surface-variant/60 focus-visible:outline-2 focus-visible:outline-primary"
        />
        {enabled && (
          <>
            <LearningAccessInput />
            <div>
              <PixelButton type="submit" disabled={!hasCode || !question.trim() || loading} className="disabled:opacity-60">
                Ask Study Companion
              </PixelButton>
            </div>
          </>
        )}
      </form>

      <div className="mt-md">
        <p className="mb-xs font-label text-label-sm text-on-surface-variant">
          Response
        </p>
        <div
          role="status"
          className="rounded-md border border-outline-subtle bg-surface px-md py-sm font-body text-body-sm text-on-surface-variant"
        >
          {loading && <p>Checking the available evidence…</p>}
          {error && <p>{error}</p>}
          {result?.answer && (
            <>
              <p className="mb-xs font-label text-label-sm">AI-selected source evidence</p>
              <p className="mb-xs"><LearningClaim claim={result.answer} sources={result.sources} /></p>
            </>
          )}
          {result && <LearningNotice result={result} />}
          {!result && !error && !loading && (
            <p>{enabled ? "Ask about this record to see an answer with source links." : "AI answers are unavailable."}</p>
          )}
        </div>
      </div>

    </PixelCard>
  );
}
