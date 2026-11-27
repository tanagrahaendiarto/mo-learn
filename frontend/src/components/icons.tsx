import type { SVGProps } from "react";

/**
 * Set ikon pixel-art moLearn (transkripsi dari blueprint Stitch).
 * Semua ikon digambar sebagai 16×16 SVG inline (viewBox 0 0 16 16)
 * sesuai design system: custom pixel SVG, bukan icon font generik.
 *
 * `currentColor` dipakai untuk warna default agar ikon mewarisi teks;
 * aksen warna tetap hardcoded sesuai blueprint saat diperlukan.
 */

export function PixelLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="6" y="1" width="4" height="4" fill="#244D38" stroke="#25322B" strokeWidth="1" />
      <rect x="1" y="10" width="4" height="4" fill="#79A85B" stroke="#25322B" strokeWidth="1" />
      <rect x="11" y="10" width="4" height="4" fill="#5398BE" stroke="#25322B" strokeWidth="1" />
      <rect x="7" y="5" width="2" height="3" fill="#25322B" />
      <rect x="4" y="8" width="3" height="2" fill="#25322B" />
      <rect x="9" y="8" width="3" height="2" fill="#25322B" />
      <rect x="6" y="7" width="4" height="4" fill="#EFC65B" stroke="#25322B" strokeWidth="1" />
    </svg>
  );
}

export function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="2" y="3" width="12" height="2" fill="currentColor" />
      <rect x="2" y="7" width="12" height="2" fill="currentColor" />
      <rect x="2" y="11" width="12" height="2" fill="currentColor" />
    </svg>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="2" y="2" width="3" height="2" fill="currentColor" />
      <rect x="11" y="2" width="3" height="2" fill="currentColor" />
      <rect x="3" y="5" width="2" height="2" fill="currentColor" />
      <rect x="11" y="5" width="2" height="2" fill="currentColor" />
      <rect x="5" y="7" width="6" height="2" fill="currentColor" />
      <rect x="3" y="9" width="2" height="2" fill="currentColor" />
      <rect x="11" y="9" width="2" height="2" fill="currentColor" />
      <rect x="2" y="12" width="3" height="2" fill="currentColor" />
      <rect x="11" y="12" width="3" height="2" fill="currentColor" />
    </svg>
  );
}

export function IconMagnifier(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="2" width="6" height="2" fill="currentColor" />
      <rect x="3" y="8" width="6" height="2" fill="currentColor" />
      <rect x="1" y="4" width="2" height="4" fill="currentColor" />
      <rect x="9" y="4" width="2" height="4" fill="currentColor" />
      <rect x="9" y="9" width="2" height="2" fill="#244D38" />
      <rect x="11" y="11" width="2" height="2" fill="#244D38" />
      <rect x="13" y="13" width="2" height="2" fill="currentColor" />
    </svg>
  );
}

export function IconDna(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="1" width="2" height="3" fill="#244D38" />
      <rect x="11" y="1" width="2" height="3" fill="#5398BE" />
      <rect x="5" y="3" width="6" height="2" fill="#EFC65B" />
      <rect x="5" y="5" width="2" height="2" fill="#244D38" />
      <rect x="9" y="5" width="2" height="2" fill="#5398BE" />
      <rect x="7" y="7" width="2" height="2" fill="#25322B" />
      <rect x="5" y="9" width="2" height="2" fill="#5398BE" />
      <rect x="9" y="9" width="2" height="2" fill="#244D38" />
      <rect x="5" y="11" width="6" height="2" fill="#79A85B" />
      <rect x="3" y="12" width="2" height="3" fill="#5398BE" />
      <rect x="11" y="12" width="2" height="3" fill="#244D38" />
    </svg>
  );
}

export function IconMicroscope(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="7" y="2" width="3" height="2" fill="#5398BE" stroke="#25322B" strokeWidth="1" />
      <rect x="6" y="4" width="3" height="4" fill="#244D38" stroke="#25322B" strokeWidth="1" />
      <rect x="9" y="6" width="3" height="5" fill="#79A85B" />
      <rect x="4" y="9" width="5" height="2" fill="#EFC65B" stroke="#25322B" strokeWidth="1" />
      <rect x="3" y="12" width="10" height="3" fill="#244D38" stroke="#25322B" strokeWidth="1" />
    </svg>
  );
}

export function IconFlask(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="6" y="1" width="4" height="2" fill="#25322B" />
      <rect x="6" y="3" width="4" height="3" fill="#FFFEF8" stroke="#25322B" strokeWidth="1" />
      <rect x="4" y="6" width="8" height="3" fill="#EFC65B" stroke="#25322B" strokeWidth="1" />
      <rect x="3" y="9" width="10" height="5" fill="#79A85B" stroke="#25322B" strokeWidth="1" />
      <rect x="5" y="10" width="2" height="2" fill="#FFFEF8" />
    </svg>
  );
}

export function IconCell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="2" width="10" height="12" fill="#DFE9D8" stroke="#25322B" strokeWidth="1" />
      <rect x="2" y="4" width="12" height="8" fill="#DFE9D8" stroke="#25322B" strokeWidth="1" />
      <rect x="6" y="6" width="4" height="4" fill="#5398BE" stroke="#25322B" strokeWidth="1" />
      <rect x="4" y="4" width="2" height="2" fill="#79A85B" />
      <rect x="10" y="10" width="2" height="2" fill="#EFC65B" />
    </svg>
  );
}

/** Ikon kartu ensiklopedia: DNA (TP53). */
export function IconDnaCard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="1" width="2" height="3" fill="#244D38" />
      <rect x="11" y="1" width="2" height="3" fill="#79A85B" />
      <rect x="5" y="3" width="6" height="2" fill="#EFC65B" />
      <rect x="7" y="6" width="2" height="4" fill="#25322B" />
      <rect x="5" y="11" width="6" height="2" fill="#79A85B" />
      <rect x="3" y="12" width="2" height="3" fill="#79A85B" />
      <rect x="11" y="12" width="2" height="3" fill="#244D38" />
    </svg>
  );
}

/** Ikon kartu ensiklopedia: protein. */
export function IconProteinCard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="5" y="2" width="6" height="4" fill="#5398BE" stroke="#25322B" strokeWidth="1" />
      <rect x="2" y="6" width="5" height="5" fill="#244D38" stroke="#25322B" strokeWidth="1" />
      <rect x="9" y="7" width="5" height="5" fill="#EFC65B" stroke="#25322B" strokeWidth="1" />
      <rect x="5" y="10" width="5" height="4" fill="#5398BE" stroke="#25322B" strokeWidth="1" />
    </svg>
  );
}

/** Ikon kartu ensiklopedia: hormon (rantai dua polipeptida insulin). */
export function IconHormoneCard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="2" y="4" width="12" height="3" fill="#5398BE" stroke="#25322B" strokeWidth="1" />
      <rect x="2" y="9" width="12" height="3" fill="#79A85B" stroke="#25322B" strokeWidth="1" />
      <rect x="4" y="7" width="2" height="2" fill="#EFC65B" />
      <rect x="10" y="7" width="2" height="2" fill="#EFC65B" />
    </svg>
  );
}

/** Ikon kartu ensiklopedia: enzim (botol lab mini). */
export function IconEnzymeCard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="6" y="1" width="4" height="2" fill="#25322B" />
      <rect x="6" y="3" width="4" height="3" fill="#FFFEF8" stroke="#25322B" strokeWidth="1" />
      <rect x="4" y="6" width="8" height="3" fill="#EFC65B" stroke="#25322B" strokeWidth="1" />
      <rect x="3" y="9" width="10" height="5" fill="#79A85B" stroke="#25322B" strokeWidth="1" />
    </svg>
  );
}

/** Ikon langkah 01 — Temukan (penggaris putih di header primary). */
export function IconSearchWhite(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="2" width="6" height="2" fill="#FFFFFF" />
      <rect x="3" y="8" width="6" height="2" fill="#FFFFFF" />
      <rect x="1" y="4" width="2" height="4" fill="#FFFFFF" />
      <rect x="9" y="4" width="2" height="4" fill="#FFFFFF" />
      <rect x="10" y="10" width="4" height="4" fill="#EFC65B" />
    </svg>
  );
}

/** Ikon langkah 02 — Pahami (dua halaman buku). */
export function IconBookWhite(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="2" y="2" width="5" height="12" fill="#FFFEF8" stroke="#25322B" strokeWidth="1" />
      <rect x="9" y="2" width="5" height="12" fill="#FFFEF8" stroke="#25322B" strokeWidth="1" />
      <rect x="7" y="3" width="2" height="10" fill="#25322B" />
    </svg>
  );
}

/** Ikon langkah 03 — Jelajahi (grafik relasi node). */
export function IconGraphWhite(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="6" y="2" width="4" height="4" fill="#FFFEF8" stroke="#25322B" strokeWidth="1" />
      <rect x="1" y="10" width="4" height="4" fill="#EFC65B" stroke="#25322B" strokeWidth="1" />
      <rect x="11" y="10" width="4" height="4" fill="#CEFFAC" stroke="#25322B" strokeWidth="1" />
      <rect x="7" y="6" width="2" height="4" fill="#25322B" />
    </svg>
  );
}

/** Ikon slot koleksi: DNA (item tipe Gene) — transkripsi blueprint halaman 4. */
export function IconCollectionGene(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="1" width="2" height="14" fill="#244D38" />
      <rect x="11" y="1" width="2" height="14" fill="#79A85B" />
      <rect x="5" y="4" width="6" height="2" fill="#EFC65B" />
      <rect x="5" y="10" width="6" height="2" fill="#EFC65B" />
    </svg>
  );
}

/** Ikon slot koleksi: protein (selain Gene) — transkripsi blueprint halaman 4. */
export function IconCollectionProtein(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="4" y="2" width="8" height="5" fill="#5398BE" stroke="#25322B" strokeWidth="1" />
      <rect x="2" y="7" width="6" height="6" fill="#244D38" stroke="#25322B" strokeWidth="1" />
      <rect x="8" y="8" width="6" height="5" fill="#EFC65B" stroke="#25322B" strokeWidth="1" />
    </svg>
  );
}

/** Ikon info (kotak "i") untuk catatan disambiguasi. */
export function IconInfo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <rect x="2" y="2" width="12" height="12" fill="#FFFEF8" stroke="#25322B" strokeWidth="1" />
      <rect x="7" y="4" width="2" height="2" fill="#106589" />
      <rect x="7" y="7" width="2" height="5" fill="#106589" />
    </svg>
  );
}
