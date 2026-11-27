import Link from "next/link";
import { PixelLogo } from "@/components/icons";

/** Footer global moLearn — ringan, border halus, brand line tetap pixel. */
export function Footer() {
  return (
    <footer className="border-t border-outline-subtle bg-surface-card py-lg">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-md px-md md:flex-row md:items-center md:px-xl">
        <div className="flex flex-col gap-xs">
          <span className="flex items-center gap-sm">
            <PixelLogo className="h-6 w-6" />
            <span className="font-pixel text-pixel-md text-primary">
              moLearn
            </span>
          </span>
          <span className="font-body text-body-sm text-on-surface-variant">
            Complex Biology, Simple Experience — for Biology, Biochemistry
            &amp; Bioinformatics students.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-md font-label text-label-md text-on-surface-variant">
          <Link href="/search" className="hover:text-primary">
            Explore
          </Link>
          <Link href="/collection" className="hover:text-primary">
            My Collection
          </Link>
          <Link href="/glosarium" className="hover:text-primary">
            Glossary
          </Link>
        </div>
      </div>
    </footer>
  );
}
