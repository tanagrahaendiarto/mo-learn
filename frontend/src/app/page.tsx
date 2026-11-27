import Link from "next/link";
import { SearchInput } from "@/components/SearchInput";
import { EncyclopediaCard } from "@/components/EntityCard";
import {
  IconSearchWhite,
  IconBookWhite,
  IconGraphWhite,
} from "@/components/icons";
import { FEATURED_ENTITIES, SUGGESTED_TERMS } from "@/data/fixtures";

/**
 * Landing page moLearn — search-first educational SaaS.
 *
 * Structure: hero (headline + search + suggested queries), featured
 * entities, a three-step learning journey, and trusted data sources.
 * The oversized pixel-art lab diorama and the six-module "command menu"
 * have been removed in favor of compact, consistent cards.
 */

/** Three-step learning journey. */
const STEPS: {
  title: string;
  body: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
}[] = [
  {
    title: "Discover",
    body: "Search genes and proteins by name, symbol, or accession ID — and tell them apart.",
    icon: IconSearchWhite,
  },
  {
    title: "Understand",
    body: "Read beginner-friendly explanations of what each molecule is, where it lives, and what it does.",
    icon: IconBookWhite,
  },
  {
    title: "Connect",
    body: "Explore structures, ligands, and interaction maps, then save entries to your collection.",
    icon: IconGraphWhite,
  },
];

/** Trusted upstream data sources. */
const SOURCES = ["UniProt", "NCBI Gene", "PDB", "STRING"] as const;

export default function LandingPage() {
  return (
    <>
      {/* ===== Hero ===== */}
      <section className="mx-auto max-w-7xl px-md pt-2xl md:px-xl">
        <div className="mx-auto flex max-w-[48rem] flex-col items-start gap-md">
          <h1 className="text-balance font-headline text-display-lg-mobile text-on-surface md:text-display-lg">
            Explore life, one molecule at a time.
          </h1>
          <p className="max-w-prose text-pretty font-body text-body-lg text-on-surface-variant">
            moLearn turns gene and protein data into a clear, beginner-friendly
            learning experience — with plain explanations, 3D structure, and
            biological relationship maps.
          </p>

          <div className="w-full">
            <SearchInput submitLabel="Search" className="sm:max-w-none" />
          </div>

          <div className="flex flex-wrap items-center gap-sm">
            <span className="font-label text-label-md text-on-surface-variant">
              Try:
            </span>
            {SUGGESTED_TERMS.map((term) => (
              <Link
                key={term}
                href={`/search?q=${encodeURIComponent(term)}`}
                className="rounded-md border border-outline-subtle bg-surface-card px-sm py-xs font-label text-label-md text-primary shadow-card-sm hover:bg-muted-green"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Featured entities ===== */}
      <section className="mx-auto max-w-7xl px-md py-2xl md:px-xl">
        <div className="mb-lg flex flex-col justify-between gap-sm sm:flex-row sm:items-end">
          <div>
            <h2 className="font-headline text-headline-lg text-on-surface">
              Featured entities
            </h2>
            <p className="mt-xs font-body text-body-md text-on-surface-variant">
              A few well-studied examples to get you started.
            </p>
          </div>
          <Link
            href="/search"
            className="font-label text-label-lg text-primary hover:underline"
          >
            Open the directory →
          </Link>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-lg sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_ENTITIES.map((entity) => (
            <EncyclopediaCard key={`${entity.type}-${entity.id}`} entity={entity} />
          ))}
        </div>
      </section>

      {/* ===== Three-step journey ===== */}
      <section className="border-y border-outline-subtle bg-muted-green/40 py-2xl">
        <div className="mx-auto max-w-7xl px-md md:px-xl">
          <div className="mb-lg max-w-[42rem]">
            <h2 className="font-headline text-headline-lg text-on-surface">
              Your learning journey
            </h2>
            <p className="mt-xs font-body text-body-md text-on-surface-variant">
              Three steps from search to understanding.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-lg md:grid-cols-3">
            {STEPS.map(({ title, body, icon: Icon }, i) => (
              <article
                key={title}
                className="flex flex-col gap-sm rounded-lg border border-outline-subtle bg-surface-card p-lg shadow-card"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-on-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex items-baseline gap-sm">
                  <span className="font-label text-label-lg text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-headline text-headline-md text-on-surface">
                    {title}
                  </h3>
                </div>
                <p className="font-body text-body-md text-on-surface-variant">
                  {body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Trusted sources ===== */}
      <section className="mx-auto max-w-7xl px-md py-2xl md:px-xl">
        <h2 className="font-headline text-headline-lg text-on-surface">
          Data from trusted sources
        </h2>
        <p className="mt-xs font-body text-body-md text-on-surface-variant">
          moLearn aggregates biological records from established public
          databases, clearly attributed on every entity.
        </p>

        <div className="mt-lg flex flex-wrap gap-sm">
          {SOURCES.map((source) => (
            <span
              key={source}
              className="rounded-md border border-outline-subtle bg-surface-card px-md py-sm font-label text-label-lg text-on-surface shadow-card-sm"
            >
              {source}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
