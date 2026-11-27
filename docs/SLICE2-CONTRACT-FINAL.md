# SLICE 2 — STATUS & KONTRAK FINAL untuk tim frontend

27 Nov 2026. Dijawab untuk pertanyaan: "Slice 2 backend sampai mana, dan
mana API contract finalnya?"

**Jawaban singkat: kontrak NCBI Gene sudah FINAL dan stabil.** Semua yang
dibutuhkan `collection`, `profile`, `glossary`, `relationship explorer`, dan
`exploration modules` sudah tersedia di backend. Tinggal 2 penyesuaian
kecil di sisi frontend (lihat bagian "Yang harus kamu ubah di frontend").

Bukti: **123 tes lolos** (105 offline + 18 live), 0 failed, 0 skipped.

```text
cd D:/Projects/MoLearn/backend
.venv/Scripts/python.exe -m pytest tests/ -q
123 passed
```

---

## 1. Endpoint final

| Method | Path | Status |
|---|---|---|
| GET | `/api/v1/health` | final — `{"status":"ok","service":"molearn-backend","version":"0.2.0"}` |
| GET | `/api/v1/search` | final — protein + gene, `entity_type`, cursor lintas provider |
| GET | `/api/v1/entities/protein/{accession}` | **tidak berubah** dari slice 1 |
| GET | `/api/v1/entities/gene/{gene_id}` | **baru**, final |

Docs interaktif: `http://127.0.0.1:8000/docs`
OpenAPI: `http://127.0.0.1:8000/openapi.json`

---

## 2. Schema final (Pydantic — sumber kebenaran)

### `GeneSummary` (satu baris hasil pencarian)

| Field | Tipe | Nullable | Isi |
|---|---|---|---|
| `entity_type` | `str` | tidak | selalu `"gene"` |
| `accession` | `str` | tidak | NCBI GeneID, mis. `"7157"` |
| `primary_name` | `str \| None` | **ya** | official symbol (`Gene-ref_locus`) |
| `synonyms` | `list[str]` | tidak (bisa `[]`) | alias resmi NCBI |
| `gene_symbols` | `list[str]` | tidak (bisa `[]`) | `[official_symbol]` atau `[]` |
| `organism.scientific_name` | `str \| None` | **ya** | mis. `"Homo sapiens"` |
| `organism.taxonomy_id` | `int \| None` | **ya** | mis. `9606` |
| `source` | `str` | tidak | selalu `"ncbi_gene"` |
| `source_url` | `str` | tidak | `https://www.ncbi.nlm.nih.gov/gene/{id}` |
| `retrieved_at` | `str` | tidak | ISO-8601 UTC, `YYYY-MM-DDTHH:MM:SSZ` |
| `status` | `str` | tidak | `"available"` |

### `GeneProfile` (extends `GeneSummary`)

| Field | Tipe | Nullable | Isi |
|---|---|---|---|
| `description` | `str \| None` | **ya** | ringkasan NCBI (`Entrezgene_summary`) |
| `chromosome` | `str \| None` | **ya** | mis. `"17p13.1"` |
| `gene_type` | `str \| None` | **ya** | mis. `"protein-coding"` |
| `cross_references` | `list[GeneXref]` | tidak (bisa `[]`) | `{namespace, id}` dari `Gene-ref_db` |
| `related_proteins` | `list[str]` | tidak (bisa `[]`) | **nama** protein dari NCBI, bukan accession |
| `protein_links` | `list[ProteinLink]` | tidak (bisa `[]`) | **bukti relasi gen→protein** |

### `ProteinLink` — untuk relationship explorer kamu

| Field | Tipe | Nullable | Isi |
|---|---|---|---|
| `accession` | `str` | tidak | UniProt accession, mis. `"P04637"` |
| `primary_name` | `str \| None` | **ya** | nama protein |
| `gene_symbols` | `list[str]` | tidak | mis. `["TP53"]` |
| `reviewed` | `bool \| None` | **ya** | status review UniProt |
| `source` | `str` | tidak | selalu `"uniprot"` |
| `source_url` | `str` | tidak | `https://www.uniprot.org/uniprotkb/{acc}` |
| `evidence` | `str` | tidak | selalu `"uniprot_geneid_crossref"` |

**Aturan bukti (penting untuk relationship explorer):** link gen→protein
HANYA dibuat dari cross-reference `GeneID` milik UniProt (query
`xref:geneid-<id>`). Kecocokan simbol gen **bukan** bukti dan tidak dipakai.
Kalau UniProt gagal, `protein_links` = `[]` dan profil gen **tetap 200**.

Catatan nyata: NCBI untuk 7157 **tidak** memuat UniProtKB di
`Gene-ref_db` (hanya HGNC, Ensembl, MIM, AllianceGenome). Jadi jangan
mencari relasi dari sisi NCBI.

### `SearchResponse`

| Field | Tipe | Catatan |
|---|---|---|
| `query` | `str` | echo input |
| `match_mode` | `str` | `"exact_accession"` \| `"exact_geneid"` \| `"name"` |
| `results` | `list[ProteinSummary \| GeneSummary]` | **campuran**; bedakan via `entity_type` |
| `next_cursor` | `str \| None` | opaque; `null` = tidak ada halaman berikutnya |
| `provider_status` | `str` | `"available"` \| `"not_found"` \| `"partial"` \| `"error"` |
| `providers` | `list[ProviderStatus]` | status per provider |

### `ProviderStatus`

| Field | Tipe | Isi |
|---|---|---|
| `name` | `str` | `"uniprot"` \| `"ncbi_gene"` |
| `status` | `str` | `"available"` \| `"not_found"` \| `"error"` |
| `detail` | `str \| None` | kode error saat `status == "error"` |
| `count` | `int` | jumlah hasil dari provider ini |

---

## 3. Contoh respons NYATA (live, bukan karangan)

`GET /api/v1/entities/gene/7157` → 200:

```json
{
  "entity_type": "gene",
  "accession": "7157",
  "primary_name": "TP53",
  "synonyms": ["P53", "BCC7", "LFS1", "BMFS5", "TRP53"],
  "gene_symbols": ["TP53"],
  "organism": {"scientific_name": "Homo sapiens", "taxonomy_id": 9606},
  "source": "ncbi_gene",
  "source_url": "https://www.ncbi.nlm.nih.gov/gene/7157",
  "retrieved_at": "2026-11-27T16:26:03Z",
  "status": "available",
  "description": "This gene encodes a tumor suppressor protein containing transcriptional activation, DNA binding, and oligomerization domains...",
  "chromosome": "17p13.1",
  "gene_type": "protein-coding",
  "cross_references": [
    {"namespace": "HGNC", "id": "HGNC:11998"},
    {"namespace": "Ensembl", "id": "ENSG00000141510"},
    {"namespace": "MIM", "id": "191170"}
  ],
  "related_proteins": ["antigen NY-CO-13", "phosphoprotein p53", "tumor protein 53"],
  "protein_links": [
    {"accession": "P04637", "primary_name": "Cellular tumor antigen p53",
     "gene_symbols": ["TP53"], "reviewed": true,
     "source": "uniprot", "source_url": "https://www.uniprot.org/uniprotkb/P04637",
     "evidence": "uniprot_geneid_crossref"}
  ]
}
```

`GET /api/v1/search?q=TP53&page_size=3` → 200:

```json
{
  "query": "TP53",
  "match_mode": "name",
  "provider_status": "available",
  "providers": [
    {"name": "uniprot", "status": "available", "detail": null, "count": 3},
    {"name": "ncbi_gene", "status": "available", "detail": null, "count": 1}
  ],
  "results": [
    {"entity_type": "protein", "accession": "Q9Y2B4", "primary_name": "TP53-target gene 5 protein"},
    {"entity_type": "gene", "accession": "7157", "primary_name": "TP53"},
    {"entity_type": "protein", "accession": "Q9NQ88", "primary_name": "Fructose-2,6-bisphosphatase TIGAR"}
  ],
  "next_cursor": "eyJ1Ijoi...OTMy"
}
```

---

## 4. Routing pencarian (final)

| `q` | `entity_type` | Hasil | `match_mode` |
|---|---|---|---|
| `7157` | `all` / `gene` | 1 gene (exact GeneID) | `exact_geneid` |
| `7157` | `protein` | `[]`, `not_found` | `exact_geneid` |
| `P04637` | `all` / `protein` | 1 protein (exact accession) | `exact_accession` |
| `P04637` | `gene` | `[]`, `not_found` | `exact_accession` |
| `TP53` | `all` | protein + gene | `name` |
| `TP53` | `gene` | gene saja | `name` |
| `insulin` | `protein` | protein saja | `name` |

Filter **tidak pernah** melebar. Hasil kosong karena filter = jawaban sah,
bukan error. Query yang berbentuk identifier tidak pernah turun jadi
pencarian nama.

---

## 5. Kontrak cursor (final)

`next_cursor` = opaque, isinya state per-provider:
`{u: token UniProt, n: offset NCBI, g: gene-exhausted}`.

Aturan untuk frontend:
- **Wajib buang cursor** saat `q`, `entity_type`, atau `page_size` berubah.
- `next_cursor: null` = tidak ada halaman berikutnya.
- Cursor URL-like / rusak → 400 `cursor_invalid`.
- Backend **tidak** me-reset cursor diam-diam.

Dua bug pagination nyata yang sudah ditemukan & difix lewat tes live:
gene berulang di halaman 2 (ditutup penanda `g`), dan offset gene maju
padahal pencarian protein-only.

---

## 6. Kontrak error (final)

| Situasi | HTTP | Body |
|---|---|---|
| `q` kosong | 422 | `{"detail": "q must not be empty or whitespace"}` |
| `q` > 100 char | 400 | `{"status":"bad_request","detail":"query_too_long"}` |
| cursor rusak | 400 | `{"status":"bad_request","detail":"cursor_invalid"}` |
| `entity_type` bukan all/gene/protein | 422 | validasi FastAPI |
| GeneID bukan angka positif | 422 | `{"detail":"invalid gene_id: ..."}` |
| gen tidak ada | 404 | `{"status":"not_found","detail":"gene_not_found"}` |
| protein tidak ada | 404 | `{"status":"not_found","detail":"protein_not_found"}` |
| satu provider gagal | **200** | `provider_status: "partial"` + `providers[]` |
| dua provider gagal | 502/429/504 | `{"status":"provider_error","detail":"<kode>"}` |

Kode `detail` yang mungkin: `upstream_uniprot_error`,
`upstream_uniprot_malformed`, `upstream_uniprot_malformed_pagination`,
`upstream_uniprot_timeout`, `upstream_ncbi_error`,
`upstream_ncbi_malformed`, `upstream_ncbi_timeout`,
`rate_limited_by_uniprot`, `rate_limited_by_ncbi`.

**`partial` bukan error** — hasil provider yang sehat tetap valid dan harus
ditampilkan, dengan peringatan berbasis `providers[]`.

---

## 7. Yang harus kamu ubah di frontend (2 hal wajib)

### Wajib 1 — allow-list proxy

`frontend/src/app/api/backend/[...path]/route.ts`

```ts
if (pathname.startsWith("/api/v1/entities/gene/")) return true;
```

Tanpa ini `/entity/gene/7157` dijawab **404 oleh proxy sendiri**, sebelum
menyentuh backend. (Dibuktikan dengan menjalankan `isAllowed()` asli repo:
`BLOCK /api/v1/entities/gene/7157`.)

### Wajib 2 — jangan hardcode `type: "protein"`

`frontend/src/lib/api.ts:94` `mapSummary()` memaksa semua hasil jadi
`"protein"`. Replay ke backend nyata:

```text
q=TP53 (default)         backendTypes=protein,gene  frontendTypesAfterMap=protein
q=TP53 entity_type=gene  backendTypes=gene          frontendTypesAfterMap=protein
```

Karena `results-client.tsx` memfilter lokal `e.type === "gene"`, **filter
Gene selalu kosong**. Ubah jadi:

```ts
type: b.entity_type as "protein" | "gene",
```

### Sangat disarankan (bukan bug, tapi kontrak)

3. `SearchParams` tambah `entity_type`, kirim ke backend (filter server-side,
   bukan lokal). Buang cursor saat filter berubah.
4. `provider_status` tipe tambah `"partial"`; tambah `providers[]`.
5. `match_mode` tipe tambah `"exact_geneid"`.
6. `fetchEntityProfile` izinkan `type === "gene"` → `/entities/gene/{id}`,
   dan longgarkan guard di `app/entity/[type]/[id]/page.tsx`.
7. `handleBackendError` kenal kode error NCBI (429/502/504).

Detail langkah + cara verifikasi: `docs/FRONTEND-PATCH-slice2.md`.

---

## 8. Fitur backend yang BELUM selesai (jujur)

| Fitur | Status | Catatan |
|---|---|---|
| Pencarian nama gen non-manusia | **belum** | nama dibatasi `9606` (manusia); lookup GeneID exact **tidak** dibatasi |
| Filter organisme di UI/API | **belum** | tidak ada parameter `organism` |
| STRING / relasi biologis pihak ketiga | **belum** | di luar slice 2, disepakati untuk slice berikutnya |
| Database / cache / login / Redis | **tidak ada** | sengaja; tanpa persistensi |
| Deadline keras (cancellation in-flight) | **belum** | soft budget 35 s + timeout fase; respons terlambat ditolak, tapi bukan pembatalan |
| Parser `Link` RFC penuh | **belum** | independen urutan parameter + validasi host/path/charset; bukan implementasi RFC lengkap |
| NCBI tanpa API key | batas 3 req/detik | adapter memberi jarak 340 ms |
| 429/5xx/malformed live | **simulasi offline** | jalur happy path sudah live |
| Uji beban / konkurensi / audit keamanan | **belum** | — |
| Teks fungsi protein berbahasa Indonesia | **belum** | UniProt memberi teks Inggris apa adanya |

### Sudah difix pada sesi ini (bukan sisa)

- **Injeksi query NCBI** (baru ditemukan): `q` dulu masuk mentah ke ekspresi
  esearch. `q=TP53[Gene Name] AND 10090[TaxID]` bisa melebarkan filter
  organisme ke gen mencit (GeneID 22059, diverifikasi live). Sekarang input
  user dinetralkan (`build_gene_term()`), satu `[Gene Name]` dan satu
  `[TaxID]` diterapkan backend. Diverifikasi live: query jahat → `[]`.
- Health melaporkan versi salah (`0.1.0` vs `0.2.0`) → sekarang dari `app.version`.
- Gene berulang di halaman 2 saat provider gen habis.
- Offset gen maju pada pencarian protein-only.

---

## 9. Setup lokal

```bash
# backend
cd D:/Projects/MoLearn/backend
uv sync
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# frontend
cd D:/Projects/MoLearn/frontend
npm install
cp .env.example .env.local     # BACKEND_API_URL=http://localhost:8000
npm run dev                    # http://localhost:3000
```

Tidak ada CORS — arsitektur proxy Next.js sudah benar, jangan aktifkan CORS.
Tidak ada DB/auth/Redis.

## 10. Status repo

Backend slice 2 lengkap & terverifikasi, **belum di-commit, belum di-push**
(menunggu persetujuan pemilik repo). Dokumen ini + `HANDOFF-slice2.md` +
`FRONTEND-PATCH-slice2.md` adalah kontrak yang bisa langsung dipakai.
