"use client";

import { useState } from "react";
import { PixelButton } from "@/components/PixelButton";
import { downloadText } from "@/lib/csv";
import type { ExplorationIdentity, SequenceRecord } from "@/lib/exploration";

const KINDS: Record<SequenceRecord["kind"], string> = {
  genomic_dna: "Genomic DNA",
  transcript: "Transcript (nucleotide record)",
  cds: "Coding sequence (CDS)",
  protein: "Protein",
};

const ROWS = 12;
const ROW_LENGTH = 24;

function SequenceRecordViewer({ record, identity }: {
  record: SequenceRecord;
  identity: ExplorationIdentity;
}) {
  const [page, setPage] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const pageSize = ROWS * ROW_LENGTH;
  const start = page * pageSize;
  const lines = record.sequence.slice(start, start + pageSize).match(/.{1,24}/g) ?? [];
  const pages = Math.ceil(record.length / pageSize);

  async function copy() {
    try {
      await navigator.clipboard.writeText(record.sequence);
      setCopyStatus("Sequence copied.");
    } catch {
      setCopyStatus("Clipboard unavailable. Download FASTA to save the sequence.");
    }
  }

  function download() {
    const header = `>${record.source_id} type=${record.kind} source=${record.source.replaceAll(" ", "_")} entity=${identity.accession} taxid=${identity.taxonomy_id ?? "unknown"} retrieved_at=${record.retrieved_at} source_url=${record.source_url}`;
    downloadText(`${record.accession}-${record.kind}.fasta`, `${header}\n${record.sequence.match(/.{1,60}/g)?.join("\n")}\n`, "text/plain;charset=utf-8");
  }

  return (
    <div className="flex min-w-0 flex-col gap-sm">
      <p className="text-body-sm">{record.label} · {record.length.toLocaleString("en-US")} {record.kind === "protein" ? "amino acids" : "nucleotides"}</p>
      <p className="break-words text-body-sm">
        <a className="text-primary underline" href={record.source_url}>{record.source}: {record.source_id}</a>
      </p>
      <pre aria-label="Numbered sequence" tabIndex={0} className="overflow-x-auto rounded-md border border-outline-subtle bg-surface p-sm font-mono text-xs leading-relaxed">
        {lines.map((line, index) => `${String(start + index * ROW_LENGTH + 1).padStart(6)}  ${line}`).join("\n")}
      </pre>
      {pages > 1 && (
        <div className="flex flex-wrap items-center gap-sm">
          <PixelButton size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</PixelButton>
          <span aria-live="polite" className="text-body-sm">{start + 1}–{Math.min(start + pageSize, record.length)}</span>
          <PixelButton size="sm" variant="ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</PixelButton>
        </div>
      )}
      <div className="flex flex-wrap gap-sm">
        <PixelButton size="sm" variant="ghost" onClick={copy}>Copy sequence</PixelButton>
        <PixelButton size="sm" onClick={download}>Download FASTA</PixelButton>
      </div>
      <p role="status" className="text-body-sm">{copyStatus}</p>
    </div>
  );
}

export function SequenceViewer({ records, identity }: { records: SequenceRecord[]; identity: ExplorationIdentity }) {
  const [selected, setSelected] = useState(0);
  const record = records[selected];
  return (
    <div className="flex min-w-0 flex-col gap-sm">
      {records.length > 1 && (
        <label className="flex flex-col gap-xs text-body-sm">
          Sequence type
          <select className="w-fit max-w-full rounded-md border border-outline-subtle bg-surface p-sm" value={selected}
            onChange={(event) => setSelected(Number(event.target.value))}>
            {records.map((item, index) => <option key={item.kind} value={index}>{KINDS[item.kind]}</option>)}
          </select>
        </label>
      )}
      {records.length === 1 && <h4 className="font-label text-label-md">{KINDS[record.kind]}</h4>}
      <p className="break-words text-body-sm text-on-surface-variant">
        {identity.name ? `${identity.name} · ` : ""}{identity.accession}
        {identity.organism ? ` · ${identity.organism}` : ""}
        {identity.taxonomy_id ? ` · Taxonomy ${identity.taxonomy_id}` : ""}
      </p>
      <SequenceRecordViewer key={record.kind} record={record} identity={identity} />
    </div>
  );
}
