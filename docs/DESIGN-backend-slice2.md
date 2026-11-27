# DESIGN — backend slice 2 (NCBI Gene + gene/protein disambiguation)

27 Nov 2026. Rancangan untuk persetujuan; belum ada perubahan kode.
Slice 1 diterima untuk demo lokal. Slice 2 menambahkan NCBI Gene
sebagai provider kedua dan memperkenalkan entity_type "gene" selain
"protein". Hubungan gene-protein hanya dari cross-reference sumber,
bukan inferensi lokal.

## Scope

- Pencarian lintas provider (NCBI Gene + UniProtKB protein).
- Profil gen (NCBI Gene) dan profil protein (UniProtKB, yang sudah ada).
- Disambiguasi awal: hasil pencarian menampilkan jenis record, organisme,
  dan identifier utama agar pengguna tidak menyangka gen dan protein
  dengan nama mirip adalah entitas sama.
- Hubungan gene-protein: ditampilkan bila sumber menyediakan cross-ref
  (mis. GeneID ↔ UniProt). Backend tidak menciptakan relasi baru di luar
  yang disediakan sumber.

## Tidak diubah

- Endpoint protein slice 1 tetap sama (`/api/v1/entities/protein/{accession}`).
- Format respons protein tidak berubah.
- Stateless, tanpa DB/auth/Redis.

## Sumber resmi

| Entity | Sumber | Endpoint | Format |
|---|---|---|---|
| Protein | UniProtKB | `https://rest.uniprot.org/uniprotkb/{accession}.json` | JSON (slice 1) |
| Gene | NCBI Gene (E-utilities) | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi` + `efetch.fcgi` | XML (NCBI standar) |

NCBI E-utilities: publik, tanpa key untuk penggunaan ringan.
Batasi request rate sesuai dokumentasi NCBI (≤3 req/detik tanpa API key).
Tidak ada autentikasi, OAuth, atau kredensial baru.

## Kontrak API

### GET /api/v1/search (diperluas)

Query: `q` (wajib), `page_size` (default 10, maks 100), `cursor` (opsional),
`entity_type` (opsional filter: "all", "gene", "protein").

Respons 200:
```json
{
  "query": "p53",
  "match_mode": "name",
  "results": [
    {
      "entity_type": "protein",
      "accession": "P04637",
      "primary_name": "Cellular tumor antigen p53",
      "gene_symbols": ["TP53"],
      "organism": {"scientific_name": "Homo sapiens", "taxonomy_id": 9606},
      "source": "uniprot",
      "source_url": "https://www.uniprot.org/uniprotkb/P04637",
      "retrieved_at": "...",
      "status": "available"
    },
    {
      "entity_type": "gene",
      "accession": "7157",
      "primary_name": "TP53",
      "synonyms": ["p53", "LFS1"],
      "gene_symbols": ["TP53"],
      "organism": {"scientific_name": "Homo sapiens", "taxonomy_id": 9606},
      "source": "ncbi_gene",
      "source_url": "https://www.ncbi.nlm.nih.gov/gene/7157",
      "retrieved_at": "...",
      "status": "available"
    }
  ],
  "next_cursor": "...",
  "provider_status": "available"
}
```

Perubahan dari slice 1:
- `results` kini bisa berisi entity_type "gene" atau "protein".
- `accession` tetap menjadi identifier utama (UniProt accession untuk
  protein, NCBI GeneID untuk gene).
- `source` menunjukkan provider asal.
- Filter `entity_type` opsional untuk frontend yang ingin menyaring.

### GET /api/v1/entities/protein/{accession} (tidak berubah)

Respons sama seperti slice 1.

### GET /api/v1/entities/gene/{gene_id} (baru)

Path: `gene_id` = NCBI GeneID numerik (string atau integer).

Respons 200:
```json
{
  "entity_type": "gene",
  "accession": "7157",
  "primary_name": "TP53",
  "synonyms": ["p53", "LFS1"],
  "gene_symbols": ["TP53"],
  "organism": {"scientific_name": "Homo sapiens", "taxonomy_id": 9606},
  "source": "ncbi_gene",
  "source_url": "https://www.ncbi.nlm.nih.gov/gene/7157",
  "retrieved_at": "...",
  "status": "available",
  "description": "This gene encodes a tumor suppressor protein...",
  "chromosome": "17p13.1",
  "map_location": "17p13.1",
  "gene_type": "protein-coding",
  "cross_references": [
    {"namespace": "UniProtKB", "id": "P04637"},
    {"namespace": "HGNC", "id": "HGNC:11998"}
  ]
}
```

Respons 404:
```json
{"status": "not_found", "detail": "gene_not_found"}
```

Respons 422 (format GeneID salah — bukan digit):
```json
{"detail": "invalid gene_id: expected a numeric NCBI GeneID"}
```

### GET /api/v1/entities/{type}/{id} (alternatif, untuk pertimbangan)

Alih-alih dua route terpisah, satu route generik:
- `/api/v1/entities/protein/P04637`
- `/api/v1/entities/gene/7157`

Keuntungan: satu handler, konsisten. Kerugian: FastAPI path converter
tidak bisa membedakan `P04637` vs `7157` tanpa logika custom; file
`protein` vs `gene` bisa membingungkan routing.

Rekomendasi: tetap gunakan dua route eksplisit untuk kejelasan.

## Pencarian lintas provider

Query dipecah:
1. Jika `q` cocok sintaks accession UniProtKB → route ke UniProt
   (tidak berubah dari slice 1).
2. Jika `q` adalah digit murni (potensi GeneID) → coba NCBI Gene
   terlebih dahulu, fallback ke UniProt jika tidak ditemukan.
3. Nama/simbol/aliasi → paralel ke NCBI Gene dan UniProt, gabung hasil,
   hilangkan duplikat berdasarkan identifier yang diketahui.

Pagination: NCBI E-utilities tidak mengirim `Link: rel="next"`.
Solusi: gunakan `count` + `retstart` dalam query, buat `next_cursor`
internal berbasis offset. Batasi traversal; frontend harus tidak
mengandalkan cursor untuk sesi panjang tanpa restart eksplisit.

## Disambiguasi gene-protein

Kriteria pembeda:
- `entity_type`: "gene" (NCBI) vs "protein" (UniProt).
- `source`: "ncbi_gene" vs "uniprot".
- `source_url`: domain berbeda (`ncbi.nlm.nih.gov/gene/` vs
  `uniprot.org/uniprotkb/`).
- `cross_references`: profil gen menyertakan referensi UniProt bila
  ada, dan sebaliknya.

Backend tidak menyatukan gen dan protein dalam satu record. Jika nama
sama (mis. `INS`), keduanya muncul sebagai hasil terpisah dengan label
yang jelas. Hubung-kan hanya jika sumber menyediakan cross-ref
(tercatat di `cross_references`), bukan karena nama/ simbol mirip.

Frontend yang bertanggung jawab menampilkan jenis record secara visual
(ikon, warna, label) sebelum pengguna membuka profil.

## Kondisi gagal

| Kondisi | Kode | Detail |
|---|---|---|
| Upstream NCBI 4xx/5xx/XML rusak | 502 | `upstream_ncbi_error`, `upstream_ncbi_malformed` |
| NCBI timeout (total budget) | 504 | `upstream_ncbi_timeout` |
| NCBI rate limit (429/Too Many Requests) | 429 | `rate_limited_by_ncbi` |
| NCBI result kosong ( genuinely empty ) | 200 | `provider_status: "not_found"` |
| GeneID format salah | 422 | `invalid gene_id` |
| Cross-reference tidak ada | — | `cross_references: []` (bukan error) |

## Tes penerimaan

- Offline: fixture NCBI XML + transport simulasi (mirip slice 1).
- Live (maks 2 halaman): NCBI GeneID 7157 (TP53) dan 3630 (INS).
- Regresi slice 1 tetap hijau (34 offline + 5 live).
- Regresi tambahan slice 2:
  - Search `7157` → gene ditemukan dengan `entity_type: "gene"`.
  - Search `INS` → gen dan protein sebagai hasil terpisah.
  - Profil gen `/api/v1/entities/gene/7157` → 200, field dasar terisi.
  - NCBI timeout → 504.
  - NCBI malformed XML → 502.

## Perubahan kontrak yang perlu disepakati dengan frontend

1. **`results` kini campuran**: frontend harus menampilkan label jenis
   record (`entity_type`) dan source URL sebelum pengguna memilih.
2. **Filter entity_type**: opsional tapi direkomendasikan untuk UX.
3. **Source URL berbeda per provider**: klik harus membuka domain yang
   benar (NCBI vs UniProt).
4. **Paginasi cursor berubah**: NCBI menggunakan offset-based; backend
   menyusun `next_cursor` internal. Frontend tetap memakai `next_cursor`
   seperti sebelumnya, tapi jangan mengandalkan stabilitas token
   antar versi backend.
5. **Error 429/502/504 kini bisa berasal dari NCBI atau UniProt**:
   frontend menampilkan pesan generik, tidak menyebut nama provider
   kecuali untuk debugging.

## Batas yang diakui

- NCBI E-utilities tanpa API key: batas rate 3 req/detik; overload
  menghasilkan 429. Tidak ada retry永续.
- NCBI balas XML, bukan JSON: parsing ditambahkan, tapi field opsional
  yang tidak ada di XML akan menjadi null.
- Tidak ada normalisasi nama antar provider. Gen "INS" dan protein
  "insulin" tetap sebagai record terpisah kecuali ada cross-ref
  eksplisit.
- CORS/proxy belum diputuskan (lihat FRONTEND-HANDOFF-slice1.md).
- Tidak ada database: cross-reference hanya dari respons langsung
  sumber, tidak di-cache atau di-enrich lokal.

## Pertanyaan untuk persetujuan

1. Apakah NCBI GeneID numerik (mis. `7157`) dianggap valid identifier
   di field `q` pencarian, atau hanya nama/simbol?
2. Apakah frontend ingin filter `entity_type` default ke "all" atau
   "protein" (mempertahankan behavior slice 1)?
3. Apakah ada source ketiga yang diinginkan selain NCBI Gene dan
   UniProtKB untuk slice 2?
4. Apakah NCBI rate limit (429) harus ditampilkan sebagai pesan user-
   friendly atau objek `provider_error` standar?
