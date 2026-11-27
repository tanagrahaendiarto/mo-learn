import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isEntityType } from "@/types/molearn";
import type { ExplorationModuleData, EntityProfile } from "@/types/molearn";
import { EntityBadge } from "@/components/EntityBadge";
import { SourceBadge } from "@/components/SourceBadge";
import { PixelCard } from "@/components/PixelCard";
import { PixelButtonLink } from "@/components/PixelButton";
import { SaveToCollection } from "@/components/SaveToCollection";
import { RelationshipExplorer } from "@/components/RelationshipExplorer";
import { ExplorationModules } from "@/components/ExplorationModules";
import { StudyCompanion } from "@/components/StudyCompanion";
import { GeneProfile } from "@/components/GeneProfile";
import { HelpTooltip } from "@/components/HelpTooltip";
import { ExplanationPanel } from "@/components/ExplanationPanel";
import { ScientificAnnotation } from "@/components/ScientificAnnotation";
import { buildCrossrefGraph } from "@/lib/relationships";
import type { CsvColumn } from "@/lib/csv";
import { fetchEntityProfile, IS_DEMO_MODE, ApiError } from "@/lib/api";
import { GENE_PROFILE_FIXTURES, EXPLORATION_MODULES } from "@/data/fixtures";

type Params = Promise<{ type: string; id: string }>;

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function generateMetadata(
  props: { params: Params },
): Promise<Metadata> {
  const raw = await props.params;
  const type = decodeParam(raw.type);
  const id = decodeParam(raw.id);

  if (type !== "protein") {
    return { title: "Entity Profile — moLearn" };
  }

  try {
    const profile = await fetchEntityProfile(type, id);
    return {
      title: profile.symbol
        ? `${profile.name} (${profile.symbol}) — moLearn`
        : `${profile.name} — moLearn`,
    };
  } catch {
    return { title: "Entity Profile — moLearn" };
  }
}

/** Kolom ekspor CSV identitas entitas (data tabular ternormalisasi). */
const EXPORT_COLUMNS: CsvColumn[] = [
  { key: "type", label: "Type" },
  { key: "id", label: "Identifier" },
  { key: "symbol", label: "Symbol" },
  { key: "name", label: "Name" },
  { key: "organism", label: "Organism" },
  { key: "source", label: "Source" },
];

/** Modul eksplorasi dinamis per entitas — hanya yang didukung data sumber. */
function modulesForProfile(
  profile: EntityProfile,
): ExplorationModuleData[] {
  return EXPLORATION_MODULES.map((m) => {
    if (m.module === "sequence") {
      if (profile.length != null) {
        return {
          ...m,
          state: "available" as const,
          detail: `Sequence length: ${profile.length} amino acids. The full sequence is not loaded.`,
        };
      }
      return {
        ...m,
        state: "empty" as const,
        detail: "Sequence length is not available for this entity.",
      };
    }
    if (m.module === "export") {
      return {
        ...m,
        state: "available" as const,
        detail: "Download this entity's normalized summary as CSV.",
      };
    }
    return m;
  });
}

function ProteinProfile({ profile }: { profile: EntityProfile }) {
  const graph = buildCrossrefGraph(profile, IS_DEMO_MODE);
  const modules = modulesForProfile(profile);
  const exportRows = [
    {
      type: profile.type,
      id: profile.id,
      symbol: profile.symbol,
      name: profile.name,
      organism: profile.organism,
      source: profile.source,
    },
  ];

  return (
    <div className="flex flex-col gap-lg">
      {/* 1. Identity + organism */}
      <section className="flex flex-col gap-sm">
        <div className="flex flex-wrap items-center gap-sm">
          <EntityBadge type="protein" />
          <h1 className="font-headline text-headline-lg-mobile text-on-surface md:text-headline-lg">
            {profile.name}
          </h1>
          {IS_DEMO_MODE && (
            <span className="rounded-md border border-outline-subtle bg-amber-container px-sm py-xs font-label text-label-sm text-on-amber-container">
              Demo
            </span>
          )}
        </div>
        <p className="font-body text-body-md text-on-surface-variant">
          {profile.symbol && (
            <>
              Gene symbol{" "}
              <span className="font-mono text-mono-md text-primary">
                {profile.symbol}
              </span>
              {" · "}
            </>
          )}
          <em>{profile.organism}</em>
          {" · "}
          <span className="font-mono text-mono-md">{profile.id}</span>
        </p>
        <div className="flex flex-wrap items-center gap-sm">
          <SourceBadge source={profile.source} />
          {profile.reviewed !== undefined && (
            <span
              className={
                profile.reviewed
                  ? "rounded-md border border-outline-subtle bg-success-container px-sm py-xs font-label text-label-sm text-on-success-container"
                  : "rounded-md border border-outline-subtle bg-surface px-sm py-xs font-label text-label-sm text-on-surface-variant"
              }
            >
              {profile.reviewed ? "Reviewed" : "Unreviewed"}
              <HelpTooltip
                label="About Reviewed and Unreviewed entries"
                text="Reviewed (Swiss-Prot) entries are manually curated by experts. Unreviewed (TrEMBL) entries are produced automatically from genome data without manual review."
                className="ml-xs"
              />
            </span>
          )}
        </div>

        {/* 8. Save to Collection */}
        <div className="mt-sm">
          <SaveToCollection
            entity={{
              type: "protein",
              id: profile.id,
              name: profile.name,
              symbol: profile.symbol,
              organism: profile.organism,
              source: profile.source,
              isDemo: IS_DEMO_MODE,
            }}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-lg md:grid-cols-3">
        <div className="flex flex-col gap-lg md:col-span-2">
          {/* 2–3. Validated explanation + key functions, then raw source text */}
          <ExplanationPanel summary={profile.summary} />

          {profile.functionAnnotations.length > 0 ? (
            <ScientificAnnotation
              annotations={profile.functionAnnotations}
              source={profile.source}
            />
          ) : (
            <PixelCard className="p-lg">
              <h2 className="font-label text-label-sm text-on-surface-variant">
                Original scientific annotation
              </h2>
              <p className="mt-xs font-body text-body-sm text-on-surface-variant">
                No function annotation is available from the source.
              </p>
            </PixelCard>
          )}

          {/* 6. Related biological entities (relationship explorer) */}
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
            <ExplorationModules
              modules={modules}
              exportConfig={{
                rows: exportRows,
                columns: EXPORT_COLUMNS,
                filename: `${profile.id}.csv`,
                attribution: `Source: ${profile.source}. Attribute the source when sharing this data.`,
              }}
            />
          </section>

          {/* 9. Study Companion */}
          <StudyCompanion entityName={profile.name} type="protein" />
        </div>

        <div className="flex flex-col gap-lg">
          {/* 4. Source & evidence */}
          <PixelCard className="p-lg">
            <h3 className="font-label text-label-sm text-on-surface-variant">
              Source &amp; evidence
            </h3>
            {profile.references.uniprotUrl ? (
              <a
                href={profile.references.uniprotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-xs inline-flex items-center gap-xs font-label text-label-md text-primary hover:underline"
              >
                {profile.id} on {profile.source} ↗
              </a>
            ) : (
              <p className="mt-xs font-body text-body-sm text-on-surface-variant">
                No source link is available.
              </p>
            )}
          </PixelCard>

          {/* 5. Advanced details */}
          <PixelCard className="p-lg">
            <h3 className="font-label text-label-sm text-on-surface-variant">
              Advanced details
            </h3>
            <dl className="mt-xs flex flex-col gap-xs font-body text-body-sm text-on-surface">
              {profile.length != null && (
                <div className="flex justify-between gap-sm">
                  <dt className="text-on-surface-variant">Length</dt>
                  <dd className="tabular-nums">{profile.length} aa</dd>
                </div>
              )}
              {profile.taxonomyId != null && (
                <div className="flex justify-between gap-sm">
                  <dt className="text-on-surface-variant">Taxonomy ID</dt>
                  <dd className="tabular-nums">{profile.taxonomyId}</dd>
                </div>
              )}
              {profile.reviewed !== undefined && (
                <div className="flex justify-between gap-sm">
                  <dt className="text-on-surface-variant">Review status</dt>
                  <dd>{profile.reviewed ? "Reviewed" : "Unreviewed"}</dd>
                </div>
              )}
            </dl>
          </PixelCard>
        </div>
      </div>
    </div>
  );
}

export default async function EntityProfilePage(props: {
  params: Params;
}) {
  const raw = await props.params;
  const type = decodeParam(raw.type);
  const id = decodeParam(raw.id);

  if (!isEntityType(type)) {
    notFound();
  }

  // Gene: template demo (Slice 2 NCBI Gene belum tersedia) atau Coming Soon.
  if (type === "gene") {
    const gene = IS_DEMO_MODE
      ? GENE_PROFILE_FIXTURES.find((g) => g.id === id)
      : undefined;

    if (gene) {
      return (
        <main className="mx-auto w-full max-w-5xl px-md py-xl md:px-xl">
          <Link
            href="/search"
            className="inline-flex items-center gap-xs font-label text-label-md text-on-surface-variant hover:text-primary"
          >
            ← Back to Search
          </Link>
          <div className="mt-xl">
            <GeneProfile gene={gene} />
          </div>
        </main>
      );
    }

    return (
      <main className="mx-auto w-full max-w-5xl px-md py-xl md:px-xl">
        <Link
          href="/search"
          className="inline-flex items-center gap-xs font-label text-label-md text-on-surface-variant hover:text-primary"
        >
          ← Back to Search
        </Link>

        <div className="mt-xl">
          <PixelCard shadow="lg" className="p-xl text-center">
            <EntityBadge type={type} />
            <h1 className="mt-md font-headline text-headline-lg-mobile text-on-surface md:text-headline-lg">
              Coming Soon
            </h1>
            <p className="mt-xs font-body text-body-md text-on-surface-variant">
              Gene profiles are coming in slice 2 (NCBI Gene integration).
            </p>
            <p className="mt-sm font-body text-body-sm text-on-surface-variant">
              For now, explore protein profiles from UniProt.
            </p>
            <div className="mt-lg">
              <PixelButtonLink href="/search" variant="primary" size="md">
                Explore Proteins
              </PixelButtonLink>
            </div>
          </PixelCard>
        </div>
      </main>
    );
  }

  let profile: EntityProfile;
  try {
    profile = await fetchEntityProfile(type, id);
  } catch (error) {
    const err = error instanceof ApiError ? error.status : undefined;
    // 404: accession valid tapi tidak ada. 422: format accession tidak valid.
    // Keduanya = entitas tidak bisa ditampilkan -> halaman "not found".
    if (err === 404 || err === 422) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-md py-xl md:px-xl">
      <Link
        href="/search"
        className="inline-flex items-center gap-xs font-label text-label-md text-on-surface-variant hover:text-primary"
      >
        ← Back to Search
      </Link>

      <div className="mt-lg">
        <ProteinProfile profile={profile} />
      </div>

      <div className="mt-xl">
        <PixelButtonLink href="/search" variant="ghost" size="md">
          ← Search Other Entities
        </PixelButtonLink>
      </div>
    </main>
  );
}
