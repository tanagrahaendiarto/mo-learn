"use client";

import { useState } from "react";
import Image from "next/image";
import { SourceBadge } from "@/components/SourceBadge";
import type { StructureRecord } from "@/lib/exploration";

function StructurePreview({ url, predicted }: { url: string; predicted: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <p className="text-body-sm">The source preview could not be loaded.</p>;
  const caption = predicted ? "Predicted aligned error (PAE) preview. Lower error means more confidence in relative positions."
    : "Biological assembly preview. The image may include other chains and molecules.";
  return (
    <figure className="flex min-w-0 flex-col gap-xs">
      <Image className="h-auto w-full max-w-64 rounded-md border border-outline-subtle bg-white object-contain"
        src={url} alt={predicted ? "AlphaFold predicted aligned error heatmap" : "RCSB PDB biological assembly rendering"}
        width={256} height={256} unoptimized onError={() => setFailed(true)} />
      <figcaption className="text-body-sm text-on-surface-variant">{caption}</figcaption>
    </figure>
  );
}

export function StructureResults({ records }: { records: StructureRecord[] }) {
  const [index, setIndex] = useState(0);
  const record = records[index];
  const predicted = record.kind === "predicted";
  return (
    <div className="flex min-w-0 flex-col gap-sm text-body-sm">
      {records.length > 1 && (
        <label className="flex flex-col gap-xs">
          Select a structure
          <select className="w-fit max-w-full rounded-md border border-outline-subtle bg-surface p-sm"
            value={index} onChange={(event) => setIndex(Number(event.target.value))}>
            {(["experimental", "predicted"] as const).map((kind) => records.some((item) => item.kind === kind) && (
              <optgroup key={kind} label={kind === "experimental" ? "Experimental (PDB)" : "Predicted (AlphaFold)"}>
                {records.map((item, i) => item.kind === kind && <option key={item.source_id} value={i}>{item.source_id}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-sm">
        <SourceBadge source={predicted ? "AlphaFold DB" : "PDB"} />
        <span>{predicted ? "Predicted structure" : "Experimental structure"}</span>
      </div>
      <h4 className="font-semibold">{record.source_id}{record.title && ` · ${record.title}`}</h4>
      <p>Mapped UniProtKB protein: {record.protein_accession}</p>
      {record.methods.length > 0 && <p>Method: {record.methods.join(", ")}</p>}
      {!predicted && <p>Resolution: {record.resolution_angstrom.length ? `${record.resolution_angstrom.join(", ")} Å` : "Not reported"}</p>}
      {predicted && <p>Mean pLDDT: {record.mean_plddt === null ? "Not reported" : `${record.mean_plddt} / 100`}. Higher values indicate greater local confidence.</p>}
      {record.coverage.length > 0 && (
        <p className="[overflow-wrap:anywhere]">
          UniProt mapping: {record.coverage.map(({ chain, start, end }) => `${chain}${start !== null ? ` (${start}–${end})` : ""}`).join(", ")}.
          {" "}Mapped ranges may include unresolved residues.
        </p>
      )}
      {record.preview_url && <StructurePreview key={record.preview_url} url={record.preview_url} predicted={predicted} />}
      <div className="flex flex-wrap gap-sm">
        <a className="text-primary underline" href={record.source_url}>Open 3D view on {record.source}</a>
        {record.downloads.map(({ format, url }) => <a key={format} className="text-primary underline" href={url}>Download {format}</a>)}
      </div>
    </div>
  );
}
