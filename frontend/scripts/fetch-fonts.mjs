/**
 * Unduh woff2 (subset latin) dari Google Fonts ke public/fonts.
 *
 * Alasan: blueprint Stitch memakai CDN Tailwind + link Google Fonts.
 * Requirements fase 1: TIDAK ada Tailwind CDN, font harus lokal
 * (file di public/fonts, dimuat via @font-face di globals.css).
 *
 * Jalankan: npm run fetch-fonts   (perlu jaringan; hasil woff2 di-commit
 * sehingga build offline aman).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(HERE, "..", "public");

const SPEC =
  "family=DM+Sans:opsz,wght@9..40,400..700" +
  "&family=JetBrains+Mono:wght@400..600" +
  "&family=Pixelify+Sans:wght@500..700" +
  "&family=Space+Grotesk:wght@500..700" +
  "&display=swap";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const SLUGS = {
  "DM Sans": "dm-sans",
  "JetBrains Mono": "jetbrains-mono",
  "Pixelify Sans": "pixelify-sans",
  "Space Grotesk": "space-grotesk",
};

async function main() {
  const cssUrl = `https://fonts.googleapis.com/css2?${SPEC}`;
  const res = await fetch(cssUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} dari Google Fonts`);
  const css = await res.text();

  // Pecah per @font-face (dikelilingi komentar /* subset */); ambil
  // subset "latin" pertama per family.
  const blocks = [...css.matchAll(/\/\* (\w[\w-]*) \*\/\s*@font-face\s{([^}]*)}/g)];
  const picked = new Map(); // family -> { weight, url }
  for (const m of blocks) {
    const subset = m[1];
    const body = m[2];
    const family = /font-family:\s*'([^']+)'/.exec(body)?.[1];
    const weight = /font-weight:\s*([\d ]+)/.exec(body)?.[1]?.trim() ?? "400";
    const url = /url\(([^)]+)\)/.exec(body)?.[1];
    if (!family || !url || !SLUGS[family]) continue;
    if (subset === "latin" && !picked.has(family)) {
      picked.set(family, { weight, url });
    }
  }

  await mkdir(path.join(PUBLIC, "fonts"), { recursive: true });

  const out = [];
  for (const [family, info] of picked) {
    const slug = SLUGS[family];
    const dest = path.join(PUBLIC, "fonts", `${slug}.woff2`);
    const buf = Buffer.from(
      await (await fetch(info.url)).arrayBuffer(),
    );
    await writeFile(dest, buf);
    out.push({ family, file: `fonts/${slug}.woff2`, weight: info.weight, bytes: buf.length });
  }

  if (out.length !== 4) {
    console.error("Perlu menemukan 4 family, ketemu:", out.length, out);
    process.exit(1);
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error("Gagal mengunduh font:", err.message);
  process.exit(1);
});
