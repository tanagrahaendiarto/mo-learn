"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type {
  EntityType,
  ExplorationModuleData,
  ExplorationModuleState,
} from "@/types/molearn";
import { PixelCard } from "@/components/PixelCard";
import { PixelButton } from "@/components/PixelButton";
import { downloadCsv, toCsv, type CsvColumn } from "@/lib/csv";
import { cn } from "@/lib/cn";
import { fetchExploration, type ExplorationRecords, type ExplorationResult, type LiveModule } from "@/lib/exploration";
import { SequenceViewer } from "@/components/SequenceViewer";
import { LiteratureResults } from "@/components/LiteratureResults";
import { StructureResults } from "@/components/StructureResults";
import { LigandResults } from "@/components/LigandResults";
import { InteractionResults } from "@/components/InteractionResults";
import { exportInteractions, exportLiterature, exportStructures } from "@/lib/exploration-csv";

/**
 * ExplorationModules — grid modul eksplorasi dengan status jujur
 * (available / loading / empty / unavailable / provider-error).
 *
 */

const STATE_BADGE: Record<
  ExplorationModuleState,
  { label: string; className: string }
> = {
  available: {
    label: "Available",
    className: "bg-success-container text-on-success-container",
  },
  loading: {
    label: "Loading",
    className: "bg-info-container text-on-info-container",
  },
  empty: {
    label: "No data",
    className: "bg-surface text-on-surface-variant",
  },
  unavailable: {
    label: "Unavailable",
    className: "bg-surface text-on-surface-variant",
  },
  "provider-error": {
    label: "Source error",
    className: "bg-error-container text-on-error-container",
  },
  partial: {
    label: "Partial results",
    className: "bg-amber-container text-on-amber-container",
  },
};

type Entity = { type: EntityType; id: string };

function LiveModuleCard<K extends LiveModule>({ data, entity, module, render, csv }: {
  data: ExplorationModuleData;
  entity: Entity;
  module: K;
  render: (response: ExplorationResult<ExplorationRecords[K]>) => ReactNode;
  csv?: { label: string; download: (response: ExplorationResult<ExplorationRecords[K]>) => void };
}) {
  const [response, setResponse] = useState<ExplorationResult<ExplorationRecords[K]> | null>(null);
  const [state, setState] = useState<ExplorationModuleState | null>(null);
  const [open, setOpen] = useState(false);
  const request = useRef<AbortController | null>(null);
  const panelId = useId();
  useEffect(() => () => request.current?.abort(), []);

  async function load() {
    setOpen(true);
    setState("loading");
    setResponse(null);
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    try {
      const next = await fetchExploration(entity.type, entity.id, module, controller.signal);
      if (controller.signal.aborted) return;
      setResponse(next);
      setState(next.status === "provider_error" ? "provider-error" : next.status);
    } catch {
      if (!controller.signal.aborted) setState("provider-error");
    }
  }

  const badge = state && STATE_BADGE[state];
  return (
    <PixelCard className={cn("flex h-full min-w-0 scroll-mt-24 flex-col gap-sm p-md", open && "sm:col-span-2 lg:col-span-3")}>
      <div className="flex flex-wrap items-center gap-sm">
        <h3 className="mr-auto font-headline text-headline-sm text-on-surface-card">{data.title}</h3>
        {badge && <span role="status" className={cn("rounded-md px-sm py-xs text-label-sm", badge.className)}>{badge.label}</span>}
      </div>
      <p className="text-body-sm text-on-surface-variant">{data.description}</p>
      <div className="flex flex-wrap gap-sm">
        <PixelButton size="sm" variant="ghost" aria-expanded={open} aria-controls={panelId}
          onClick={() => {
            if (open) setOpen(false);
            else if (state) setOpen(true);
            else void load();
          }}>
          {open ? `Hide ${module}` : `Load ${module}`}
        </PixelButton>
        {open && (state === "provider-error" || state === "partial") &&
          <PixelButton size="sm" variant="ghost" onClick={load}>Retry source</PixelButton>}
        {open && csv && response && response.records.length > 0 && (
          <PixelButton size="sm" onClick={() => csv.download(response)}>{csv.label}</PixelButton>
        )}
      </div>
      <div id={panelId} hidden={!open}>
        {open && state === "empty" && <p className="text-body-sm">No verified records were found.</p>}
        {open && state === "provider-error" && !response && <p className="text-body-sm">The request failed. Try again.</p>}
        {open && response && (
          <div className="flex flex-col gap-sm">
            {response.notices.map((notice) => (
              <p key={`${notice.source}:${notice.message}`} className="text-body-sm text-on-surface-variant">{notice.source}: {notice.message}</p>
            ))}
            {response.records.length > 0 && render(response)}
          </div>
        )}
      </div>
    </PixelCard>
  );
}

function ExplorationCard({ data, entity, exportConfig }: {
  data: ExplorationModuleData;
  entity?: Entity;
  exportConfig?: ExportConfig;
}) {
  if (entity && data.module === "sequence") {
    return <LiveModuleCard data={data} entity={entity} module="sequence"
      render={({ records, identity }) => <SequenceViewer records={records} identity={identity} />} />;
  }
  if (entity && data.module === "literature") {
    return <LiveModuleCard data={data} entity={entity} module="literature"
      csv={{ label: "Download literature CSV", download: exportLiterature }}
      render={({ records }) => <LiteratureResults records={records} />} />;
  }
  if (entity && data.module === "structure") {
    return <LiveModuleCard data={data} entity={entity} module="structure"
      csv={{ label: "Download structure CSV", download: exportStructures }}
      render={({ records }) => <StructureResults records={records} />} />;
  }
  if (entity && data.module === "ligand") {
    return <LiveModuleCard data={data} entity={entity} module="ligand"
      render={({ records }) => <LigandResults records={records} />} />;
  }
  if (entity && data.module === "interaction") {
    return <LiveModuleCard data={data} entity={entity} module="interaction"
      csv={{ label: "Download interaction CSV", download: exportInteractions }}
      render={({ records, identity }) => <InteractionResults records={records} identity={identity} />} />;
  }
  const details = entity && data.module === "export"
    ? { ...data, description: "Download entity metadata here. Open Literature, Structure, or Protein Interaction for their CSVs. Open Sequence for FASTA." }
    : data;
  return <ModuleCard data={details} exportConfig={data.module === "export" ? exportConfig : undefined} />;
}

export interface ExportConfig {
  rows: Record<string, unknown>[];
  columns: CsvColumn[];
  filename: string;
  /** Atribusi sumber — wajib ditampilkan agar redistribusi jujur. */
  attribution: string;
}

function ModuleCard({
  data,
  exportConfig,
}: {
  data: ExplorationModuleData;
  exportConfig?: ExportConfig;
}) {
  const badge = STATE_BADGE[data.state];
  const canExport =
    data.module === "export" && data.state === "available" && exportConfig;

  return (
    <PixelCard className="flex h-full flex-col justify-between gap-sm p-md">
      <div className="flex flex-col gap-sm">
        <div className="flex items-center justify-between gap-sm">
          <h3 className="font-headline text-headline-sm text-on-surface-card">
            {data.title}
          </h3>
          <span
            className={cn(
              "shrink-0 rounded-md border border-outline-subtle px-sm py-xs font-label text-label-sm",
              badge.className,
            )}
          >
            {badge.label}
          </span>
        </div>
        <p className="font-body text-body-sm text-on-surface-variant">
          {data.description}
        </p>
        {data.state !== "available" && data.detail && (
          <p className="font-body text-body-sm text-on-surface-variant">
            {data.detail}
          </p>
        )}
      </div>

      {canExport && exportConfig && (
        <div className="flex flex-col gap-xs">
          <p className="font-body text-body-sm text-on-surface-variant">
            {exportConfig.attribution}
          </p>
          <PixelButton
            size="sm"
            onClick={() =>
              downloadCsv(
                exportConfig.filename,
                toCsv(exportConfig.rows, exportConfig.columns),
              )
            }
          >
            Download CSV
          </PixelButton>
        </div>
      )}
    </PixelCard>
  );
}

export function ExplorationModules({
  modules,
  exportConfig,
  entity,
}: {
  modules: ExplorationModuleData[];
  exportConfig?: ExportConfig;
  entity?: Entity;
}) {
  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
      {modules.map((data) => (
        <ExplorationCard key={`${entity?.type}:${entity?.id}:${data.module}`} data={data} entity={entity} exportConfig={exportConfig} />
      ))}
    </div>
  );
}
