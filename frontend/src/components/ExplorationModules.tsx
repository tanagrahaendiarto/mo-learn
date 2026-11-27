"use client";

import type {
  ExplorationModuleData,
  ExplorationModuleState,
} from "@/types/molearn";
import { PixelCard } from "@/components/PixelCard";
import { PixelButton } from "@/components/PixelButton";
import { downloadCsv, toCsv, type CsvColumn } from "@/lib/csv";
import { cn } from "@/lib/cn";

/**
 * ExplorationModules — grid modul eksplorasi dengan status jujur
 * (available / loading / empty / unavailable / provider-error).
 *
 * Hanya modul `export` yang punya aksi (unduh CSV) DAN hanya saat
 * state `available` + ada data export. Modul lain menampilkan
 * deskripsi + state, tanpa mengarang data.
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
};

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
}: {
  modules: ExplorationModuleData[];
  exportConfig?: ExportConfig;
}) {
  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
      {modules.map((m) => (
        <ModuleCard
          key={m.module}
          data={m}
          exportConfig={m.module === "export" ? exportConfig : undefined}
        />
      ))}
    </div>
  );
}
