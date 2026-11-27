# MoLearn — Laporan Pengembangan

## 1. Ringkasan Proyek

MoLearn adalah platform edukasi biologi molekuler untuk mahasiswa Biologi, Biokimia, dan Bioinformatika. Platform ini mengubah data gen, protein, dan enzim menjadi pengalaman laboratorium pixel-art yang ramah pemula.

**Tech stack:**
- Frontend: Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- Backend: FastAPI, httpx, uv (Python)
- Desain: 80% antarmuka edukasi modern + 20% identitas pixel-art

## 2. Tujuan Fase 1

- Fondasi frontend (routing, komponen, state management)
- Integrasi backend slice 1 (UniProt protein search + profile)
- Proxy server-side untuk komunikasi frontend-backend
- Pengujian responsivitas dan integrasi end-to-end

## 3. Arsitektur Integrasi Frontend–Backend

```
Browser (same-origin)
  │
  ├── GET /search?q=P04637
  │     └─▶ Next.js Server Component
  │           └─▶ searchEntities() via resolveUrl()
  │                 ├─ Server: BACKEND_API_URL/api/v1/search?q=P04637
  │                 └─ Browser: /api/backend/api/v1/search?q=P04637
  │                       └─▶ Next.js Proxy Route Handler
  │                             └─▶ FastAPI :8000/api/v1/search
  │                                   └─▶ UniProt REST API
  │
  ├── GET /entity/protein/P04637
  │     └─▶ fetchEntityProfile() via resolveUrl()
  │           ├─ Server: BACKEND_API_URL/api/v1/entities/protein/P04637
  │           └─ Browser: /api/backend/api/v1/entities/protein/P04637
  │                 └─▶ Next.js Proxy → FastAPI :8000
  │
  └── Demo mode (NEXT_PUBLIC_DEMO_MODE=true)
        └─▶ Fixture lokal, label "DEMO" eksplisit
```

**Keputusan arsitektur:**
- Next.js server-side proxy (bukan direct browser→FastAPI)
- `BACKEND_API_URL`: server-side only (tidak di-expose ke browser)
- Same-origin requests dari browser (tidak ada CORS)
- Proxy dibatasi GET + endpoint whitelist
- Timeout: 60s (backend deadline 35s + safety margin)
- HTTP status code diteruskan apa adanya

## 4. Kontrak API (Slice 1)

### 4.1 Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/health` | Liveness check |
| GET | `/api/v1/search?q=&cursor=&page_size=` | Protein search |
| GET | `/api/v1/entities/protein/{accession}` | Full protein profile |

### 4.2 Search Response

```typescript
{
  query: string;
  match_mode: "exact_accession" | "name";
  results: Array<{
    entity_type: "protein";
    accession: string;           // e.g. "P04637"
    primary_name: string | null;
    synonyms: string[];
    gene_symbols: string[];
    organism: { scientific_name: string; taxonomy_id: number };
    reviewed: boolean;
    source: "uniprot";
    source_url: string;
    retrieved_at: string;
    status: "available";
  }>;
  next_cursor: string | null;    // Cursor-based pagination
  provider_status: "available" | "not_found";
}
```

### 4.3 Profile Response

```typescript
{
  entity_type: "protein";
  accession: string;
  primary_name: string | null;
  gene_symbols: string[];
  gene_crossrefs: Array<{ namespace: string; id: string }>;
  organism: { scientific_name: string; taxonomy_id: number };
  reviewed: boolean;
  source: "uniprot";
  source_url: string;
  length: number | null;
  function_annotations: string[];
}
```

### 4.4 Error Response

```json
{
  "status": "provider_error" | "not_found" | "bad_request",
  "detail": "error_description"
}
```

## 5. API Mapping (Backend → Frontend)

| Backend Field | Frontend Field | Transform |
|---------------|----------------|-----------|
| `accession` | `id` | Direct |
| `primary_name` | `name` | Fallback: `accession` |
| `gene_symbols[0]` | `symbol` | Optional |
| `organism.scientific_name` | `organism` | Direct |
| `synonyms + gene_symbols` | `aliases` | Merge arrays |
| `source` | `source` | Direct |
| `source_url` | `references.uniprotUrl` | Direct |
| `gene_crossrefs[HGNC]` | `relatedGeneId` | Find by namespace |
| `length` | (profile section) | Display in profile |
| `reviewed` | (badge) | Reviewed/unreviewed indicator |
| `function_annotations[0]` | `sections.fungsi` | First annotation |
| `entity_type` | `type` | Always "protein" (slice 1) |

## 6. File Changes

### 6.1 New Files

| File | Purpose |
|------|---------|
| `src/app/api/backend/[...path]/route.ts` | Next.js proxy route handler |
| `src/app/error.tsx` | Global error boundary (ErrorState + Try Again, tanpa fallback fixture) |
| `tests/regression.mjs` | Regresi Playwright dipertahankan di VCS (`npm run test:regression`, 73/73) |
| `.env.example` | Environment template (updated) |
| `.env.local` | Local dev config (gitignored) |

### 6.2 Modified Files

| File | Changes |
|------|---------|
| `src/lib/api.ts` | Complete rewrite: proxy + adapter, demo/live mode, error handling |
| `src/types/molearn.ts` | Added `next_cursor`, `provider_status` to `SearchResult` |
| `src/app/search/page.tsx` | Removed `type`/`organism` params, added `page_size` |
| `src/app/search/results-client.tsx` | Filter: All/Protein/Gene(disabled), removed organism filter |
| `src/app/entity/[type]/[id]/page.tsx` | Coming soon page for non-protein, live profile fetch |
| `frontend/.gitignore` | Added frontend ignores (node_modules, .next, .env.local, screenshots) |
| `frontend/.env.example` | Added `BACKEND_API_URL`, `NEXT_PUBLIC_DEMO_MODE` |

## 7. Environment Variables

```env
# Server-side only (Next.js proxy)
BACKEND_API_URL=http://localhost:8000

# Client-side flag
NEXT_PUBLIC_DEMO_MODE=false  # true = fixture, false = live backend
```

**Security:** `BACKEND_API_URL` tidak di-expose ke browser. Hanya dibaca oleh Route Handler di server.

## 8. Pengujian dan Penguasaan Mutu

Seluruh pengujian dilakukan oleh tim pada lingkungan
Node v24 / Windows / Chrome. Alat AI membantu penulisan script uji;
hasilnya **diverifikasi dan ditanggung tim**.

| Pengujian | Perintah / Metode | Hasil |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ exit 0 |
| Lint | `npm run lint` | ✅ exit 0 (0 errors, 0 warnings) |
| Build produksi | `npm run build` | ✅ exit 0 (halaman statis: `/`, `/collection`, `/glosarium`, `/_not-found`; dinamis: `/entity/[type]/[id]`, `/search`, `/api/backend/[...path]`) |
| Navigasi | Playwright headless (Chromium), 3 viewport × 15 rute = 45 cek | ✅ 45/45 lulus (200/404 sesuai ekspektasi), 0 overflow |
| Responsivitas | Playwright, viewport 1440×900, 768×1024, 390×844 | ✅ tanpa overflow; screenshot di `frontend/screenshots/` |
| Regresi (dipertahankan di VCS) | `npm run test:regression` (Playwright: 8 rute × 3 viewport × status/overflow/clipping + integrasi live) | ✅ 73/73 lulus; 0 horizontal overflow; 0 heading terpotong; 2 kartu protein live |
| Pagination | Playwright, `p53&page_size=2` | ✅ 17/17 lulus (append, dedup, reset, no-overflow) |
| Proxy health | `GET /api/backend/api/v1/health` | ✅ 200, `{"status":"ok"}` |
| Live search P04637 | `GET /search?q=P04637` | ✅ 200, "Cellular tumor antigen p53", TP53, UniProt |
| Live profile P04637 | `GET /entity/protein/P04637` | ✅ 200, gene_symbols TP53, reviewed |
| Gene coming soon | `GET /entity/gene/HGNC%3A11998` | ✅ 200, "Coming Soon" + CTA "Explore Proteins" |
| Name search p53 | `GET /search?q=p53&page_size=2` | ✅ 200, match_mode=name, next_cursor present |
| Empty search xyzzy | `GET /search?q=xyzzy` | ✅ 200, provider_status=not_found, empty results |
| Backend unavailable | Backend down → API gagal | ✅ ErrorState, bukan silent fallback |
| Demo mode | `NEXT_PUBLIC_DEMO_MODE=true` | ✅ Fixture data, label "DEMO" eksplisit |
| Cursor pagination (UI) | Playwright: "Load More" p53 `page_size=2` | ✅ 2 → 4 → 6 kartu, 0 duplikat, hasil lama dipertahankan |
| Cursor reset | Playwright: ganti query p53 → insulin | ✅ kembali ke halaman 1, hasil lama hilang |
| Cursor reset (tipe) | Playwright: klik filter Protein | ✅ daftar reset ke halaman 1 |
| Cursor habis | `next_cursor=null` | ✅ tombol "Load More" tidak dirender |
| Invalid accession | `/entity/protein/FAKE99` (format salah) | ✅ backend 422 → halaman "SPESIMEN TIDAK DITEMUKAN" |
| Accession valid tak ada | `/entity/protein/A0A0Z9` | ✅ backend 404 → halaman "SPESIMEN TIDAK DITEMUKAN" |
| Backend mati | uvicorn dimatikan, proxy diakses | ✅ proxy 502 `connection_error`; UI menampilkan "Unable to Load Data" + "Try Again"; **tidak ada fallback fixture** |

### 8.1 Hasil Audit Responsivitas (Playwright, 3 viewport, 15 rute, 45 cek)

**Device & viewport:**
- Desktop: 1440×900 (Chrome Headless)
- Tablet: 768×1024 (Chrome Headless)
- Mobile: 390×844 (Chrome Headless)

**Hasil:**
- Semua rute render dengan benar (200 atau 404 sesuai ekspektasi).
- 0 horizontal overflow terdeteksi di semua viewport.
- 36 screenshot disimpan di `frontend/screenshots/` (daftar utama):
  `desktop-landing`, `tablet-landing`, `mobile-landing`, `desktop-search-p04637`,
  `tablet-search-p04637`, `mobile-search-p04637`, `desktop-search-p53-name`,
  `tablet-search-p53-name`, `mobile-search-p53-name`, `desktop-search-carbonic`,
  `tablet-search-carbonic`, `mobile-search-carbonic`, `desktop-search-empty`,
  `tablet-search-empty`, `mobile-search-empty`, `desktop-entity-p04637`,
  `tablet-entity-p04637`, `mobile-entity-p04637`, `desktop-entity-p01308`,
  `tablet-entity-p01308`, `mobile-entity-p01308`, `desktop-entity-p00918`,
  `tablet-entity-p00918`, `mobile-entity-p00918`, `desktop-entity-gene-coming-soon`,
  `tablet-entity-gene-coming-soon`, `mobile-entity-gene-coming-soon`,
  `desktop-collection`, `tablet-collection`, `mobile-collection`,
  `desktop-glosarium`, `tablet-glosarium`, `mobile-glosarium`,
  `desktop-search-enzyme`, `tablet-search-enzyme`, `mobile-search-enzyme`.

Screenshot pagination & error state:
`desktop-pagination-loadmore`, `tablet-pagination-loadmore`,
`mobile-pagination-loadmore`, `desktop-backend-down`.

### 8.4 Cursor Pagination

**Kontrak backend:** `next_cursor` (opaque) dari UniProt Link header; cursor
harus dibuang saat `q` atau `page_size` berubah.

**Implementasi (`results-client.tsx`):**
- Tombol "Load More" hanya dirender bila `next_cursor` ada.
- Hasil baru **di-append**, bukan menggantikan; dedup berdasarkan `type-id`.
- Guard `loading` mencegah request bersamaan (klik ganda diabaikan).
- Reset saat query/page_size berubah lewat `key={q:page_size}` di `page.tsx`
  (komponen di-mount ulang); reset saat filter tipe berubah lewat `selectType()`.
- Error pagination ditampilkan inline; kartu yang sudah tampil **tidak dihapus**.
- Tombol disembunyikan saat `next_cursor=null` (halaman terakhir).

**Bukti (backend live, Playwright):**
```
p1 2 results   [P04637, O15350]
p2 4 results   [P04637, O15350, Q9Y6P5, A1A5B4]
p3 6 results   [P04637, O15350, Q9Y6P5, A1A5B4, O15151, Q13625]
```
0 duplikat di setiap langkah; query `p53` → `insulin` reset ke `[P01308, P06213]`.

### 8.2 Refinement UI Final (disetujui product owner)

Refinement terakhir menggantikan perbaikan parsial sebelumnya. Seluruh teks UI
kini berbahasa Inggris dan tata letak konsisten lintas halaman.

**Akar masalah container yang kolaps.** Tailwind CSS v4 memakai namespace
`--spacing-*` untuk utilitas `max-w-*` bila nama tersebut juga didefinisikan
sebagai token spasi. Design system mendefinisikan `--spacing-md/lg/xl/2xl/3xl`
(16/24/32/48/64px), sehingga `max-w-2xl` menjadi 48px dan `max-w-3xl` menjadi
64px — hero search mengecil, kolom judul sempit, teks terpotong. Perbaikan:
sembilan pemakaian `max-w-*` diganti lebar eksplisit (`max-w-[42rem]`,
`max-w-[48rem]`, `max-w-[36rem]`, `max-w-[32rem]`) yang imun terhadap tabrakan
namespace.

- **Homepage**: hero search-first (judul + deskripsi + search bar + saran
  kueri) → featured entities (4 kartu) → alur 3 langkah
  Discover/Understand/Connect → sumber data terpercaya. Diorama laboratorium
  pixel-art dan panel enam modul dihapus.
- **Model tipe**: `EntityType` = `gene | protein`; hormon/enzim menjadi badge
  kategori fungsional (bukan tipe entitas).
- **Bahasa**: seluruh string UI berbahasa Inggris (nav, footer, pencarian,
  profil, koleksi, glosarium, 404, error). Komentar kode tetap Bahasa
  Indonesia.
- **Tipografi**: `--font-headline`/`--font-display` → DM Sans; pixel font hanya
  untuk logo/aksen dekoratif.
- **Konsistensi**: `rounded-md`/`rounded-lg`, `shadow-card`, dan
  `border-outline-subtle` seragam di semua kartu.

### 8.3 Integrasi Frontend–Backend (Slice 1)

**Arsitektur:**
- Next.js Route Handler proxy (`/api/backend/[...path]`)
- Server-side only `BACKEND_API_URL`
- GET-only, endpoint whitelist
- Timeout 60s, status code forwarding

**Mapping respons backend → tipe frontend:**
- `accession` → `id`
- `primary_name` → `name` (fallback: accession)
- `gene_symbols[0]` → `symbol`
- `organism.scientific_name` → `organism`
- `synonyms + gene_symbols` → `aliases`
- `source_url` → `references.uniprotUrl`
- `gene_crossrefs[HGNC]` → `relatedGeneId`

**Mode:**
- Demo (`NEXT_PUBLIC_DEMO_MODE=true`): fixture lokal, badge "DEMO"
- Live (`NEXT_PUBLIC_DEMO_MODE=false`): panggil backend
- API gagal → ErrorState (tidak ada silent fallback)

## 9. Keterbatasan & Roadmap Fase Berikutnya

- **Data masih demo jika flag diaktifkan**: semua konten dapat berasal dari fixture lokal; badge
  "DEMO" wajib ditampilkan saat mode aktif.
- **Enam bagian eksplorasi entitas** (structure, ligan, interaksi,
  sekuens, literatur/DOI, export) masih berupa daftar modul di stub
  profil — konten menyusul bersama backend + Cytoscape.js +
  TanStack Query/Zod.
- **AI Study Companion** (PRD modul C) belum ada — memerlukan endpoint
  `POST /explain` di backend.
- **Cursor pagination** sudah berfungsi di UI; `next_cursor` bersifat
  opaque dan tidak disimpan di URL, sehingga refresh halaman mengembalikan
  pengguna ke halaman 1.
- **Koleksi belum sinkron antar-perangkat** (by design, sesuai PRD:
  penyimpanan lokal tanpa akun).
- **Backend slice 1 hanya protein UniProt**: gene/hormone/enzyme belum tersedia.

## 10. Kesiapan Slice 2 (NCBI Gene)

Frontend sudah siap menerima Slice 2 tanpa redesign besar:

- **Type filter**: All / Protein / Gene (disabled untuk Slice 1)
  - Mengaktifkan Gene cukup hapus `isDisabled` check
- **Entity profile page**: sudah ada halaman "Coming Soon" untuk non-protein
  - Saat Slice 2 live, ganti `fetchEntityProfile` untuk route `gene/*`
- **API adapter**: `fetchEntityProfile` sudah throw 404 untuk type non-protein
  - Perlu tambah handler untuk `/api/v1/entities/gene/{id}` saat endpoint tersedia
- **Error handling**: sudah distinguish 404 vs 422 vs 502/504
- **Pagination**: komponen sudah cursor-based; Slice 2 tinggal menyediakan
  `next_cursor` dengan field `gene_symbols`/`accession` yang sama
- **Proxy**: endpoint `/api/v1/entities/gene/...` dan `/api/v1/search`
  (sudah ada) perlu ditambahkan ke whitelist untuk path gene

**Yang tidak perlu diubah:**
- Proxy architecture (tambah endpoint ke whitelist)
- Error boundary global (`error.tsx`) — sudah menangani kegagalan fetch
- Type system (sudah ada `EntityType` untuk gene/protein)
- Kontrak pagination (cursor opaque, tidak bergantung pada tipe entitas)

## 11. Keamanan

### 11.1 Proxy Security

| Aspek | Implementasi |
|-------|-------------|
| Method restriction | GET only (POST/PUT/PATCH/DELASH → 405) |
| Endpoint whitelist | `/api/v1/health`, `/api/v1/search`, `/api/v1/entities/protein/*` |
| Timeout | 60s (AbortController) |
| Credentials | Tidak dikirim (`cache: "no-store"`, no cookies) |
| Status forwarding | Semua HTTP status diteruskan termasuk 422, 404 |
| Error body forwarding | JSON error `{"status","detail"}` diteruskan apa adanya |
| Backend URL | Server-side only (`BACKEND_API_URL` tidak di-expose) |

### 11.2 Secrets & Credentials

- ✅ Tidak ada API key di staged files
- ✅ `.env.local` di-`.gitignore`
- ✅ `BACKEND_API_URL` hanya dibaca di server
- ✅ Tidak ada credentials di codebase
- ✅ `.gitignore` mencakup `node_modules/`, `.next/`, `.env.local`, `.env.*.local`, `screenshots/`, `graphify-out/`

**Pemeriksaan otomatis:**
- **Semgrep** (`p/security-audit`, v1.187.0): 22 rules, 26 file → **0 findings**.
- **Gitleaks**: **tidak tersedia** di environment ini (bukan dependency yang
  boleh ditambahkan), sehingga **tidak ada hasil scan Gitleaks**. Yang
  dilakukan sebagai gantinya adalah **inspeksi manual**: pencarian pola
  (`api_key`, `secret`, `password`, `credential`, `ghp_`, `sk-`, `Bearer`,
  private key header) pada seluruh staged file. Hasil: 3 kecocokan, semuanya
  **false positive** yang sudah diverifikasi:
  1. `frontend/.env.example` — kata "secret" di komentar penjelas.
  2. `frontend/package-lock.json` — substring `sk-` pada nama paket.
  3. `frontend/public/images/mascot-molearn.png` — byte biner acak yang
     kebetulan cocok pola.
- Inspeksi manual **bukan pengganti** secret scanner; jalankan Gitleaks di CI
  sebelum merge bila tool tersedia.

### 11.3 Git Status

| Item | Status |
|------|--------|
| Branch | `feat/frontend-integration` |
| Base | `origin/master` (commit `be107df`) |
| Ahead of origin/master | 1 commit |
| Staged files | 45 files (frontend/ + .gitignore + REPORT.md) |
| Modified (unstaged) | 0 (semua sudah di-commit) |
| Backend repo | **Tidak diubah** (0 diff pada `backend/` dan `docs/`) |
| Node modules | ❌ Tidak di-staged |
| Build artifacts | ❌ Tidak di-staged |
| Secrets | ❌ Tidak di-staged |

## 12. Files Dimodifikasi

### Core Integration

- `src/lib/api.ts` — proxy URL resolution, backend adapter, demo/live mode, error handling
- `src/app/api/backend/[...path]/route.ts` — Next.js proxy route handler (BARU)
- `src/app/error.tsx` — global error boundary (BARU)
- `src/app/search/results-client.tsx` — cursor pagination ("Load More"), dedup, reset, filter All/Protein/Gene
- `src/types/molearn.ts` — tambah `next_cursor`, `provider_status` ke `SearchResult`
- `src/app/search/page.tsx` — hapus `type`/`organism` params, tambah `page_size`
- `src/app/search/results-client.tsx` — filter All/Protein/Gene(disabled), removed organism
- `src/app/entity/[type]/[id]/page.tsx` — coming soon page, live profile fetch

### Configuration

- `.env.example` — tambah `BACKEND_API_URL`, `NEXT_PUBLIC_DEMO_MODE`
- `.gitignore` — tambah frontend ignores
- `frontend/.gitignore` — ignore standar Next.js (dipakai; memuat `*.pem`, `.vercel`, `next-env.d.ts`)

## 13. Status Akhir Slice 1

- [x] Proxy server-side dengan allowlist endpoint
- [x] API adapter + mapping backend → tipe frontend
- [x] Protein search + protein profile (data live UniProt)
- [x] Cursor pagination ("Load More", dedup, guard konkurensi, reset)
- [x] Error boundary global (`error.tsx`) — tanpa fallback fixture
- [x] Halaman "not found" untuk 404 dan 422
- [x] Gene ditandai "coming soon"
- [x] Lint 0 error / 0 warning, typecheck bersih, build produksi sukses
- [x] Playwright: 45/45 regresi rute + 17/17 pagination
- [x] Semgrep 0 findings; inspeksi manual secret bersih
- [x] Graphify diperbarui (439 node, 831 edge, 19 komunitas; AST code-only,
      label komunitas placeholder — semantic labeling butuh kuota LLM)
- [x] Regresi dipertahankan di VCS: `frontend/tests/regression.mjs`
      (`npm run test:regression`) — 73/73 lulus
- [x] Commit `feat(frontend): complete MoLearn frontend and UniProt integration`
      di branch `feat/frontend-integration`
- [x] Push ke `origin/feat/frontend-integration` (tanpa merge ke master)

**Known issues:**
- Status HTTP halaman error adalah 500 (error boundary), bukan 502/504 —
  kode status asli tetap diteruskan oleh proxy dan tercatat di log server.
- `next_cursor` tidak persisten di URL; refresh mengembalikan ke halaman 1.

## 14. Disklousur Penggunaan AI (sesuai aturan STACK 2026)

- **Alat**: Asisten coding AI dari Anthropic (Claude Code; model kelas
  Claude Sonnet) digunakan untuk: scaffold proyek, transkripsi blueprint
  Stitch menjadi Next.js modular, penulisan komponen & CSS, pembuatan
  helper `decodeParam`, refactor store koleksi, perbaikan pemadanan
  alias, penulisan proxy Route Handler, API adapter mapping, penulisan
  script uji (Playwright headless).
- **Peran AI**: alat bantu — bukan penganti pemahaman tim. Setiap keluaran
  AI **dimahami, ditinjau, diuji ulang, dan kebenarannya ditanggung tim**.
- **Tanggung jawab tim**: verifikasi hasil typecheck/lint/build, pengujian
  navigasi & responsivitas, dan keseluruhan kualitas produk berada di
  pundak tim; tidak ada pengoutsourcingan materi inti kepada pihak lain
  (sesuai aturan Conduct handbook).
- Disklousur ini juga tercantum di `README.md` proyek, sesuai kewajiban
  handbook (AI material assistance wajib dinyatakan di README &
  proposal).

---
*Laporan ini dibuat dalam Bahasa Indonesia sesuai ketentuan tugas.*
