"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type LearningEntity = { type: "gene" | "protein"; id: string };
type Claim = { text: string; source_ids: string[] };
type Source = {
  id: string;
  provider: "NCBI Gene" | "UniProtKB";
  entity_id: string;
  url: string;
};
type LearningResult = {
  status: "generated" | "insufficient_evidence";
  entity_type: LearningEntity["type"];
  entity_id: string;
  answer: Claim | null;
  key_functions: Claim[];
  terms: (Claim & { term: string })[];
  sources: Source[];
  limitations: string[];
};

const LearningAccess = createContext<{ enabled: boolean; code: string; setCode: (code: string) => void } | null>(null);

function useLearningAccess() {
  const access = useContext(LearningAccess);
  if (!access) throw new Error("Missing LearningAccessProvider.");
  return access;
}

export function LearningAccessProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [code, setCode] = useState("");
  return (
    <LearningAccess.Provider value={{ enabled, code, setCode }}>
      {children}
    </LearningAccess.Provider>
  );
}

export function LearningAccessInput() {
  const { code, setCode } = useLearningAccess();
  return (
    <label className="flex flex-col gap-xs font-label text-label-sm text-on-surface-variant">
      AI reviewer access code
      <input
        type="password"
        autoComplete="off"
        maxLength={128}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        className="min-w-0 rounded-md border border-outline-subtle bg-surface px-sm py-xs font-body text-body-sm focus-visible:outline-2 focus-visible:outline-primary"
      />
    </label>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  access_required: "Enter a valid reviewer access code and try again.",
  bad_request: "Check your question or entity and try again.",
  rate_limited: "Too many AI requests. Wait a moment and try again.",
  quota_exhausted: "The AI usage limit has been reached.",
  timeout: "The request timed out. Try again.",
  unavailable: "AI learning is currently unavailable.",
  not_found: "The source did not return this entity.",
  provider_error: "Could not generate a source-grounded response. Try again.",
};

export function useLearningRequest(entity: LearningEntity, action: "explain" | "ask") {
  const { enabled, code } = useLearningAccess();
  const [result, setResult] = useState<LearningResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  async function run(question?: string) {
    if (!enabled || inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(`/api/backend/api/v1/ai/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-MoLearn-AI-Access": code },
        body: JSON.stringify({ entity_type: entity.type, entity_id: entity.id, question }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const status = typeof data.status === "string" ? data.status : "provider_error";
        if (data.detail === "invalid_model_output" || data.detail === "unverified_model_output") {
          setError(action === "ask"
            ? "MoLearn could not verify this answer. Try rephrasing your question or check the original source."
            : "MoLearn could not verify this explanation. Try again or read the original annotation below.");
        } else {
          setError(Object.hasOwn(ERROR_MESSAGES, status) ? ERROR_MESSAGES[status] : ERROR_MESSAGES.provider_error);
        }
      } else {
        if (data.entity_type !== entity.type || data.entity_id !== entity.id) {
          throw new Error("Mismatched learning response.");
        }
        setResult(data);
      }
    } catch {
      if (!controller.signal.aborted) setError(ERROR_MESSAGES.provider_error);
    } finally {
      inFlight.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return { enabled, hasCode: /^[A-Za-z0-9_-]{32,128}$/.test(code), result, error, loading, run };
}

export function LearningClaim({ claim, sources }: { claim: Claim; sources: Source[] }) {
  return (
    <span className="wrap-anywhere">
      {claim.text}
      {sources.filter((source) => claim.source_ids.includes(source.id)).map((source) => {
        // Only accept the canonical HTTPS record URL produced by the backend.
        const url = source.provider === "NCBI Gene"
          ? `https://www.ncbi.nlm.nih.gov/gene/${encodeURIComponent(source.entity_id)}`
          : `https://www.uniprot.org/uniprotkb/${encodeURIComponent(source.entity_id)}`;
        if (url !== source.url) return null;
        return (
          <a
            key={source.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-xs text-primary underline underline-offset-2"
          >
            {source.provider} {source.entity_id}
          </a>
        );
      })}
    </span>
  );
}

export function LearningNotice({ result }: { result: LearningResult }) {
  return (
    <div className="flex flex-col gap-xs font-body text-body-sm text-on-surface-variant">
      {result.status === "insufficient_evidence" && (
        <p>The available source records do not provide enough evidence for this response.</p>
      )}
      {result.limitations.map((text) => <p key={text}>{text}</p>)}
    </div>
  );
}
