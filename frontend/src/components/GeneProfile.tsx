import Link from "next/link";
import type { GeneProfileData } from "@/types/molearn";
import { EntityBadge } from "@/components/EntityBadge";
import { SourceBadge } from "@/components/SourceBadge";
import { PixelCard } from "@/components/PixelCard";
import { SaveToCollection } from "@/components/SaveToCollection";

/**
 * GeneProfile — template profil gen yang dapat dipakai ulang (Task E).
 *
 * Ditujukan untuk integrasi NCBI Gene di Slice 2. Semua field yang
 * belum tersedia menampilkan fallback jujur ("Not available"), tidak
 * pernah mengarang. Live mode tetap menampilkan "Coming Soon" sampai
 * endpoint Slice 2 ada; template ini dipakai saat mode demo.
 */

function Unavailable({ label }: { label: string }) {
  return (
    <p className="font-body text-body-sm text-on-surface-variant">
      {label} — not available yet.
    </p>
  );
}

export function GeneProfile({ gene }: { gene: GeneProfileData }) {
  return (
    <div className="flex flex-col gap-lg">
      {/* Identity + organism + source */}
      <section className="flex flex-col gap-sm">
        <div className="flex flex-wrap items-center gap-sm">
          <EntityBadge type="gene" />
          <h1 className="font-headline text-headline-lg-mobile text-on-surface md:text-headline-lg">
            {gene.symbol}
          </h1>
          {/* Template dipakai hanya saat mode demo → tandai sebagai demo. */}
          <span className="rounded-md border border-outline-subtle bg-amber-container px-sm py-xs font-label text-label-sm text-on-amber-container">
            Demo
          </span>
        </div>
        <p className="font-mono text-mono-md text-on-surface-variant">
          {gene.name} • <em>{gene.organism}</em> • {gene.id}
        </p>
        <SourceBadge source={gene.source} className="self-start" />
        <div className="mt-xs">
          <SaveToCollection
            entity={{
              type: "gene",
              id: gene.id,
              name: gene.name,
              symbol: gene.symbol,
              organism: gene.organism,
              source: gene.source,
              isDemo: true,
            }}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-lg md:grid-cols-3">
        <div className="flex flex-col gap-lg md:col-span-2">
          <PixelCard className="p-lg">
            <h2 className="font-label text-label-sm text-on-surface-variant">
              About
            </h2>
            {gene.description ? (
              <p className="mt-xs font-body text-body-lg text-on-surface">
                {gene.description}
              </p>
            ) : (
              <Unavailable label="Beginner-friendly description" />
            )}
          </PixelCard>

          <PixelCard className="p-lg">
            <h2 className="font-label text-label-sm text-on-surface-variant">
              Gene function
            </h2>
            {gene.functionAnnotations && gene.functionAnnotations.length > 0 ? (
              <ul className="mt-xs flex flex-col gap-xs">
                {gene.functionAnnotations.map((f) => (
                  <li
                    key={f}
                    className="font-body text-body-sm text-on-surface"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            ) : (
              <Unavailable label="Gene function" />
            )}
          </PixelCard>

          <PixelCard className="p-lg">
            <h2 className="font-label text-label-sm text-on-surface-variant">
              Related proteins
            </h2>
            {gene.relatedProteins && gene.relatedProteins.length > 0 ? (
              <ul className="mt-xs flex flex-col gap-xs">
                {gene.relatedProteins.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/entity/protein/${encodeURIComponent(p.id)}`}
                      className="font-label text-label-md text-primary hover:underline"
                    >
                      {p.name ?? p.id} ({p.id}) →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Unavailable label="Related proteins" />
            )}
          </PixelCard>
        </div>

        <div className="flex flex-col gap-lg">
          <PixelCard className="p-lg">
            <h3 className="font-label text-label-sm text-on-surface-variant">
              Synonyms
            </h3>
            {gene.synonyms.length > 0 ? (
              <p className="mt-xs font-body text-body-sm text-on-surface">
                {gene.synonyms.join(", ")}
              </p>
            ) : (
              <Unavailable label="Synonyms" />
            )}
          </PixelCard>

          <PixelCard className="p-lg">
            <h3 className="font-label text-label-sm text-on-surface-variant">
              Chromosomal location
            </h3>
            {gene.location ? (
              <p className="mt-xs font-body text-body-sm text-on-surface">
                {gene.location}
              </p>
            ) : (
              <Unavailable label="Chromosomal location" />
            )}
          </PixelCard>

          <PixelCard className="p-lg">
            <h3 className="font-label text-label-sm text-on-surface-variant">
              Source &amp; evidence
            </h3>
            <p className="mt-xs font-body text-body-sm text-on-surface">
              {gene.source}
            </p>
            <p className="mt-xs font-body text-body-sm text-on-surface-variant">
              Gene records arrive with NCBI Gene integration (Slice 2).
            </p>
          </PixelCard>
        </div>
      </div>
    </div>
  );
}
