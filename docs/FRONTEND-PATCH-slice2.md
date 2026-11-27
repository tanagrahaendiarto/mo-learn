# FRONTEND-PATCH-slice2 — yang harus dikerjakan teman frontend

27 Nov 2026. Ditulis setelah **mengaudit `frontend/` yang benar-benar ada di
repo** (commit `39be956`, satu-satunya commit frontend), bukan menuduh tanpa
bukti. Setiap klaim di bawah punya bukti yang bisa dijalankan ulang.

**Kesimpulan jujur lebih dulu:** frontend **tidak "salah"** — ia benar untuk
kontrak slice 1. Backend slice 2 memperluas kontrak (menambah entity `gene`,
`entity_type`, `providers[]`, `provider_status: "partial"`), jadi frontend
perlu beberapa perubahan agar ikut. Backend tidak perlu diubah lagi.

## Bukti: backend slice 2 sudah benar

Server hidup di `127.0.0.1:8000` (restart 27 Nov, PID 23496):

```text
GET /api/v1/health                     -> version 0.2.0
GET /entities/gene/7157                -> TP53, taxid 9606, protein_links 7 (P04637 dll)
GET /search?q=7157                     -> exact_geneid, 1 gene
GET /search?q=TP53&entity_type=gene    -> hanya ncbi_gene
GET /search?q=TP53&entity_type=protein -> hanya uniprot
pytest tests/ -q                       -> 121 passed (103 offline + 18 live)
```

## Bukti: yang rusak ada di frontend

### Bukti 1 — proxy memblokir endpoint gen

`frontend/src/app/api/backend/[...path]/route.ts:5-9`:

```ts
function isAllowed(pathname: string): boolean {
  if (pathname === "/api/v1/health") return true;
  if (pathname === "/api/v1/search" || pathname.startsWith("/api/v1/search?")) return true;
  if (pathname.startsWith("/api/v1/entities/protein/")) return true;
  return false;   // <-- semua yang lain, termasuk /entities/gene/
}
```

Dijalankan dengan kode asli repo (Node, tanpa dep):

```text
ALLOW  /api/v1/health
ALLOW  /api/v1/search?q=TP53
ALLOW  /api/v1/entities/protein/P04637
BLOCK  /api/v1/entities/gene/7157
```

Artinya: tombol "buka profil gen" akan dijawab **404 oleh proxy sendiri**,
sebelum menyentuh FastAPI.

### Bukti 2 — hasil gene dipaksa jadi protein

`frontend/src/lib/api.ts:88-105` `mapSummary()`:

```ts
type: "protein",   // hardcoded, bukan b.entity_type
```

Replay mapping itu terhadap respons backend nyata:

```text
q=TP53 (default)      backendTypes=protein,gene  frontendTypesAfterMap=protein
q=7157 (default)      backendTypes=gene          frontendTypesAfterMap=protein
q=TP53 entity_type=gene  backendTypes=gene       frontendTypesAfterMap=protein
```

Dampak nyata: `results-client.tsx:98-101` memfilter lokal
`e.type === "gene"`, dan karena semua sudah jadi `"protein"`, **filter Gene
selalu kosong** walaupun backend mengirim gen.
`hasPair` (baris 103-105) juga tidak pernah true, jadi catatan disambiguasi
tidak muncul.

### Bukti 3 — profil gen dilarang di kode

`frontend/src/lib/api.ts:248-250`:

```ts
if (type !== "protein") {
  throw new ApiError(404, "Only protein profiles available in slice 1. Gene profiles coming in slice 2.");
}
```

### Bukti 4 — filter tidak pernah dikirim ke backend

`lib/api.ts:167-171` `SearchParams` hanya `q`, `page_size`, `cursor`.
Tidak ada `entity_type`. Frontend memilih "Gene" lalu memfilter **lokal**
(`results-client.tsx:97-101`), padahal kontrak yang disepakati (dan yang
diuji live) adalah filter **server-side**. Akibatnya `page_size=10` bisa
berisi 10 protein dan 0 gen, sehingga filter Gene tampak rusak.

### Bukti 5 — tipe `provider_status` dan `providers[]` belum dikenal

`lib/api.ts:38-44`:

```ts
match_mode: "exact_accession" | "name";           // slice 2: + exact_geneid
provider_status: "available" | "not_found";       // slice 2: + partial
results: BackendProteinSummary[];
```

`providers[]` tidak ada di tipe sama sekali, dan `lib/api.ts:104`
`partial: b.status !== "available"` akan menandai halaman `partial`
sebagai gagal penuh — padahal `partial` berarti sebagian hasil **valid**.

---

## Cara fix (urut prioritas, masing-masing kecil)

### Fix 1 — izinkan endpoint gen di proxy (wajib, 1 baris)

`frontend/src/app/api/backend/[...path]/route.ts`

```ts
if (pathname.startsWith("/api/v1/entities/gene/")) return true;
```

Alasan: proxy adalah satu-satunya jalur browser→backend; tanpa ini profil
gen tidak bisa dibuka sama sekali.

### Fix 2 — pakai `entity_type` dari backend, jangan hardcode

`frontend/src/lib/api.ts` `mapSummary()`:

```ts
type: b.entity_type as BiologicalEntitySummary["type"],   // "protein" | "gene"
```

Lalu hapus asumsi khusus protein di `mapProfile()`; buat
`mapGeneProfile()` terpisah yang memetakan field gen:

| Backend gene | Frontend `sections` |
|---|---|
| `description` | `apaItu` |
| `synonyms` + `related_proteins` | `fungsi` (nama protein terkait) |
| `chromosome` | `lokasi` |
| `cross_references` | `references` |

Field yang tidak ada di respons gen (`function_annotations`, `length`) tidak
boleh dipakai; jangan mengarang isi.

### Fix 3 — izinkan profil gen di `fetchEntityProfile`

`frontend/src/lib/api.ts:248-256` — ganti blok tolak:

```ts
const path =
  type === "protein"
    ? `/api/v1/entities/protein/${encodeURIComponent(id)}`
    : `/api/v1/entities/gene/${encodeURIComponent(id)}`;
```

dan petakan `BackendGeneProfile` (tipe baru) ke `EntityProfile` dengan
`type: "gene"`. Halaman `app/entity/[type]/[id]/page.tsx:27,53` juga punya
guard `type !== "protein"` yang perlu dilonggarkan setelah ini.

### Fix 4 — kirim `entity_type` ke backend

`lib/api.ts` `SearchParams` + `searchEntities`:

```ts
export interface SearchParams {
  q: string;
  entity_type?: "all" | "gene" | "protein";
  page_size?: number;
  cursor?: string;
}
```

```ts
if (params.entity_type && params.entity_type !== "all") {
  url.searchParams.set("entity_type", params.entity_type);
}
```

Di `results-client.tsx`: panggil ulang `searchEntities` saat filter berubah
(dan **buang cursor** — lihat Fix 6). Setelah ini filter lokal
(`e.type === t`) boleh dihapus, karena backend sudah memfilter.

### Fix 5 — perbarui tipe + penanganan status

`lib/api.ts`:

```ts
match_mode: "exact_accession" | "exact_geneid" | "name";
provider_status: "available" | "not_found" | "partial" | "error";
providers: { name: string; status: string; detail: string | null; count: number }[];
```

`handleBackendError` (baris 147-163) belum kenal kode NCBI; tambahkan:

```ts
rate_limited_by_ncbi: 429,
upstream_ncbi_timeout: 504,
upstream_ncbi_error: 502,
upstream_ncbi_malformed: 502,
```

Dan `partial` harus ditampilkan sebagai **peringatan**, bukan error:
`providers[]` memberi tahu provider mana yang gagal (`status: "error"`).

### Fix 6 — buang cursor saat filter berubah

Backend tidak me-reset cursor diam-diam (kontrak bersama). Saat
`q`/`entity_type`/`page_size` berubah, frontend **wajib** `setCursor(undefined)`
sebelum request berikutnya. Bila tidak, halaman 2 bisa memakai state provider
dari kueri lama.

### Fix 7 — tampilkan jenis record

Karena sekarang hasil bisa campur gen+protein, UI **wajib** menampilkan badge
jenis record, organism, dan identifier sebelum pengguna memilih (FR-02 PRD).
`EntityBadge` sudah ada; cukup pastikan `type` yang dipakai benar (lihat Fix 2).

---

## Urutan kerja yang saya sarankan

1. Fix 1 + Fix 2 (proxy + tipe) → hasil gene mulai muncul benar.
2. Fix 3 (profil gen) → halaman detail gen bisa dibuka.
3. Fix 4 + Fix 6 (filter server-side + cursor) → filter Gene/Protein benar.
4. Fix 5 + Fix 7 (status & badge) → UX jujur saat salah satu provider gagal.

Estimasi: Fix 1 satu baris; Fix 2-3 sedang (mapping); Fix 4 sedang
(state + refetch); Fix 5-7 kecil.

## Yang TIDAK perlu diubah

- Endpoint protein (`/entities/protein/{accession}`) dan bentuk responsnya
  tetap sama seperti slice 1 — jangan refactor bagian itu.
- CORS: tidak perlu. Proxy Next.js sudah benar untuk arsitektur yang
  disepakati; cukup allow-list di atas.
- `BACKEND_API_URL` lewat env sudah benar.

## Cara memverifikasi pekerjaan

Backend (sudah jalan):

```bash
cd D:/Projects/MoLearn/backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd D:/Projects/MoLearn/frontend
npm install
cp .env.example .env.local          # BACKEND_API_URL=http://localhost:8000
npm run dev                          # http://localhost:3000
```

Cek manual yang membuktikan fix berhasil:

1. `/search?q=7157` → kartu **Gene 7157 TP53** (bukan protein).
2. Filter **Gene** pada `q=TP53` → hanya hasil gen (sebelum fix: kosong).
3. Filter **Protein** pada `q=TP53` → hanya protein.
4. Buka `/entity/gene/7157` → profil gen tampil (sebelum fix: 404 proxy).
5. Buka `/entity/protein/P04637` → masih normal (regresi slice 1).
6. Matikan backend → UI menampilkan error jujur, bukan data palsu.

## Rujukan kontrak

`docs/HANDOFF-slice2.md` (kontrak final, contoh JSON nyata, tabel kode error,
aturan cursor, aturan bukti relasi gene–protein).
