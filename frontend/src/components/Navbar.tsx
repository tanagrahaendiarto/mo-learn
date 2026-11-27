"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { PixelButtonLink } from "@/components/PixelButton";
import { IconClose, IconMenu, PixelLogo } from "@/components/icons";

/**
 * Navbar moLearn — shell navigasi global.
 * Mobile menu berfungsi (toggle + aria-expanded), sesuai requirement
 * "mobile nav toggle" fase 1. Link memakai DM Sans (bukan pixel font)
 * agar mudah dibaca; pixel identity cukup lewat logo.
 */

const NAV_LINKS = [
  { label: "Home", href: "/", key: "home" },
  { label: "Explore", href: "/search", key: "explore" },
  { label: "My Collection", href: "/collection", key: "collection" },
  { label: "Glossary", href: "/glosarium", key: "glossary" },
] as const;

function activeKey(pathname: string): (typeof NAV_LINKS)[number]["key"] | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/search")) return "explore";
  if (pathname.startsWith("/collection")) return "collection";
  if (pathname.startsWith("/glosarium")) return "glossary";
  return null;
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = activeKey(pathname);

  function linkClasses(key: (typeof NAV_LINKS)[number]["key"]) {
    return cn(
      "rounded-md px-sm py-xs font-label text-label-lg transition-colors duration-press",
      current === key
        ? "bg-primary/10 text-primary font-semibold"
        : "text-on-surface-variant hover:bg-surface-card hover:text-primary",
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-outline-subtle bg-surface/95 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-md px-md md:px-xl">
        <Link
          href="/"
          className="flex items-center gap-sm rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary"
        >
          <PixelLogo className="h-8 w-8 shrink-0" />
          <span className="font-pixel text-pixel-lg tracking-tight text-primary">
            moLearn
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-sm md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.key} href={link.href} className={linkClasses(link.key)}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-sm">
          <PixelButtonLink
            href="/search"
            size="sm"
            className="hidden sm:inline-flex"
          >
            Start Exploring
          </PixelButtonLink>

          <button
            type="button"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-md border border-outline-subtle bg-surface-card text-on-surface-card shadow-card-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary"
          >
            {open ? <IconClose className="h-5 w-5" /> : <IconMenu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menu seluler — berfungsi, bukan sekadar tampilan */}
      {open && (
        <div id="mobile-menu" className="md:hidden absolute top-16 left-0 right-0 z-50 border-b-2 border-outline-subtle bg-surface-card px-md py-md shadow-card">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-xs">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(linkClasses(link.key), "px-sm py-md")}
              >
                {link.label}
              </Link>
            ))}
            <PixelButtonLink
              href="/search"
              size="md"
              className="mt-sm"
              onClick={() => setOpen(false)}
            >
              Start Exploring
            </PixelButtonLink>
          </nav>
        </div>
      )}
    </header>
  );
}
