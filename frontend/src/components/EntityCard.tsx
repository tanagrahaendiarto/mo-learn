import { cn } from "@/lib/cn";
import { PixelCard, accentHeader } from "@/components/PixelCard";
import { ENTITY_TYPE_LABELS, type BiologicalEntitySummary } from "@/types/molearn";
import {
  IconDnaCard,
  IconEnzymeCard,
  IconHormoneCard,
  IconProteinCard,
} from "@/components/icons";

/**
 * Kartu entitas moLearn. Dua varian:
 *
 * - `EncyclopediaCard` : kartu "Ensiklopedia Spesimen" di landing
 *   (kode DEX + tipe, ikon, nama, ringkasan, footer "Buka Catatan").
 * - `ResultCard`       : kartu hasil pencarian di /search
 *   (simbol • ID + tipe, ikon, nama, organisme, deskripsi,
 *    catatan parsial bila perlu, footer sumber + "Buka Profil").
 *
 * BUG STITCH YANG DIPERBAIKI: semua kartu di blueprint merujuk ke
 * `EntityProfile.html?entity=p53`. Di moLearn setiap kartu merute
 * ke profil entitas SENDIRI: `/entity/{type}/{id}`.
 */

const iconMap = {
  dna: IconDnaCard,
  protein: IconProteinCard,
  hormone: IconHormoneCard,
  enzyme: IconEnzymeCard,
} as const;

/** Label kategori fungsional (hormon/enzim), ditampilkan sebagai chip kecil. */
const CATEGORY_LABELS: Record<
  NonNullable<BiologicalEntitySummary["badge"]>,
  string
> = {
  gene: "Gene",
  protein: "Protein",
  hormone: "Hormone",
  enzyme: "Enzyme",
};

function entityHref(entity: BiologicalEntitySummary): string {
  return `/entity/${entity.type}/${encodeURIComponent(entity.id)}`;
}

/** Ikon per kategori kartu (default berdasarkan tipe data). */
function CardIcon({ entity }: { entity: BiologicalEntitySummary }) {
  const key = entity.icon ?? (entity.type === "gene" ? "dna" : "protein");
  const Icon = iconMap[key];
  return <Icon className="h-7 w-7" />;
}

export function EncyclopediaCard({
  entity,
}: {
  entity: BiologicalEntitySummary;
}) {
  const accent = entity.badge ?? (entity.type === "gene" ? "gene" : "protein");
  return (
    <PixelCard
      as="a"
      href={entityHref(entity)}
      hoverable
      className="flex h-full flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary"
    >
      <div
        className={cn(
          "flex items-center justify-between gap-sm border-b border-outline-subtle px-md py-sm",
          accentHeader(accent),
        )}
      >
        <span className="truncate font-mono text-mono-sm font-medium">
          {entity.source}
        </span>
        <span className="flex shrink-0 items-center gap-xs">
          <span className="rounded-sm bg-surface-card/70 px-xs py-xs font-label text-label-sm">
            {ENTITY_TYPE_LABELS[entity.type]}
          </span>
          {entity.badge === "hormone" || entity.badge === "enzyme" ? (
            <span className="rounded-sm bg-surface-card/70 px-xs py-xs font-label text-label-sm">
              {CATEGORY_LABELS[entity.badge]}
            </span>
          ) : null}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-sm p-md">
        <div className="flex items-center gap-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-outline-subtle bg-surface">
            <CardIcon entity={entity} />
          </div>
          <div className="min-w-0">
            <h3 className="font-headline text-headline-sm text-on-surface-card">
              {entity.symbol ?? entity.name}
            </h3>
            <p className="font-mono text-mono-sm text-on-surface-variant">
              {entity.organism}
            </p>
          </div>
        </div>
        <p className="font-body text-body-md text-on-surface-variant">
          {entity.summary}
        </p>
      </div>
      <div className="flex items-center justify-between gap-sm border-t border-outline-subtle bg-surface px-md py-sm font-label text-label-md text-primary">
        <span>Open Record</span>
        <span aria-hidden="true">→</span>
      </div>
    </PixelCard>
  );
}

export function ResultCard({ entity }: { entity: BiologicalEntitySummary }) {
  const accent = entity.type;
  return (
    <PixelCard shadow="lg" className="flex flex-col justify-between">
      <div>
        <div
          className={cn(
            "flex items-center justify-between gap-sm border-b border-outline-subtle px-md py-sm",
            accentHeader(accent),
          )}
        >
          <span className="min-w-0 truncate font-mono text-mono-sm font-medium">
            {entity.symbol ?? entity.name} • {entity.id}
          </span>
          <span className="shrink-0 rounded-sm bg-surface-card/70 px-xs py-xs font-label text-label-sm">
            {ENTITY_TYPE_LABELS[entity.type]}
          </span>
        </div>
        <div className="flex flex-col gap-sm p-lg">
          <div className="flex items-start gap-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-outline-subtle bg-surface">
              <CardIcon entity={entity} />
            </div>
            <div className="min-w-0">
              <h3 className="font-headline text-headline-sm text-on-surface-card text-balance">
                {entity.name}
              </h3>
              <p className="font-body text-body-sm text-on-surface-variant italic">
                {entity.organism}
              </p>
            </div>
          </div>
          {entity.summary ? (
            <p className="font-body text-body-md text-on-surface-card">
              {entity.summary}
            </p>
          ) : null}
          {entity.partial && (
            <div className="rounded-md border border-outline-subtle bg-warning-container px-sm py-xs font-label text-label-md text-on-warning-container">
              Some structure/interaction data not yet available
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-sm border-t border-outline-subtle bg-surface px-lg py-sm">
        <span className="font-label text-label-sm text-on-surface-variant">
          Source: {entity.source}
        </span>
        <a
          href={entityHref(entity)}
          className="inline-flex shrink-0 items-center gap-xs whitespace-nowrap rounded-md border-2 border-primary bg-primary px-md py-xs font-label text-label-md text-on-primary shadow-card-sm hover:bg-secondary hover:text-on-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-tertiary"
        >
          Open Profile
        </a>
      </div>
    </PixelCard>
  );
}
