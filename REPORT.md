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

## 15. Sprint Frontend Learning Exploration (Tasks A–G)

Branch: `feat/frontend-learning-exploration`, bercabang dari `master` @ `ae4e9fa`.
Lingkup: Collection, Profile, Glossary + bantuan, Relationship Explorer,
template Gene, modul eksplorasi, Study Companion. P0 dikerjakan lebih dulu.

### 15.1 Catatan kesenjangan dokumen

PRD v1.1 tidak ada di working tree (`docs/` tidak memuat berkas tersebut).
Implementasi mengikuti lingkup yang disetujui di percakapan + kontrak backend
Slice 1 yang sudah berjalan. Tidak ada persyaratan PRD yang ditambahkan atau
diklaim tanpa bukti. Bila PRD v1.1 tersedia, bagian ini perlu direkonsiliasi.

### 15.2 Prinsip integritas ilmiah yang diterapkan

| Aturan | Implementasi |
|---|---|
| Tidak mengarang lokalisasi/fungsi/sekuens/relasi | `mapProfile` hanya memetakan field backend; field `lokasi` karangan dihapus |
| Bedakan anotasi sumber vs penjelasan pemula | Bagian "In simple terms" memakai `summary` tervalidasi; bila kosong tampil pesan jujur, bukan teks buatan |
| Relasi hanya yang terbukti | Label selalu `cross-reference` + `source` + `evidence`; tidak disimpulkan dari kemiripan simbol |
| Tidak ada jawaban AI tiruan | Study Companion 100% nonaktif, tanpa API key, tanpa respons palsu |
| Provenance tidak ditebak | Record lama tanpa `source` tampil `Unknown source`, tidak pernah otomatis "Demo" |

### 15.3 Task A — Collection

- Identitas kanonik: `type + source namespace + id` (`collectionKey()`).
- `add()` menolak duplikat; `has()` dipakai untuk status tombol;
  `remove(type, source, id)` menghapus record yang tepat.
- `normalizeSource()` menyeragamkan string backend (`uniprot` → `UniProt`).
- Record legacy tanpa `source`: dipertahankan, ditandai
  `UNKNOWN_SOURCE_LABEL` ("Unknown source"), **tidak** dilabeli demo.
- Halaman koleksi kini menampilkan organism, identifier, `SourceBadge`,
  dan badge `Demo` hanya saat `isDemo === true`.

### 15.4 Task B — Profile protein

Struktur baru (menggantikan `profile.sections` berbahasa Indonesia):

1. Identitas + organism + source + status Reviewed/Unreviewed (dengan tooltip).
2. "In simple terms" — `summary` sumber atau pesan "belum tersedia".
3. "Biological function" — anotasi verbatim dari `function_annotations`.
4. "Source & evidence" — tautan `source_url`/UniProt.
5. "Advanced details" — length, taxonomy ID, review status.
6. "Related entities" — Relationship Explorer.
7. "Exploration modules" — status jujur per modul.
8. "Save to Collection" — tombol toggle `aria-pressed`.
9. "Study Companion" — antarmuka kontekstual, ditandai Unavailable.

`EntityProfile.sections` dihapus dari tipe; halaman tidak lagi memakai field
Indonesia. `mapProfile` tidak lagi menghasilkan `lokasi` ("Cytoplasm, nucleus,
or membrane") yang tidak berasal dari backend.

### 15.5 Task C — Glossary + bantuan kontekstual

`HelpTooltip` baru: tombol `?` dengan `aria-describedby`, tooltip
`role="tooltip"` tampil saat hover **dan** focus-within (jalur keyboard),
tanpa JavaScript tambahan. Dipasang pada istilah glosarium dan pada
Reviewed/Unreviewed di profil.

Istilah glosarium ditambah: Hormone, GeneID, Organism, Taxonomy ID, Amino acid,
Reviewed entry, Unreviewed entry, Cross-reference, Gene–protein relationship,
Biological sequence, Experimental structure, Predicted structure.

### 15.6 Task D — Relationship Explorer

- Model data `RelationshipNode`/`RelationshipEdge`/`RelationshipGraph`
  **independen dari visualisasi**.
- `buildCrossrefGraph()` membangun graf dari `gene_crossrefs` backend;
  label `cross-reference`, sumber namespace, dan evidence eksplisit.
- Visualisasi: SVG ringan (lingkaran + garis + label), bukan Cytoscape.js —
  dependensi tidak terpasang dan interaksi yang dibutuhkan minimal.
- **Fallback aksesibel**: daftar relasi selalu dirender; setiap node adalah
  tautan profil, sehingga seluruh informasi dapat diakses tanpa SVG/pointer.
- Node terpilih menampilkan nama, identifier, organism, dan penanda demo.

### 15.7 Task E — Template Gene

`GeneProfile` adalah komponen template yang dapat dipakai ulang untuk
integrasi NCBI Gene (Slice 2): identitas, About, Gene function, Related
proteins, Sinonim, lokasi kromosomal, Source & evidence. Field yang tidak
tersedia menampilkan "not available yet".

- Mode demo: `/entity/gene/HGNC%3A11998` merender template dengan badge `Demo`.
- Mode live: tetap "Coming Soon" — tidak ada endpoint gene, jadi tidak ada
  data yang dikarang.

### 15.8 Task F — Modul eksplorasi

`ExplorationModules` mendukung lima status jujur: `available`, `loading`,
`empty`, `unavailable`, `provider-error`.

| Modul | Status | Dasar |
|---|---|---|
| Sequence | `available` bila `length` ada (hanya metadata panjang; sekuens penuh tidak dimuat) | field backend |
| Export CSV | `available` | data ternormalisasi entitas |
| Structure, ligands, interactions, literature | `unavailable` | belum ada sumber data |

Export CSV memakai `src/lib/csv.ts`: escape RFC-4180 (kutip ganda, koma,
CRLF) dan **atribusi sumber wajib** ditampilkan di kartu sebelum unduh.
Tidak ada modul yang menampilkan data contoh sebagai data nyata.

### 15.9 Task G — Study Companion

Komponen antarmuka kontekstual: konteks entitas, pertanyaan saran, area
input, area respons, dan area sitasi — semuanya `disabled` dan ditandai
`Unavailable`. Tidak ada LLM, tidak ada kunci API di kode, tidak ada jawaban
tiruan. Siap dihubungkan ke endpoint server-side pada Slice 2.

### 15.10 Pengujian

| Pengujian | Perintah | Hasil |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ exit 0 |
| Lint | `npm run lint` | ✅ No issues found |
| Build produksi | `npm run build` | ✅ exit 0 (6 rute statis/dinamis seperti sebelumnya) |
| Regresi lama | `npm run test:regression` | ✅ 73/73 lulus |
| Regresi learning (live) | `npm run test:learning` (backend live) | ✅ seluruh cek lulus |
| Regresi learning (demo) | `LEARNING_DEMO=true` terhadap server demo | ✅ seluruh cek lulus |
| Semgrep | `semgrep --config p/security-audit` | ✅ 22 rules, 0 findings |
| Responsif | Playwright 1440×900 / 768×1024 / 390×844 | ✅ 0 overflow, 0 heading terpotong |
| Screenshot | `npm run capture:screenshots` | ✅ 18 live + 18 demo di `frontend/screenshots/` |

Cakupan skrip baru `tests/learning-exploration.mjs`:

- Collection: simpan, persist setelah reload, tepat satu record (dedup),
  tampilan identifier/organism/source, navigasi ke profil, hapus.
- Record legacy: dipertahankan, `Unknown source`, **tidak** dilabeli Demo.
- Profil: sembilan bagian ada; tidak ada lokalisasi karangan.
- Relationship: label, evidence, daftar aksesibel, detail node terpilih.
- Modul: status `Unavailable` tampil, tombol `Download CSV` tersedia.
- Glosarium: 16 istilah wajib.
- Gene: template demo lengkap + tautan protein; live tetap "Coming Soon".
- Responsif: 3 viewport × 4 rute.

### 15.11 Batasan yang tetap berlaku

- Sequence module hanya metadata panjang; sekuens penuh belum dimuat.
- Structure/ligands/interactions/literature tetap `unavailable` sampai ada
  sumber data tervalidasi.
- Template Gene belum tersambung ke backend; hanya dipakai di mode demo.
- Study Companion belum berfungsi tanpa endpoint server-side.
- Cytoscape.js tidak dipakai; SVG cukup untuk graf kecil dan menjaga
  dependensi tetap minimal. Model data siap bila nanti diperlukan.
- Graphify diperbarui (`508 nodes, 1036 edges, 17 communities`); pelabelan
  komunitas semantik tetap butuh kuota LLM.

### 15.12 Status git

| Item | Status |
|---|---|
| Branch | `feat/frontend-learning-exploration` |
| Base | `master` @ `ae4e9fa` |
| Commit/push | **Belum** — menunggu persetujuan |
| Modified | 7 file frontend |
| New | 11 komponen/lib + 2 skrip uji |
| `backend/` dan `docs/` | 0 perubahan |

### 15.13 Tindak lanjut UAT (presentasi konten profil)

Perbaikan terarah pada profil protein, tanpa redesign halaman lain:

- **Judul utama = nama protein**; simbol gen ditampilkan terpisah dengan
  label `Gene symbol` agar identitas gen dan protein tidak tertukar.
  Metadata `<title>` memakai `Nama (SIMBOL)`.
- **Anotasi UniProt panjang** dipindah ke `<details>` "Original scientific
  annotation" (native, keyboard-accessible) beserta jumlah catatan/referensi.
- **Sitasi PubMed** diekstrak dari paragraf oleh `src/lib/citations.ts`
  menjadi daftar tautan `PubMed <id>` ke
  `https://pubmed.ncbi.nlm.nih.gov/<id>/`. Teks anotasi tetap verbatim
  selain pemindahan penanda sitasi; provenance ditulis eksplisit
  ("Unedited text from UniProt").
- **`ExplanationPanel`** baru = tata letak reusable untuk penjelasan pemula
  + "Key biological functions". Keduanya hanya terisi data tervalidasi;
  saat kosong tampil status jujur, tanpa ringkasan buatan.
- **`Homo sapiens` dicetak miring** (`<em>`) di profil protein dan template
  gen.
- Desain, koleksi, integrasi API, dan layout responsif tidak berubah.

Regresi: typecheck 0, lint 0, build 0; `tests/learning-exploration.mjs`
diperluas (h1 = nama protein, simbol gen terpisah, organisme italic,
prosa anotasi utuh, tanpa `PubMed:` inline, 18 tautan PubMed valid,
`<details>` + provenance). Hasil live 73/73; regresi lama 73/73.
Screenshot UAT: `uat-profile-desktop`, `uat-profile-annotations`,
`uat-profile-mobile`.

**Status UAT:** disetujui. Tidak ada perubahan UI lanjutan setelah persetujuan;
sisa batasan tercatat di §15.11.

---

## 16. Sprint Frontend Slice 2 — NCBI Gene + Unified Search

### 16.1 Basis dan status

| Item | Nilai |
|---|---|
| Branch kerja | `feat/frontend-slice2-integration` |
| Base frontend | `dc61d41` (PR #3, Frontend Learning & Exploration) |
| Backend | merge lokal `origin/feat/backend-slice2` (`d75ef24`) → commit merge `5b0146b` |
| Versi backend | `0.2.0` (`/api/v1/health`) |
| Push / PR | **Belum** — menunggu persetujuan |
| Backend source | 0 perubahan setelah merge |
| Dokumen kontrak acuan | `docs/SLICE2-CONTRACT-FINAL.md`, `docs/HANDOFF-slice2.md`, `docs/FRONTEND-PATCH-slice2.md`, `backend/app/schemas.py`, `/openapi.json` dari branch |

Kontrak diverifikasi dari source branch (bukan dokumen perencanaan lama):
`/openapi.json` melaporkan `version 0.2.0`, 4 path, dan parameter
`q`, `entity_type`, `cursor`, `page_size`.

### 16.2 Kontrak API Slice 2 (terpasang)

| Method | Path | Catatan |
|---|---|---|
| GET | `/api/v1/health` | `version: "0.2.0"` |
| GET | `/api/v1/search` | `entity_type=all\|gene\|protein` (default `all`), `page_size` 1–100 (default 10), cursor opaque |
| GET | `/api/v1/entities/protein/{accession}` | UniProt; bentuk Slice 1 dipertahankan |
| GET | `/api/v1/entities/gene/{gene_id}` | GeneID numerik positif (maks. 12 digit); selain itu 422; tidak ada → 404 `gene_not_found` |

`SearchResponse`: `query`, `match_mode` (`exact_accession` \|
`exact_geneid` \| `name`), `results` (union protein/gene), `next_cursor`,
`provider_status` (`available` \| `not_found` \| `partial` \| `error`),
`providers[]` (`name`, `status`, `detail`, `count`).

`GeneProfile` menambah `description`, `chromosome`, `gene_type`
(ketiganya nullable), `cross_references`, `related_proteins` (nama saja),
dan `protein_links[]` (`accession`, `primary_name`, `gene_symbols`,
`reviewed`, `source`, `source_url`, `evidence="uniprot_geneid_crossref"`).

### 16.3 Pemetaan backend → frontend

| Backend | Frontend | Transformasi |
|---|---|---|
| `entity_type` | `type` | Discriminated union `gene` \| `protein`; tidak ada `entity_type="protein"` hardcoded |
| `accession` | `id` | GeneID untuk gen, accession UniProt untuk protein |
| `primary_name` | `name` / `symbol` | Fallback ke accession |
| `organism.scientific_name` | `organism` | `"Unknown"` bila null |
| `organism.taxonomy_id` | `taxonomyId` | Direct |
| `source` | `source` | `uniprot` → UniProt, `ncbi_gene` → NCBI Gene, lainnya → Unknown |
| `source_url` | `sourceUrl` | Direct |
| `retrieved_at` | `retrievedAt` | Direct |
| `synonyms` + `gene_symbols` | `aliases` | Merge + dedup |
| `reviewed` | `reviewed` | Protein saja |
| `length` | `length` | Protein saja |
| `function_annotations` | `functionAnnotations` | Protein, verbatim |
| `gene_crossrefs[GeneID]` | `relatedGeneId` | Hanya namespace `GeneID` numerik |
| `description` | `description` | Teks NCBI verbatim; bukan ringkasan pemula |
| `cross_references` | `crossReferences` | Direct |
| `related_proteins` | `relatedProteins` | Nama saja, tidak dijadikan tautan |
| `protein_links` | `proteinLinks` | Hanya link ber-evidence `uniprot_geneid_crossref` |
| `provider_status` / `providers` | `provider_status` / `providers` | `partial` = peringatan, bukan error |
| `match_mode` | `matchMode` | `exact_geneid` ditambahkan |

Tidak ada field yang dikarang: `summary` (penjelasan pemula tervalidasi)
tetap kosong untuk gen dan protein karena belum ada sumber tervalidasi.

### 16.4 Perilaku yang diterapkan

1. **Proxy** (`src/app/api/backend/[...path]/route.ts`) — allowlist persis:
   `/api/v1/health`, `/api/v1/search`,
   `/api/v1/entities/protein/{accession UniProt}`,
   `/api/v1/entities/gene/{1–12 digit, nilai > 0}`. Regex disalin dari
   kontrak backend (`is_accession`, `_GENEID_RE`). Path lain 404, non-GET 405,
   timeout 60 s, status/body upstream diteruskan apa adanya.
2. **Unified search** — filter dijalankan di server lewat `entity_type`.
   `?type=Gene` dan `?entity_type=gene` sama-sama didukung. Cursor dibuang
   saat `q`, tipe, atau `page_size` berubah (komponen di-remount lewat `key`).
   Request memakai `AbortController` + penanda generasi; respons lama
   diabaikan. Duplikat dibuang berdasarkan `type + source + id`.
3. **Status penyedia** — `partial` menampilkan peringatan bernama penyedia
   yang gagal; hasil penyedia sehat tetap tampil. Empty-after-failure
   dibedakan dari "tidak ada entitas". Kegagalan total menampilkan
   `ErrorState`, tanpa fallback fixture.
4. **Routing identifier** — `7157` selalu lookup GeneID persis; `P04637`
   selalu lookup accession persis. Filter yang tidak cocok menampilkan pesan
   "excluded by filter", bukan pencarian nama.
5. **Profil gen** — Coming Soon dihapus. Halaman `/entity/gene/7157`
   memuat data NCBI live dan memakai ulang `GeneProfile`,
   `ExplanationPanel`, `ScientificAnnotation`, `SourceBadge`,
   `SaveToCollection`, Advanced Details, modul eksplorasi, dan Study
   Companion. Field null tampil "not available from NCBI Gene".
6. **Relasi tervalidasi** — gen→protein hanya dari `protein_links`
   (evidence `uniprot_geneid_crossref`); protein→gen hanya dari
   cross-reference namespace `GeneID`. Kecocokan simbol tidak pernah dipakai.
   Label selalu "GeneID cross-reference". HGNC ditampilkan sebagai
   provenance, bukan rute gen.
7. **Koleksi** — identitas kanonik = `type + source + id`. Migrasi hanya
   untuk pemetaan terverifikasi `HGNC:11998 → 7157` (didukung cross-reference
   NCBI Gene 7157 dan UniProt P04637); provenance disimpan sebagai
   `legacyId` dan ditampilkan "Migrated from HGNC:11998". Record tanpa
   pemetaan terverifikasi dipertahankan apa adanya.
8. **Pesan batasan** — "Gene name search currently covers human genes only
   (NCBI taxid 9606). Exact GeneID lookup is not restricted." hanya muncul
   pada filter All/Gene, bukan pada filter Protein.

### 16.5 File yang diubah

| File | Perubahan |
|---|---|
| `frontend/src/types/molearn.ts` | Discriminated union `GeneEntityProfile` / `ProteinEntityProfile`, `ProviderStatus`, `ProteinLink`, `EntityCrossReference`, `legacyId` |
| `frontend/src/lib/api.ts` | Adapter union, mapping semua field Slice 2, `exact_geneid`, `providers`, kode error NCBI, validasi GeneID, `AbortSignal` |
| `frontend/src/app/api/backend/[...path]/route.ts` | Allowlist regex persis kontrak; 404/405; timeout 60 s |
| `frontend/src/app/search/page.tsx` | Filter tipe dari URL, `page_size`, cursor diteruskan; remount `key` |
| `frontend/src/app/search/results-client.tsx` | Filter server, reset cursor, guard respons basi, dedup, status penyedia, empty state kontekstual, catatan human-only |
| `frontend/src/app/entity/[type]/[id]/page.tsx` | Cabang gen live, profil protein dipecah, Advanced Details + Source & evidence, 404/422 |
| `frontend/src/components/GeneProfile.tsx` | Profil gen NCBI live (bukan template demo) |
| `frontend/src/lib/relationships.ts` | Graf hanya dari `protein_links` / `GeneID` cross-reference |
| `frontend/src/components/RelationshipExplorer.tsx` | Label node accession untuk isoform; label edge tidak ditumpuk saat relasi banyak |
| `frontend/src/lib/use-collection.ts` | Migrasi legacy terverifikasi + dedup |
| `frontend/src/app/collection/page.tsx` | Menampilkan provenance migrasi |
| `frontend/src/data/fixtures.ts` | Identitas gen demo → GeneID kanonik (`7157`, `22059`) |
| `frontend/tests/regression.mjs` | Rute gen live, cek filter Gene server-side |
| `frontend/tests/learning-exploration.mjs` | Profil gen live + koleksi gen/protein terpisah |
| `frontend/tests/capture-screenshots.mjs` | Rute `/entity/gene/7157` |
| `frontend/tests/slice2-integration.mjs` | **Baru** — suite Slice 2 (live + simulated) |
| `frontend/tests/stub-backend.mjs` | **Baru** — backend simulasi untuk skenario gagal |

### 16.6 Hasil pengujian aktual

Lingkungan: Windows, Node v24, Chromium headless, backend lokal
`127.0.0.1:8000` versi `0.2.0`, frontend produksi `localhost:3000`.
Skenario kegagalan memakai stack terpisah `localhost:3001` +
`tests/stub-backend.mjs` (SIMULATED, bukan penyedia nyata).

| Pengujian | Perintah | Hasil |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ exit 0 |
| Lint | `npm run lint` | ✅ exit 0 |
| Build produksi | `npm run build` | ✅ exit 0 |
| Regresi rute + layout | `node tests/regression.mjs` | ✅ **75/75** (8 rute × 3 viewport + cek live) |
| Learning & Exploration | `node tests/learning-exploration.mjs` | ✅ **97/97** |
| Learning & Exploration (demo) | build `NEXT_PUBLIC_DEMO_MODE=true`, `LEARNING_DEMO=true` | ✅ **93/93** |
| Slice 2 integration | `SIM_BASE_URL=http://localhost:3001 node tests/slice2-integration.mjs` | ✅ **40/40** (33 live + 7 SIMULATED) |
| Health via proxy | `GET /api/backend/api/v1/health` | ✅ `{"status":"ok","version":"0.2.0"}` |
| TP53 All | `/search?q=TP53` | ✅ protein + gen, 4 hasil |
| TP53 Gene / Protein | `?entity_type=gene` / `protein` | ✅ hanya tipe yang diminta |
| Exact GeneID | `?q=7157` | ✅ `match_mode=exact_geneid`, hanya gen 7157 |
| GeneID + filter Protein | `?q=7157&entity_type=protein` | ✅ `not_found`, pesan "GeneID Excluded by Filter" |
| Exact accession | `?q=P04637` | ✅ `match_mode=exact_accession`, hanya protein P04637 |
| Accession + filter Gene | `?q=P04637&entity_type=gene` | ✅ `not_found`, pesan "Protein Accession Excluded by Filter" |
| Profil gen live | `/entity/gene/7157` | ✅ TP53, 17p13.1, protein-coding, taxid 9606, 7 protein_links, tanpa "Coming Soon" |
| Relasi gen→protein | `/entity/gene/7157` | ✅ tautan `/entity/protein/P04637`, label "GeneID cross-reference" |
| Relasi protein→gen | `/entity/protein/P04637` | ✅ tautan `/entity/gene/7157` |
| GeneID invalid | `/entity/gene/abc`, `/entity/gene/0` | ✅ 404 |
| GeneID tidak ada | `/entity/gene/999999999` | ✅ 404 |
| Pagination | `?q=TP53&page_size=2` + "Load More" | ✅ jumlah kartu bertambah, tanpa duplikat |
| Koleksi gen + protein | simpan 7157 dan P04637 | ✅ 2 record terpisah, persist setelah reload |
| Migrasi legacy | record `HGNC:11998` | ✅ menjadi 7157, tampil "Migrated from HGNC:11998" |
| Legacy tak terpetakan | record `HGNC:99999` | ✅ dipertahankan, tidak dihapus |
| Partial provider (SIMULATED) | stub `provider_status=partial` | ✅ peringatan "Some providers did not respond", hasil sehat tetap tampil |
| Empty-after-failure (SIMULATED) | stub `partial` tanpa hasil | ✅ "No Results From Available Providers" |
| Backend mati (SIMULATED) | stub memutus koneksi | ✅ HTTP 500 + "Unable to Load Data"; tidak ada fixture pengganti |

Catatan rate limit: NCBI membatasi 3 request/detik. Pengujian live berjalan
berurutan tanpa burst; bila 429 terjadi, backend memetakannya ke
`rate_limited_by_ncbi` dan UI menampilkan peringatan penyedia. Pada run final
tidak ada 429.

### 16.7 Bukti screenshot

Diambil dari build produksi dengan data live
(`frontend/screenshots/slice2-live-*.png`), 3 viewport
(1440×900, 768×1024, 390×844):

- `slice2-live-landing-{desktop,tablet,mobile}.png`
- `slice2-live-search-p53-{desktop,tablet,mobile}.png`
- `slice2-live-gene-profile-{desktop,tablet,mobile}.png`
- `slice2-live-protein-profile-{desktop,tablet,mobile}.png`
- `slice2-live-collection-{desktop,tablet,mobile}.png`
- `slice2-live-glossary-{desktop,tablet,mobile}.png`

Hasil inspeksi visual: tidak ada overflow horizontal; filter tipe dan catatan
human-only terbaca penuh; kartu gen dan protein terbedakan lewat badge,
identitas (GeneID vs accession), organisme, dan sumber; peta relasi tidak
menumpuk label; layout mobile menumpuk satu kolom.

### 16.8 Keterbatasan yang tetap berlaku

- Pencarian nama gen hanya mencakup `Homo sapiens` (taxid 9606). Lookup
  GeneID persis tidak dibatasi organisme, dan UI menyatakan hal ini.
- Belum ada filter organisme pada pencarian.
- Relasi hanya cross-reference GeneID UniProt. Tidak ada STRING, PPI, atau
  relasi pihak ketiga.
- `related_proteins` NCBI hanya nama tanpa accession, sehingga tidak dapat
  dinavigasi; UI menyatakannya.
- Deskripsi gen adalah teks mentah NCBI, bukan penjelasan pemula tervalidasi.
- Modul Structure, Ligand, Protein Interaction, Scientific Literature, dan
  Study Companion tetap `unavailable`.
- Belum ada database, autentikasi, cloud sync, atau cache. Koleksi hanya
  `localStorage`.
- Batas waktu backend bersifat soft deadline; parser RFC `Link` lengkap belum
  ada (cursor opaque dipakai apa adanya).

### 16.9 Sisa kebutuhan MVP

1. Filter organisme dan pencarian nama lintas organisme (butuh dukungan
   provider).
2. Sumber relasi tambahan (mis. STRING/PDB) dengan label evidence masing
   masing; jangan menurunkan bukti menjadi tebakan simbol.
3. Ringkasan pemula tervalidasi untuk gen/protein (kurasi atau pipeline
   tervalidasi, bukan generasi bebas).
4. Modul struktur, ligan, interaksi, dan literatur ilmiah.
5. Akun, penyimpanan koleksi di server, dan ekspor koleksi penuh.
6. Parser RFC `Link` penuh bila backend beralih dari cursor opaque.

### 16.10 Status git Slice 2

| Item | Status |
|---|---|
| Branch | `feat/frontend-slice2-integration` |
| Commit merge backend | `5b0146b` (lokal, disetujui) |
| Commit implementasi frontend | **Belum** — menunggu persetujuan |
| Push / PR | **Belum** |
| Backend source | 0 perubahan |
| Graphify | diperbarui setelah perubahan ini (`graphify update .`) |

---

*Laporan ini dibuat dalam Bahasa Indonesia sesuai ketentuan tugas.*

## 17. Slice 3 — AI Learning

- **Branch:** `feat/fullstack-slice3-ai`, dari merge Slice 2 `0ec41cf`.
- **Fitur:** Penjelasan pemula dan tanya jawab untuk GeneID NCBI dan accession
  UniProtKB. Kedua panel meminta generasi hanya saat pengguna menekan tombol.
  Profil, anotasi asli, dan relasi Slice 2 tetap tersedia tanpa AI.
- **Kontrak:** `POST /api/v1/ai/explain` dan `POST /api/v1/ai/ask`. Next.js hanya
  meneruskan dua rute POST ini. FastAPI mengambil konteks sendiri, memvalidasi
  bentuk keluaran dan ID sitasi per klaim, lalu mengembalikan URL sumber resmi.
- **Kontrol penggunaan:** DeepSeek Flash non-thinking; batas ukuran, token, waktu,
  laju, dan konkurensi. AI nonaktif secara default. Mode peninjau memerlukan kode
  akses terpisah. Kuota proses hilang saat restart dan tidak dianggap sebagai
  batas pengeluaran global yang persisten.
- **Reproduksibilitas:** Versi aplikasi dan paket `0.3.0`. `backend/uv.lock`
  disertakan; pembaruan lockfile hanya mengubah versi paket MoLearn.
- **Dokumentasi:** [API dan runbook](docs/SLICE3-AI.md),
  [README backend](backend/README.md), dan [checkpoint](docs/PROJECT-CHECKPOINT.md).

### 17.1 Bukti pengujian

| Pemeriksaan | Hasil |
|---|---|
| Regresi backend offline | PASS — 123/123, termasuk 18 tes AI dengan transport model simulasi |
| API backend live | PASS — 18/18 terhadap NCBI dan UniProtKB |
| Lint, TypeScript, build produksi frontend | PASS |
| Playwright regresi rute dan tata letak | PASS — 75/75, termasuk pencarian live |
| Playwright learning/exploration | PASS — 97/97 dengan sumber live |
| Playwright Slice 2 | PASS — 40/40 (33 live, 7 simulasi), termasuk kegagalan provider parsial |
| Playwright Slice 3 | PASS — 34/34; Next.js dan FastAPI nyata, data rekaman sumber dan model simulasi |
| Semgrep `p/default` | PASS — 0 temuan pada 32 target |
| `uv lock --check --offline` | PASS |
| Konektivitas DeepSeek | PASS — `/models` menjawab HTTP 401 tanpa kredensial |
| DeepSeek dengan API key aplikasi | FAIL milestone — 3/4 kasus live lulus; jawaban kontekstual p53 ditahan validator |

**Spot-check ilmiah simulasi.** Anotasi UniProtKB `P04637` mendukung ikatan
DNA dan regulasi transkripsi. Entri tersebut mencantumkan `Homo sapiens`
(9606) dan cross-reference GeneID `7157`. Ringkasan NCBI Gene `7157`
menyatakan bahwa TP53 mengode protein dengan domain pengikatan DNA dan
aktivasi transkripsi. Pemeriksaan ini membandingkan contoh keluaran mock
dengan rekaman sumber.

**Tampilan:** Enam screenshot `frontend/screenshots/slice3-mock-*.png` diambil
dan diperiksa. Pada desktop 1440×900, tablet 768×1024, dan mobile 390×844,
judul dan isi panel muat. Teks jawaban terbaca, label AI dan tautan sumber
terlihat, dan tombol utama terukur 44 px.

Graphify diperbarui dari working tree: 836 node dan 1.799 edge.

### 17.2 Verifikasi DeepSeek live — 28 November 2026

Empat panggilan generasi terautentikasi dilakukan dari Chromium melalui
build produksi Next.js, proxy, dan FastAPI lokal. Tidak ada pengulangan
otomatis atau panggilan kelima. `backend/.env` terdeteksi diabaikan dan tidak
dilacak Git. Proses memuat key aplikasi dan memakai `deepseek-flash` dalam
mode non-thinking pada endpoint resmi. Nilai key tidak ditampilkan.

| Kasus | Hasil | Latensi browser ke respons |
|---|---|---:|
| Penjelasan gen manusia TP53, GeneID `7157` | PASS — HTTP 200, sitasi NCBI Gene | 6.901 ms |
| Penjelasan protein p53 manusia, UniProtKB `P04637` | PASS — HTTP 200, sitasi UniProtKB | 4.153 ms |
| Peran p53 dalam respons terhadap kerusakan DNA | FAIL — HTTP 502 `unverified_model_output`; tidak ada jawaban yang ditampilkan | 1.698 ms |
| Konsentrasi p53 pada sampel tidak teridentifikasi | PASS — HTTP 200 `insufficient_evidence`; tanpa jawaban atau sitasi rekaan | 1.121 ms |

**Ilmiah.** Rekaman live [NCBI Gene 7157](https://www.ncbi.nlm.nih.gov/gene/7157)
dan [UniProtKB P04637](https://www.uniprot.org/uniprotkb/P04637) sama-sama
menyatakan *Homo sapiens* (9606). Cross-reference GeneID menghubungkan kedua
rekaman. Penjelasan memisahkan gen yang mengode dari protein yang menjalankan
fungsi. Ringkasan NCBI mendukung lokus 17p13.1 dan regulasi gen target saat
stres seluler. Anotasi UniProt mendukung ikatan DNA, henti siklus sel,
perbaikan DNA, dan apoptosis yang bergantung pada konteks. Tautan yang tampil
cocok dengan rekaman. Kedua penjelasan masih padat untuk pemula. Kalimat
tentang varian perlu membedakan perubahan transkrip dari isoform protein akibat
perbedaan inisiasi translasi.

**Kegagalan Q&A.** Validator menahan keluaran sebelum tampil. Kode kesalahan
yang sama mencakup beberapa pemeriksaan, sehingga penyebab spesifik belum
diketahui. Anotasi UniProt lengkap memuat klausa eksplisit tentang respons
terhadap kerusakan DNA di luar potongan 1.200 karakter yang dikirim ke model.
Ini merupakan kesenjangan konteks, bukan diagnosis penyebab penolakan.

**Akses dan biaya.** Akses tanpa kode ditolak oleh proxy dan FastAPI. Kode salah
ditolak; POST di luar allowlist juga ditolak. Profil tidak memicu panggilan AI.
Backend memakai satu worker dengan konkurensi `1`, laju `6` per menit, dan
maksimum `600` token keluaran. Kuota proses adalah `4` pada proses pertama
dan `1` pada proses kedua, dengan total empat panggilan. Tidak ada kesalahan
autentikasi, penagihan, atau kuota. Uji kuota habis memakai bukti offline
sebelumnya. Kuota proses tidak persisten dan akses anonim tetap nonaktif.

Panggilan keempat mencatat 881 token masukan dan 22 keluaran (903 total).
Perkiraan **US$0,00014535** memakai tarif Flash luar jam sibuk dan menganggap
semua token masukan tidak kena cache. Statistik tiga panggilan pertama tidak
terekam karena log penggunaan tidak tertangkap; total biaya tidak diketahui.

**Inspeksi visual.** Tujuh gambar `frontend/screenshots/slice3-live-*.png`
ditangkap dan diperiksa: penjelasan gen pada desktop, penjelasan p53 dan
Study Companion pada desktop, tablet, serta mobile. Teks jawaban, tautan,
dan pesan bukti tidak cukup terbaca. Tombol utama terukur 44 px. Header
sticky menutup judul dan label atas pada tangkapan kartu penjelasan yang
lebih tinggi dari viewport; Playwright memverifikasi label AI pada DOM.
Pertanyaan panjang melampaui dua baris textarea pada tablet dan mobile.

**Gate awal: NO-GO Slice 3.** Hasil setelah perbaikan dicatat di bagian 17.3.

### 17.3 Perbaikan terarah dan verifikasi ulang

**Diagnosis.** Respons mentah yang ditolak pada uji pertama tidak disimpan.
`unverified_model_output` muncul setelah parsing JSON, pemeriksaan `finish_reason == stop`,
dan validasi skema berhasil. JSON rusak, field wajib hilang, mismatch skema, atau
keluaran terpotong akan menghasilkan `invalid_model_output`. Kode lama memakai
error yang sama untuk ID sumber yang tidak tersedia, penunjuk sumber eksternal,
atau `key_functions`/`terms` yang terisi pada `/ask`. Pemeriksaan mana yang memicu
penolakan asli tidak dapat dipastikan. Validator lama juga tidak menilai makna
klaim. Dua masalah dikonfirmasi secara independen: contoh prompt bersama
menampilkan array yang terisi, dan batas 1.200 karakter menghilangkan kalimat
UniProt tentang respons terhadap kerusakan DNA.

**Perbaikan.** `/ask` kini meminta ID kutipan dengan prompt dan skema khusus.
Backend memilih kandidat kalimat relevan dari rekaman, memvalidasi ID, dan
merangkai teks serta sitasi dari kutipan tersebut. Model tidak dapat menambahkan
klaim bebas. UI menandai kutipan sebagai pilihan AI dan menawarkan cara pulih
jika validasi gagal. Prompt penjelasan membedakan varian transkrip RNA dari
isoform protein, termasuk isoform akibat titik awal translasi berbeda pada RNA
yang sama. Log mencatat kategori penolakan, status, dan token tanpa menyimpan
prompt, keluaran mentah, atau kredensial.

**Offline:** 131/131 backend (26 tes AI), 34/34 Playwright simulasi.
Regresi mencakup kalimat DNA-damage yang sebelumnya terpotong, pemilihan sumber,
JSON rusak, field hilang, ID tidak dikenal, keluaran bergaya skema lama, klaim
kuantitatif yang tidak didukung, dan `insufficient_evidence`. Lint, typecheck,
build Next.js, dan Semgrep pada lima file aplikasi yang berubah lulus.
Graphify diperbarui saat finalisasi: 846 node dan 1.836 edge.

**DeepSeek live:** tepat tiga panggilan melalui Chromium, Next.js, dan FastAPI,
tanpa percobaan ulang. Semua menerima HTTP 200 dan berstatus `generated`.
POST tanpa kode tetap ditolak (403). Tiga tangkapan layar
`frontend/screenshots/slice3-recheck-*.png` diambil dan diperiksa.

| Kasus | Latensi | Token input / output | Perkiraan biaya (USD) |
|---|---:|---:|---:|
| p53 dan kerusakan DNA | 1.097 ms | 778 / 20 | 0,000128700 |
| Regulasi pembelahan sel oleh p53 | 982 ms | 768 / 20 | 0,000108384 |
| Varian transkrip dan isoform TP53 | 5.540 ms | 1.119 / 314 | 0,000356250 |
| Total | | 2.665 / 354 | 0,000593334 |

Perkiraan memakai tarif Flash luar jam sibuk (128 token input kena cache pada
panggilan kedua). Kedua jawaban p53 sesuai dengan anotasi [UniProtKB P04637](https://www.uniprot.org/uniprotkb/P04637).
Jawaban pertama mempertahankan konteks CDK7/CAK dan henti siklus sel serta
membedakan perbaikan DNA dan apoptosis. Jawaban kedua menyebut regulasi
ekspresi gen yang diperlukan untuk pembelahan. Penjelasan [NCBI Gene 7157](https://www.ncbi.nlm.nih.gov/gene/7157)
kini memisahkan varian RNA akibat splicing/promotor alternatif dari bentuk
protein akibat titik awal translasi. Untuk asosiasi kanker, frasa “loss or
alteration” perlu dibaca sebagai perubahan patogen; [GeneReviews](https://www.ncbi.nlm.nih.gov/books/NBK1311/)
mendokumentasikan varian patogen dan delesi terkait Li-Fraumeni.

**Gate akhir: GO untuk Slice 3 dengan akses peninjau.** Kutipan Q&A dapat tetap
teknis atau kurang lengkap; sitasi penjelasan tidak menjamin setiap parafrasa
akurat. Kuota proses tidak persisten, sehingga akses anonim berbayar tetap
nonaktif. Pemilik proyek menyetujui finalisasi melalui PR ke `master` jika
pemeriksaan wajib lulus. Deployment dan Slice 4 belum diotorisasi.

## 18. Slice 4 — Scientific Exploration

### 18.1 Sequence

- On-demand `GET /api/v1/entities/{gene|protein}/{id}/sequence` returns typed
  records, versioned reference identifiers, coordinates when applicable, and
  per-source notices. No fixture fallback in live mode.
- UniProtKB supplies the amino-acid sequence and canonical protein identity.
  NCBI Datasets supplies RefSeqGene or assembly-annotated locus coordinates and
  RefSeq transcript/CDS mappings. EFetch supplies accession-checked FASTA.
  Transcript selection prefers MANE Select, then RefSeq Select; otherwise the
  UI labels the chosen record as an example. Regions above 100,000 bases, complex
  CDSs, and records without supported mappings may be omitted.
- [UniProtKB REST API](https://rest.uniprot.org/uniprotkb/api/docs),
  [UniProt license](https://www.uniprot.org/help/license) (CC BY 4.0),
  [NCBI Datasets REST API](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/api/rest-api/),
  [gene product schema](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/data-reports/gene-product/),
  [NCBI Datasets rate limits](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/api/api-keys/),
  [E-utilities documentation](https://www.ncbi.nlm.nih.gov/books/NBK25499/), and
  [NCBI data policies](https://www.ncbi.nlm.nih.gov/home/about/policies/).
  Module transport paces Datasets at one start per 210 ms and EFetch at one per
  350 ms per process. UniProt uses the existing bounded adapter.
- Live route checks: P04637 (393 aa), P00918 (260 aa), TP53/7157 (RefSeqGene
  NG_017013.2, MANE NM_000546.6, 1,182-base CDS), and mouse Trp53/22059
  (RefSeq Select NM_011640.4 and an annotated genomic locus).
- Verification: 139 offline backend tests; 15 live and one mocked browser
  check; frontend lint and typecheck. Three sequence screenshots inspected.

### 18.2 Scientific Literature

- PubMed EFetch supplies article metadata. Direct references come from NCBI
  Gene `gene_pubmed` or UniProtKB PubMed cross-references. Separately labeled
  ESearch results match entity and organism terms. Each group is capped at eight
  records; duplicate PMIDs keep their direct relationship.
- [E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25499/),
  [PubMed search reference](https://pubmed.ncbi.nlm.nih.gov/help/), and
  [NCBI policies](https://www.ncbi.nlm.nih.gov/home/about/policies/).
  PubMed shares the paced EFetch transport with Sequence. Abstracts are displayed
  only when their copyright notice explicitly links CC BY 4.0 or CC0 1.0.
  Other available abstracts link to PubMed. Europe PMC returned 403 or timed out
  in this environment; the implementation uses PubMed.
- Live checks: P04637, GeneID 7157, P00918, and mouse GeneID 22059 returned both
  groups. Six live browser literature checks passed across three viewports.
  Three screenshots inspected. Offline tests cover discovery provenance,
  unrequested article rejection, abstract rights, and partial search failure.

### 18.3 Molecular Structure

- [RCSB Data API](https://data.rcsb.org/) verifies UniProt protein identifiers
  and author chains in up to six candidate PDB entries. UniProt supplies
  mapped residue ranges; RCSB supplies experimental methods, resolution,
  assembly thumbnails, and [mmCIF downloads](https://www.rcsb.org/docs/programmatic-access/file-download-services).
  Mapped spans can include unresolved residues. RCSB data is
  [CC0](https://www.rcsb.org/pages/policies); usage is paced and handles 429.
- [AlphaFold DB API](https://alphafold.ebi.ac.uk/api-docs) verifies accession,
  taxonomy, and sequence when present. It supplies mean pLDDT, PAE previews
  and model links. Full interactive 3D opens at the provider. See
  [AlphaFold DB FAQ and data terms](https://alphafold.ebi.ac.uk/faq) (CC BY 4.0).
  The fixed-host adapter paces requests and backs off on 429.
- Four live entity routes returned experimental and predicted models, including
  P04637 with mean pLDDT 75.06. Six live browser checks verified provider
  previews and metadata on three viewports. Offline tests verified mapping,
  safe downloads, and preservation of RCSB records when AlphaFold fails identity checks.

### 18.4 Chemical Components

- The RCSB Chemical Component Dictionary identifies non-polymer components
  in experimentally verified PDB entries. Results distinguish ions and report
  other non-polymer components without assigning a biological binding role.
  Cofactor annotations require a matching UniProtKB annotation by ChEBI ID
  or an exact monatomic element and formal-charge match.
- [RCSB Data API](https://data.rcsb.org/) supplies CCD IDs, names, formulas,
  and deposited entry associations. Entries link to their original RCSB page.
  The module makes no binding-affinity or efficacy claims.
- Four live entity routes and three browser viewport checks passed. p53 showed
  ZN in `6XRE`, `8R1F`, and `8R1G`. Carbonic anhydrase II showed ions and other
  non-polymer components. The offline check rejects components from an entry
  whose UniProt mapping cannot be verified.

### 18.5 Protein Interaction

- [STRING v12 API](https://string-db.org/help/api/) resolves the UniProtKB
  accession and taxon and must agree with the explicit UniProtKB STRING
  cross-reference. The functional network shows up to ten same-organism
  associations scoring at least 0.70, with channel scores when present.
- The network reuses the relationship map and accessible list. The seed opens
  its verified MoLearn protein profile. Partners link to STRING. A functional
  association, including experiments-channel evidence, is not confirmation
  of direct physical binding.
- [Data license and downloads](https://string-db.org/cgi/download) (CC BY 4.0
  for published network data). The adapter identifies MoLearn and spaces
  calls by at least one second per process. The provider's web viewer
  sometimes blocked automated clients; the source JSON endpoint was live.
- Four live entity checks and six live browser checks passed. Offline tests
  reject ambiguous mappings and cross-species partner records.

### 18.6 Data Export

- Entity, literature, structure, and STRING CSVs preserve source identifiers,
  retrieval time, taxonomy and source URLs. Module CSVs include result status
  and provider notices, so a partial export remains identifiable. The sequence
  viewer exports the selected record with a provenance-bearing FASTA header.
- CSV serialization doubles embedded quotes, quotes cells containing delimiters
  or newlines, and prefixes spreadsheet formula-like text with an apostrophe.
  Abstract text is excluded from the metadata export.
- The entity CSV stays in Data Export. The relevant module offers each data
  CSV or FASTA after it has loaded verified records; exports reuse those results.
- Production browser checks covered all four CSVs, FASTA and clipboard parity,
  partial-result provenance, and formula neutralization with a mocked unsafe title.

### 18.7 API Contract and Verification

Each exploration request uses `GET /api/v1/entities/{gene|protein}/{id}/{module}`.
The supported suffixes are `sequence`, `literature`, `structure`, `ligand`, and
`interaction`. The browser uses the same paths prefixed with `/api/backend`.
The proxy accepts the five exact suffixes without query strings. The response
contains canonical `identity`, typed `records`, and structured source `notices`.
Valid requests return `200` with `available`, `empty`, `unavailable`, `partial`,
or `provider_error`. An unknown entity returns `404`; invalid identifiers return
`422` from FastAPI. FastAPI publishes the fields in its `/docs` and `/openapi.json`.
The existing AI POST allowlist and reviewer-only flow remain in place.

Transport uses fixed HTTPS providers, bounded response sizes for the new
adapters, timeouts and a single bounded retry for transient failures. NCBI Gene,
RefSeq and PubMed share E-utilities pacing in each backend process. Provider
failure never activates demo data.

To reproduce, start FastAPI and production Next.js on loopback with
`BACKEND_API_URL` set, `NEXT_PUBLIC_DEMO_MODE=false`, and reviewer AI disabled
for scientific testing. Use `LIVE_BASE_URL` for the Python backend URL and
`EXPLORATION_BROWSER_URL` for the frontend URL.

```sh
# backend/
uv run --locked --offline pytest -q -m "not live"
uv run --locked --offline pytest -q -m live tests/test_api_live.py tests/test_exploration_live.py

# frontend/ (Node 24 for the browser test's TypeScript helper import)
npm run lint
npm run typecheck
npm run build
npm run test:slice4
```

**Verified on the local production build:** 146 offline backend tests and 22
paced live provider cases. The live suite covered TP53/7157, P04637, human
carbonic anhydrase II/P00918, and mouse Trp53/22059 across all five live modules.
The Slice 4 browser script passed 49 checks: 41 live, three mocked, four proxy
security checks, and one offline CSV check. Earlier browser suites passed:
75 route/layout checks, 97 learning checks, 40 Slice 2 integration checks
(33 live, seven simulated), and 34 mocked Slice 3 AI checks. Frontend lint,
typecheck and build, the uv lock check, and Semgrep (`p/default`, 74 source
targets, zero findings) passed.

Desktop (1440×900), tablet (768×1024), and mobile (390×844) screenshots are
under `frontend/screenshots/slice4-*.png` and were visually inspected. Narrow
375 px reduced-motion checks and a landscape Sequence check also passed.
The sample RCSB mmCIF and AlphaFold mmCIF/PDB download URLs returned HTTP 200
to provider HEAD requests. No paid AI calls were made.

**Milestone gate: GO for local Slice 4 verification.** Commit, push, and
deployment remain separate actions.

## 19. Slice 5 - Kesiapan Produksi

Branch `feat/production-readiness`, berdasarkan `master` `e46a7fc`. Slice ini
tidak menambah fitur. Fokusnya: menutup temuan keamanan, membatasi biaya AI,
memperkuat keandalan provider, menyiapkan konfigurasi produksi, dan menghasilkan
bukti regresi akhir. Tidak ada commit, push, deploy publik, atau panggilan AI
berbayar selama verifikasi ini.

### 19.1 Dependensi dan Kerentanan

- Next.js dinaikkan dari `16.2.6` ke `16.4.6`, bersama `eslint-config-next`.
  Versi lama membawa temuan kritis (RCE, SSRF, cache/DoS). `npm audit` pada
  proyek dan pada instalasi bersih melaporkan **0 kerentanan** (362 paket).
- Backend: `uv lock --check --offline` lulus; `uv audit --locked` bersih untuk
  Windows dan `x86_64-unknown-linux-gnu` (29 paket).
- Build produksi tetap lulus dengan Next 16.4.6: lint, `tsc --noEmit`, dan
  `next build` (6 rute).

### 19.2 Batas Permintaan dan Proxy

- Proxy `/api/backend/[...path]` memakai `maxDuration = 70`, batas waktu 60 detik
  yang juga menutupi pembacaan body, `redirect: "error"`, dan hanya meneruskan
  JSON dari upstream. Balasan non-JSON menghasilkan `502/503 upstream_unavailable`
  dengan pesan tersanitasi.
- `lib/api.ts` memakai batas waktu 60 detik, `redirect: "error"`, dan memetakan
  timeout ke `504 upstream_timeout` serta kegagalan koneksi ke `502
  connection_error`. Detail internal backend tidak diteruskan ke browser.
- Header keamanan: CSP `frame-ancestors 'none'; object-src 'none'; base-uri
  'self'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, dan `poweredByHeader: false`. Diverifikasi pada respons
  produksi.
- AI: pembacaan body dibatasi 5 detik (`408 request_body_timeout`), kode reviewer
  diperiksa di FastAPI, dan AI tetap nonaktif secara default.

### 19.3 Keandalan Provider

- NCBI: setiap operasi menerima `deadline`, paging `retstart`, validasi payload,
  penanganan 404, deteksi `UpstreamMalformed`, verifikasi `geneid`, serta
  parameter `tool`/`email` (`MOLEARN_NCBI_CONTACT_EMAIL`).
- Pencarian dan profil berbagi satu deadline 35 detik; offset kursor dibatasi
  `2_147_483_647`. GeneID dibatasi `[0-9]{1,12}` lalu dinormalisasi.
- Log aplikasi berformat JSON: rute, status, dan durasi. Access log Uvicorn
  dimatikan di produksi agar tidak mencatat header/body mentah.
- Footer menampilkan atribusi dan tautan kebijakan NCBI.

### 19.4 Pemindaian Keamanan

| Pemeriksaan | Cakupan | Hasil |
| --- | --- | --- |
| Gitleaks (riwayat) | 16 commit, 4,36 MB | 0 kebocoran |
| Gitleaks (pohon kandidat) | 151 berkas | 0 kebocoran |
| Gitleaks (bundel klien) | 747 KB JS hasil build | 0 kebocoran |
| String rahasia di JS klien | variabel env dan fixture | 0 kecocokan |
| Semgrep `p/default` | 76 berkas, 452 aturan | 0 temuan |
| `npm audit` | proyek dan instalasi bersih | 0 kerentanan |
| `uv audit --locked` | Windows dan Linux x86_64 | 0 kerentanan |

Pemeriksaan browser produksi menemukan landmark `<main>` bersarang pada halaman
search, profil, koleksi, glosarium, error, dan 404. Setiap halaman kini memakai
satu landmark; diuji pada tujuh rute di viewport mobile.

### 19.5 Bukti Regresi

| Lapisan | Hasil |
| --- | --- |
| Backend offline | 150 lulus, 23 di-deselect |
| Provider hidup | 22 lulus (NCBI, UniProt, RCSB, AlphaFold, STRING) |
| Browser rute/tata letak | 75/75 |
| Browser pembelajaran | 97/97 |
| Integrasi Slice 2 | 43/43 (36 live, 7 simulasi; termasuk 3 cek proxy baru) |
| Eksplorasi Slice 4 | 49/49 (41 live, 4 mock, 4 keamanan proxy) |
| AI tiruan Slice 3 | 34/34 |

Pemeriksaan browser memakai build produksi di port terpisah dengan backend lokal
dan model tiruan. Tidak ada panggilan LLM berbayar. Screenshot 1440x900,
768x1024, dan 390x844 diambil dan diperiksa. Uji provider "hidup" berarti
provider asli dipanggil lewat build lokal, bukan lewat URL publik.

Pada build produksi lokal, landing page menjawab dalam 4-36 ms dengan 141-151
KiB JavaScript, sedangkan halaman search dan profil memerlukan 4,0-6,3 detik
karena menunggu provider asli. Transisi rute hanya memuat 9-18 KiB JavaScript.
Angka ini bukan pengukuran hosting; latensi dari Singapura harus diukur ulang
setelah deploy.

### 19.6 Evaluasi Hosting

- **Vercel (frontend) + Render (backend)**, keduanya region Singapura.
  Biaya dasar **USD 27/bulan** (Vercel Pro 20 + Render 0.5 CPU/512 MB 7).
- Render Free ditolak: tidur setelah 15 menit, bangun sekitar 1 menit, 0,1 CPU,
  dan risiko suspensi. Cold start dapat menghabiskan timeout proxy 60 detik.
- Vercel Hobby hanya untuk penggunaan personal/non-komersial. Jika panitia
  mengonfirmasi kelayakan, biaya turun ke USD 7/bulan sebelum pajak dan
  penggunaan. Batas fungsi Hobby 300 detik.
- `render.yaml` disiapkan (`rootDir: backend`, health check
  `/api/v1/health`, 1 worker, `--limit-concurrency 16`, graceful shutdown 45
  detik, rahasia `sync: false`). Panduan lengkap ada di `docs/DEPLOYMENT.md`.

### 19.7 Batasan yang Wajib Diungkapkan

- Kuota AI bersifat per proses (`MOLEARN_AI_MAX_CALLS_PER_PROCESS=30`), reset
  saat restart, dan tidak menjadi batas belanja global. Percobaan yang timeout
  tetap dapat ditagih.
- Tidak ada database server; koleksi tersimpan di browser dan tidak tersinkron.
- Rute ilmiah publik di Render tidak punya kuota per pengguna; hanya AI yang
  memerlukan kode reviewer.
- STRING menampilkan asosiasi fungsional, bukan bukti ikatan fisik.
- Email kontak NCBI belum diisi; harus dipasok pemilik produk sebelum rilis.
- Angka pilot belum ada. Instrumen pilot dan skrip demo ada di
  `docs/COMPETITION.md`; hasil hanya boleh dilaporkan setelah dijalankan.

### 19.8 Gate

**GO untuk commit dan deploy terbatas setelah persetujuan**, dengan syarat:
email kontak NCBI diisi, AI tetap nonaktif saat rilis, dan UAT produksi
(`docs/COMPETITION.md`) dijalankan pada URL hosting sebelum peserta diundang.
**NO-GO untuk klaim "siap produksi penuh"**: belum ada deploy publik, UAT
hosting, atau data pilot. Semua perubahan masih belum di-commit pada branch
`feat/production-readiness`.
