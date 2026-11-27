import { cn } from "@/lib/cn";
import { PixelCard } from "@/components/PixelCard";

/**
 * State UI pencarian — memisahkan eksplisit:
 *  - LoadingState : "Loading data from biological providers..."
 *  - EmptyState   : "No results" / data not yet available
 *  - ErrorState   : network / API error
 *  - DemoBanner   : marker for local fixture data (when backend not connected)
 */

/** Skeleton grid hasil (2 kolom di desktop). */
export function LoadingState() {
  return (
    <div
      className="grid grid-cols-1 gap-lg md:grid-cols-2"
      role="status"
      aria-busy="true"
    >
      <p className="sr-only">Loading data from biological providers...</p>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-md rounded-md border border-outline-subtle bg-surface-card p-lg shadow-card-sm animate-pulse"
        >
          <div className="h-6 w-2/3 rounded-md bg-muted-green" />
          <div className="h-4 w-1/3 rounded-md bg-muted-green" />
          <div className="h-12 w-full rounded-md bg-muted-green" />
        </div>
      ))}
    </div>
  );
}

/** Tidak ada hasil / data belum tersedia (bukan error jaringan). */
export function EmptyState({
  title = "No Entities Found",
  description = "We couldn't find a gene or protein matching that keyword. Check the symbol spelling or try an accession ID.",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <PixelCard shadow="lg" className="mx-auto my-xl max-w-[42rem] p-xl text-center">
      <h2 className="mb-xs font-headline text-headline-md text-on-surface">
        {title}
      </h2>
      <p className="mb-lg font-body text-body-md text-on-surface-variant">
        {description}
      </p>
      {action}
    </PixelCard>
  );
}

/** Error jaringan / API (berbeda dari "data belum tersedia"). */
export function ErrorState({
  title = "Unable to Load Data",
  description = "Could not reach the biological data service. Check your connection and try again.",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <PixelCard shadow="lg" className="mx-auto my-xl max-w-[36rem] p-xl">
      <div className="flex flex-col items-center gap-sm text-center">
        <span className="rounded-md bg-error-container px-sm py-xs font-label text-label-md text-on-error-container">
          Error
        </span>
        <h2 className="font-headline text-headline-md text-on-surface">
          {title}
        </h2>
        <p className="font-body text-body-md text-on-surface-variant">
          {description}
        </p>
        {action}
      </div>
    </PixelCard>
  );
}

/** Banner penanda mode demo — WAJIB tampil bila data berasal dari fixture. */
export function DemoBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      role="status"
      className={cn(
        "rounded-md border border-outline-subtle bg-amber-container px-md py-sm font-label text-label-md text-on-amber-container",
      )}
    >
      Demo mode — local fixture data. Connect the backend to see live results.
    </div>
  );
}
