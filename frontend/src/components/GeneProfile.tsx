import type {
  ExplorationModuleData,
  GeneEntityProfile,
  RelationshipGraph,
} from "@/types/molearn";
import type { ExportConfig } from "@/components/ExplorationModules";
import { EntityBadge } from "@/components/EntityBadge";
import { SourceBadge } from "@/components/SourceBadge";
import { PixelCard } from "@/components/PixelCard";
import { SaveToCollection } from "@/components/SaveToCollection";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { ScientificAnnotation } from "@/components/ScientificAnnotation";
import { RelationshipExplorer } from "@/components/RelationshipExplorer";
import { ExplorationModules } from "@/components/ExplorationModules";
import { StudyCompanion } from "@/components/StudyCompanion";

/**
 * GeneProfile — profil gen NCBI Gene (slice 2).
 *
 * Semua field berasal dari respons backend. Field yang tidak dikirim
 * sumber (description/chromosome/gene_type) tampil sebagai "not available",
 * tidak pernah diisi tebakan. NCBI summary ditampilkan sebagai anotasi
 * sumber mentah, bukan penjelasan pemula tervalidasi.
 */
function Unavailable({ label }: { label: string }) {
  return (
    <p className="font-body text-body-sm text-on-surface-variant">
      {label} — not available from NCBI Gene.
    </p>
  );
}

export function GeneProfile({
  gene,
  graph,
  modules,
  exportConfig,
  isDemo,
}: {
  gene: GeneEntityProfile;
  graph: RelationshipGraph;
  modules: ExplorationModuleData[];
  exportConfig?: ExportConfig;
  isDemo?: boolean;
}) {
  return (
    <div className="flex flex-col gap-lg">
      {/* 1. Identity + organism + source */}
      <section className="flex flex-col gap-sm">
        <div className="flex flex-wrap items-center gap-sm">
          <EntityBadge type="gene" />
          <h1 className="font-headline text-headline-lg-mobile text-on-surface md:text-headline-lg">
            {gene.symbol || gene.name}
          </h1>
          {isDemo && (
            <span className="rounded-md border border-outline-subtle bg-amber-container px-sm py-xs font-label text-label-sm text-on-amber-container">
              Demo
            </span>
          )}
        </div>
        <p className="font-body text-body-md text-on-surface-variant">
          {gene.name}
          {" · "}
          <em>{gene.organism}</em>
          {" · "}
          GeneID{" "}
          <span className="font-mono text-mono-md text-primary">{gene.id}</span>
        </p>
        <div className="flex flex-wrap items-center gap-sm">
          <SourceBadge source={gene.source} />
          {gene.geneType && (
            <span className="rounded-md border border-outline-subtle bg-surface px-sm py-xs font-label text-label-sm text-on-surface-variant">
              {gene.geneType}
            </span>
          )}
        </div>

        {/* 8. Save to Collection — identitas kanonik = GeneID */}
        <div className="mt-sm">
          <SaveToCollection
            entity={{
              type: "gene",
              id: gene.id,
              name: gene.name,
              symbol: gene.symbol,
              organism: gene.organism,
              source: gene.source,
              isDemo,
            }}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-lg md:grid-cols-3">
        <div className="flex flex-col gap-lg md:col-span-2">
          {/* 2–3. No validated beginner summary; raw NCBI text below. */}
          <ExplanationPanel summary={gene.summary} />

          {gene.description ? (
            <ScientificAnnotation
              annotations={[gene.description]}
              source="NCBI Gene"
            />
          ) : (
            <PixelCard className="p-lg">
              <h2 className="font-label text-label-sm text-on-surface-variant">
                Original scientific annotation
              </h2>
              <p className="mt-xs font-body text-body-sm text-on-surface-variant">
                No gene summary is available from NCBI Gene for this record.
              </p>
            </PixelCard>
          )}

          {/* 6. Verified gene→protein links (UniProt GeneID cross-reference). */}
          <PixelCard className="p-lg">
            <h2 className="mb-sm font-label text-label-sm text-on-surface-variant">
              Related entities
            </h2>
            <RelationshipExplorer graph={graph} />
          </PixelCard>

          {/* 7. Exploration modules */}
          <section>
            <h2 className="mb-sm font-label text-label-sm text-on-surface-variant">
              Exploration modules
            </h2>
            <ExplorationModules modules={modules} exportConfig={exportConfig} />
          </section>

          {/* 9. Study Companion */}
          <StudyCompanion entityName={gene.name} type="gene" />
        </div>

        <div className="flex flex-col gap-lg">
          {/* 4. Source & evidence */}
          <PixelCard className="p-lg">
            <h3 className="font-label text-label-sm text-on-surface-variant">
              Source &amp; evidence
            </h3>
            {gene.sourceUrl ? (
              <a
                href={gene.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-xs inline-flex items-center gap-xs font-label text-label-md text-primary hover:underline"
              >
                GeneID {gene.id} on NCBI Gene ↗
              </a>
            ) : (
              <p className="mt-xs font-body text-body-sm text-on-surface-variant">
                No source link is available.
              </p>
            )}
            {gene.retrievedAt && (
              <p className="mt-xs font-mono text-mono-sm text-on-surface-variant">
                Retrieved {gene.retrievedAt}
              </p>
            )}
          </PixelCard>

          {/* 5. Advanced details */}
          <PixelCard className="p-lg">
            <h3 className="font-label text-label-sm text-on-surface-variant">
              Advanced details
            </h3>
            <dl className="mt-xs flex flex-col gap-xs font-body text-body-sm text-on-surface">
              <div className="flex justify-between gap-sm">
                <dt className="text-on-surface-variant">GeneID</dt>
                <dd className="font-mono tabular-nums">{gene.id}</dd>
              </div>
              {gene.chromosome ? (
                <div className="flex justify-between gap-sm">
                  <dt className="text-on-surface-variant">Chromosome</dt>
                  <dd>{gene.chromosome}</dd>
                </div>
              ) : (
                <Unavailable label="Chromosome" />
              )}
              {gene.geneType && (
                <div className="flex justify-between gap-sm">
                  <dt className="text-on-surface-variant">Gene type</dt>
                  <dd>{gene.geneType}</dd>
                </div>
              )}
              {gene.taxonomyId != null && (
                <div className="flex justify-between gap-sm">
                  <dt className="text-on-surface-variant">Taxonomy ID</dt>
                  <dd className="tabular-nums">{gene.taxonomyId}</dd>
                </div>
              )}
            </dl>
          </PixelCard>

          {/* Cross-references: identity only, not navigable without GeneID. */}
          <PixelCard className="p-lg">
            <h3 className="font-label text-label-sm text-on-surface-variant">
              Cross-references
            </h3>
            {gene.crossReferences.length > 0 ? (
              <ul className="mt-xs flex flex-col gap-xs font-body text-body-sm text-on-surface">
                {gene.crossReferences.map((xref) => (
                  <li key={`${xref.namespace}:${xref.id}`}>
                    <span className="text-on-surface-variant">
                      {xref.namespace}:
                    </span>{" "}
                    <span className="font-mono">{xref.id}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Unavailable label="Cross-references" />
            )}
          </PixelCard>

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
              Related protein names from NCBI
            </h3>
            {gene.relatedProteins.length > 0 ? (
              <>
                <ul className="mt-xs flex flex-col gap-xs font-body text-body-sm text-on-surface">
                  {gene.relatedProteins.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
                <p className="mt-xs font-body text-body-sm text-on-surface-variant">
                  Names only — NCBI does not supply accessions here. Verified
                  links appear in Related entities.
                </p>
              </>
            ) : (
              <Unavailable label="Related protein names" />
            )}
          </PixelCard>
        </div>
      </div>
    </div>
  );
}
