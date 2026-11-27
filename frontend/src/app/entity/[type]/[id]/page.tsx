import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { isEntityType } from "@/types/molearn";
import { EntityBadge } from "@/components/EntityBadge";
import { PixelCard } from "@/components/PixelCard";
import { PixelButtonLink } from "@/components/PixelButton";
import { fetchEntityProfile, IS_DEMO_MODE, ApiError } from "@/lib/api";

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
      title: `${profile.symbol ?? profile.name} — moLearn`,
    };
  } catch {
    return { title: "Entity Profile — moLearn" };
  }
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

  // Slice 1: hanya protein yang tersedia
  if (type !== "protein") {
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
              {type === "gene"
                ? "Gene profiles are coming in slice 2 (NCBI Gene integration)."
                : `Entity type "${type}" will be available in a future update.`}
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

  let profile;
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

      <div className="mt-lg flex flex-wrap items-center gap-sm">
        <EntityBadge type="protein" />
        <h1 className="font-headline text-headline-lg-mobile text-on-surface md:text-headline-lg">
          {profile.symbol ?? profile.name}
        </h1>
        {IS_DEMO_MODE && (
          <span className="rounded-md border border-outline-subtle bg-amber-container px-sm py-xs font-label text-label-sm text-on-amber-container">
            Demo
          </span>
        )}
      </div>

      <p className="mt-xs font-mono text-mono-md text-on-surface-variant">
        {profile.name} • {profile.organism} • {profile.id}
      </p>

      <div className="mt-lg grid grid-cols-1 gap-lg md:grid-cols-3">
        <div className="md:col-span-2">
          <PixelCard className="p-lg">
            <h2 className="font-label text-label-sm text-on-surface-variant">
              About
            </h2>
            <p className="mt-xs font-body text-body-lg text-on-surface">
              {profile.sections.apaItu}
            </p>

            <div className="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2">
              <div>
                <h3 className="font-label text-label-sm text-on-surface-variant">Function</h3>
                <p className="mt-xs font-body text-body-sm text-on-surface">
                  {profile.sections.fungsi}
                </p>
              </div>
              <div>
                <h3 className="font-label text-label-sm text-on-surface-variant">Location</h3>
                <p className="mt-xs font-body text-body-sm text-on-surface">
                  {profile.sections.lokasi}
                </p>
              </div>
            </div>
          </PixelCard>
        </div>

        <div className="flex flex-col gap-lg">
          {profile.references.uniprotUrl && (
            <PixelCard className="p-lg">
              <h3 className="font-label text-label-sm text-on-surface-variant">UniProt</h3>
              <a
                href={profile.references.uniprotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-xs inline-flex items-center gap-xs font-label text-label-md text-primary hover:underline"
              >
                {profile.id} ↗
              </a>
            </PixelCard>
          )}

          {profile.relatedGeneId && (
            <PixelCard className="p-lg">
              <h3 className="font-label text-label-sm text-on-surface-variant">Gene</h3>
              <p className="mt-xs font-mono text-mono-md text-on-surface">
                {profile.relatedGeneId}
              </p>
            </PixelCard>
          )}
        </div>
      </div>

      <div className="mt-xl">
        <PixelButtonLink href="/search" variant="ghost" size="md">
          ← Search Other Entities
        </PixelButtonLink>
      </div>
    </main>
  );
}
