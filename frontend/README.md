# moLearn — Frontend (Fase 1)

moLearn mengubah data gen dan protein menjadi pengalaman belajar biologi
molekuler yang ramah pemula: pencarian entitas, profil yang mudah dibaca, dan
koleksi tersimpan lokal — tanpa akun.

Proyek ini adalah transkripsi frontend dari prototype HTML Google Stitch
("blueprint" desain) menjadi aplikasi modular, responsif, dan local-first.
Data protein diambil **live** dari UniProt melalui backend FastAPI (Slice 1);
mode demo dengan fixture lokal tersedia lewat `NEXT_PUBLIC_DEMO_MODE=true`.
Antarmuka berbahasa Inggris.

## Teknologi (STACK 2026)

| Lapisan            | Teknologi                                        |
| ------------------ | ------------------------------------------------ |
| Framework          | Next.js 16.2.6 (App Router, React Server Components) |
| UI                 | React 19.2.4 + TypeScript 5 (strict)            |
| Styling            | Tailwind CSS 4 (CSS-first via `@tailwindcss/postcss`, token di `@theme`) |
| Font               | Font lokal (tersimpan di `public/fonts/`, tanpa CDN) |
| State lokal        | `localStorage` + external store `useSyncExternalStore` |
| Integrasi backend  | **Slice 1** — protein UniProt via proxy Next.js (`BACKEND_API_URL`) + adapter `src/lib/api.ts` |
| Tunda (fase berikut) | Gen (NCBI), Cytoscape.js (graf relasi), TanStack Query + Zod |

## Menjalankan Proyek

Prasyarat: Node.js ≥ 20, dan backend FastAPI berjalan di `http://localhost:8000`.

```bash
npm install
cp .env.example .env.local   # isi BACKEND_API_URL + NEXT_PUBLIC_DEMO_MODE
npm run dev                  # http://localhost:3000
```

Layar dapat diuji di http://localhost:3000:

| Rute                         | Halaman                                   |
| ---------------------------- | ---------------------------------------- |
| `/`                          | Landing (search-first)                   |
| `/search?q=...`              | Hasil pencarian                          |
| `/entity/{type}/{id}`       | Profil entitas (protein live; gen "coming soon") |
| `/collection`                | Koleksi entitas saya (localStorage)      |
| `/glosarium`                 | Glosarium biologi                        |

Pemeriksaan kualitas:

```bash
npm run typecheck         # tsc --noEmit
npm run lint              # eslint
npm run build             # produksi
npm run test:regression   # Playwright: rute + responsif + integrasi (butuh server jalan)
npm start                 # jalankan build produksi
```

### Variabel Environment

| Variabel | Scope | Keterangan |
| --- | --- | --- |
| `BACKEND_API_URL` | Server-side only | Dibaca Route Handler `/api/backend/*`; tidak di-expose ke browser |
| `NEXT_PUBLIC_DEMO_MODE` | Client | `false` = backend live (default), `true` = fixture lokal (mode demo) |

### Mode Demo

Bila `NEXT_PUBLIC_DEMO_MODE=true`, aplikasi memakai fixture lokal dan menandai
hasilnya `isDemo: true` (banner + badge sumber "DEMO"). Default (`false`) memakai
backend live; bila backend gagal, UI menampilkan ErrorState eksplisit —
**tidak ada silent fallback** ke fixture.

## Struktur Direktori

```
src/
├── app/                     # Halaman Next.js (App Router)
│   ├── page.tsx             # Landing (search-first)
│   ├── search/              # page.tsx (server) + results-client.tsx (client)
│   ├── entity/[type]/[id]/ # Profil entitas (stub terstruktur)
│   ├── collection/          # Koleksi lokal
│   ├── glosarium/           # Glosarium istilah
│   ├── api/backend/[...path]/ # Proxy Route Handler → FastAPI
│   ├── error.tsx            # Error boundary global
│   └── not-found.tsx        # 404
├── components/            # Komponen UI terpecah (Navbar, kartu, ikon SVG pixel)
├── data/fixtures.ts       # Data demo lokal (entitas, glosarium, koleksi)
├── lib/
│   ├── api.ts               # Adapter API + resolveUrl + demo/live
│   ├── use-collection.ts    # External store localStorage
│   └── cn.ts                # Helper class name
├── types/molearn.ts       # Definisi tipe domain
└── app/globals.css        # Token Tailwind 4 (@theme) + efek pixel + @font-face
public/
├── fonts/                   # Font lokal
└── images/                  # Aset gambar
tests/
└── regression.mjs           # Regresi Playwright (rute + responsif + integrasi)
```

## Integrasi Frontend–Backend (Slice 1)

- Browser memanggil same-origin `/api/backend/*`; proxy meneruskan ke
  `BACKEND_API_URL` (server-side). Tidak ada CORS.
- Proxy: GET-only, endpoint whitelist (`/api/v1/health`, `/api/v1/search`,
  `/api/v1/entities/protein/*`), timeout 60s, status code diteruskan.
- Detail kontrak, mapping, dan hasil pengujian ada di `REPORT.md`.

## Perbaikan terhadap Blueprint

Blueprint Stitch memakai satu URL `?entity=p53` untuk semua kartu. Aplikasi
ini merutekan **setiap kartu ke profil entitasnya sendiri**:
`/entity/{type}/{id}`. Rute `HGNC:11998` (gen) berbeda dari `P04637`
(protein), sesuai PRD — gen ≠ protein adalah dua entitas terpisah.

Karena Next.js menyerahkan parameter dinamis masih ter-encode
(`HGNC%3A11998`), halaman profil mendecode-nya (helper `decodeParam`) agar
kedua bentuk URL — tersamaran dan terbaca — sama-sama berfungsi.

## Disklousur Penggunaan AI (WAJIB DIBACA)

Sesuai aturan **STACK 2026 — Technology and AI Usage** (poin 3–5 handbook):

- **Alat AI**: Asisten coding AI (Claude Code / model Anthropic, kelas
  Claude Sonnet) dipakai **bantu mengerjakan (scaffold), transkripsi
  blueprint ke Next.js modular, penulisan komponen, pembersihan lint,
  dan pembuatan script uji otomatis**.
- **Peran AI**: Alat bantu — bukan pengganti. AI menyusun kode dan menjelaskan
  keputusan teknis; tim **memahami, memverifikasi, menguji, dan menanggung
  kebenaran** setiap keluaran (termasuk hasil typecheck/lint/build dan
  pengujian navigasi/responsivitas yang tercatat di laporan).
- **Tanggung jawab**: Tim tetap bertanggung jawab penuh atas kebenaran,
  kualitas, dan pemahaman atas seluruh pekerjaan — termasuk bagian yang
  dihasilkan AI. Tidak ada outsource pengembalian materi inti ke pihak
  lain.

Disklousur ini diwajibkan handbook STACK 2026 dan dicantumkan juga di
laporan akhir tim.

## Catatan Data

- Data live berasal dari UniProt (protein), dengan atribusi sumber di UI.
- Mode demo memakai `src/data/fixtures.ts`: nama/simbol nyata (TP53, p53,
  insulin, dsb.), deskripsi sengaja disederhanakan untuk pemula.
- Tidak ada sekuens asam amino, DOI, atau klaim biologis yang dipalsukan;
  struktur 3D dan graf relasi menyusul di fase berikutnya.

## Batasan Fase 1

Slice 1 mencakup pencarian + profil protein UniProt, proxy server-side,
error handling, dan pagination cursor. Fitur lain (gen/NCBI, struktur 3D,
graf relasi Cytoscape.js, ligan, interaksi, sekuens, literatur/DOI, export,
dan AI Study Companion) menyusul di fase berikutnya.
