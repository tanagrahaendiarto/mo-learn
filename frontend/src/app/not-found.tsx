import Link from "next/link";
import { IconMagnifier, IconDna } from "@/components/icons";

/**
 * 404 page — shown when a route/entity is not found
 * (e.g. an entity profile with an unrecognized type/id).
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[36rem] flex-col items-center gap-lg px-md py-3xl text-center">
      <div className="flex items-center gap-lg rounded-lg border border-outline-subtle bg-surface-card p-xl shadow-card">
        <IconDna className="h-12 w-12" />
        <p className="font-headline text-headline-lg text-error">404</p>
        <IconMagnifier className="h-12 w-12" />
      </div>

      <h1 className="font-headline text-headline-lg text-on-surface">
        Specimen Not Found
      </h1>
      <p className="font-body text-body-md text-on-surface-variant">
        The entity or route you are looking for does not exist in moLearn yet.
        Try again from search or browse the home catalog.
      </p>

      <div className="flex flex-wrap justify-center gap-md">
        <Link
          href="/search"
          className="rounded-md border border-outline-subtle bg-primary px-lg py-sm font-label text-label-md text-on-primary shadow-card-sm hover:bg-secondary hover:text-on-secondary"
        >
          ← Go to Search
        </Link>
        <Link
          href="/"
          className="rounded-md border border-outline-subtle bg-surface-card px-lg py-sm font-label text-label-md text-on-surface-card shadow-card-sm hover:bg-muted-green"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
