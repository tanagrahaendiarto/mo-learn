# FRONTEND-HANDOFF — slice 1 (demo lokal)

27 Nov 2026. Backend: FastAPI, satu provider (UniProt), tanpa DB/auth/Redis.
Cocok untuk demo lokal; belum disetujui untuk deployment publik.

## Menjalankan backend

```bash
cd D:/Projects/MoLearn/backend
uv sync                          # pertama kali saja
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health: `http://127.0.0.1:8000/api/v1/health`
Docs interaktif: `http://127.0.0.1:8000/docs`
OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

Versi spesifikasi OpenAPI: `0.1.0`
Server hanya bind `127.0.0.1` (lokal). Tidak ada CORS diaktifkan saat ini.

## Catatan penting tentang alamat

`127.0.0.1` pada laptop ini = laptop milik penulis backend.
Teman frontend menjalankannya di laptop mereka sendiri, jadi `127.0.0.1`
mengacu ke mesin masing-masing. Berbagi akses lintas mesin butuh cara
yang disepakati terpisah (hosting/sharable tunnel).

## CORS atau proxy — belum disepakati

Pilihan integrasi masih terbuka. Keduanya butuh keputusan sebelum wiring:

1. **Browser langsung**: backend mengaktifkan CORS untuk origin frontend.
   Belum diaktifkan. Perlu daftar origin yang disetujui; jangan aktifkan
   sembarang. Perubahan terbatas di `app/main.py`.

2. **Next.js server-side proxy**: frontend memanggil route handler Next.js
   sendiri, yang meneruskan ke backend lokal. Backend tidak perlu CORS.
   Lebih rapi untuk demo lokal; pertahankan privasi token/source.

Pilih salah satu; jangan aktifkan keduanya tanpa diskusi.

## Endpoint

### GET /api/v1/search

Query: `q` (wajib), `page_size` (default 10, maks 100), `cursor` (opsional).

`q` dianggap accession jika cocok sintaks UniProtKB, selain itu jadi
pencarian nama (dialiri `protein_name:"..."`). Panjang maksimum 100 karakter.

Contoh:
```
GET /api/v1/search?q=p53&page_size=2
GET /api/v1/search?q=P04637
GET /api/v1/search?q=p53&page_size=2&cursor=<next_cursor dari respons sebelumnya>
```

Respons sukses (200):
```json
{
  "query": "p53",
  "match_mode": "name",
  "results": [
    {
      "entity_type": "protein",
      "accession": "P04637",
      "primary_name": "Cellular tumor antigen p53",
      "synonyms": ["Antigen NY-CO-13", "p53"],
      "gene_symbols": ["TP53"],
      "organism": {"scientific_name": "Homo sapiens", "taxonomy_id": 9606},
      "reviewed": true,
      "source": "uniprot",
      "source_url": "https://www.uniprot.org/uniprotkb/P04637",
      "retrieved_at": "2026-11-27T04:00:00Z",
      "status": "available"
    }
  ],
  "next_cursor": "88d67348nieo4gt1awea8zcml7pelfbotz",
  "provider_status": "available"
}
```

Respons kosong (hasil biologis memang kosong, bukan error) — 200:
```json
{
  "query": "A1B2C3",
  "match_mode": "exact_accession",
  "results": [],
  "next_cursor": null,
  "provider_status": "not_found"
}
```

Respons error (pilih salah satu yang relevan):

400 bad_request — `q` kosong:
```json
{"status": "bad_request", "detail": "query_too_long"}
```

400 bad_request — cursor tidak valid:
```json
{"status": "bad_request", "detail": "cursor_invalid"}
```

422 — format `q` tidak cocok sintaks accession dan kosong:
```json
{"detail": "q must not be empty or whitespace"}
```

429 rate limited — header `Retry-After` dari UniProt dihormati jika ≤3 detik:
```json
{"status": "provider_error", "detail": "rate_limited_by_uniprot"}
```

502 provider error — upstream 4xx/5xx/transport/malformed JSON:
```json
{"status": "provider_error", "detail": "upstream_uniprot_error"}
{"status": "provider_error", "detail": "upstream_uniprot_malformed"}
{"status": "provider_error", "detail": "upstream_uniprot_malformed_pagination"}
```

504 timeout — total budget 35 detik tercapai:
```json
{"status": "provider_error", "detail": "upstream_uniprot_timeout"}
```

### GET /api/v1/entities/protein/{accession}

Profil protein tunggal. Accession harus cocok sintaks UniProtKB.

Contoh:
```
GET /api/v1/entities/protein/P04637
GET /api/v1/entities/protein/A0A024RBG1
```

Respons sukses (200) — `ProteinProfile` (menurun dari `ProteinSummary`):
```json
{
  "entity_type": "protein",
  "accession": "P04637",
  "primary_name": "Cellular tumor antigen p53",
  "synonyms": ["Antigen NY-CO-13"],
  "gene_symbols": ["TP53"],
  "organism": {"scientific_name": "Homo sapiens", "taxonomy_id": 9606},
  "reviewed": true,
  "source": "uniprot",
  "source_url": "https://www.uniprot.org/uniprotkb/P04637",
  "retrieved_at": "2026-11-27T04:00:00Z",
  "status": "available",
  "gene_crossrefs": [
    {"namespace": "GeneID", "id": "7157"},
    {"namespace": "HGNC", "id": "HGNC:11998"}
  ],
  "length": 393,
  "function_annotations": [
    "Multifunctional transcription factor..."
  ]
}
```

Respons not found (404):
```json
{"status": "not_found", "detail": "protein_not_found"}
```

Respons 422 (accession salah format):
```json
{"detail": "invalid accession: expected 6 or 10 chars per the official UniProtKB syntax, e.g. P04637 or A0A024RBG1 (see /uniprot.org/help/accession_numbers)"}
```

Error 429/502/504 sama seperti search.

## Pagination

`next_cursor` hanya dari header `Link: rel="next"` respons UniProt.
Frontend WAJIB membuang cursor saat `q` atau `page_size` berubah.
Backend meneruskan apa adanya — tidak ada reset diam-diam.

Alur yang benar:
1. `GET /api/v1/search?q=p53&page_size=2` → baca `next_cursor`
2. `GET /api/v1/search?q=p53&page_size=2&cursor=<next_cursor>` → halaman 2
3. Jika user ubah `q` atau `page_size` → abaikan cursor lama, mulai dari halaman 1

Respons tanpa header `Link` = akhir hasil (`next_cursor: null`, `provider_status: "not_found"`).
Header `Link` invalid (host/path salah) = 502 `upstream_uniprot_malformed_pagination`.

## Batas dan keterbatasan yang harus diketahui frontend

- Deadline total per panggilan provider = 35 detik (soft budget). Bukan
  hard cancellation in-flight. httpx timeout bersifat fase/inaktivitas;
  respons lambat yang mendarat melewati budget ditolak, tapi tidak ada
  cancel di tengah-tengah stream.
- Status `reviewed` diambil dari field `entryType` UniProt, bukan dari
  panjang accession. Panjang 6 atau 10 karakter tidak menyiratkan reviewed
  atau unreviewed.
- Happy path live: pencarian, profil, dan pagination 2 halaman teruji
  langsung ke UniProt. Error jaringan (429/5xx/malformed) masih simulasi.
- Belum ada autentikasi, rate limiting per-user, atau caching di backend.
- Source URL selalu `https://www.uniprot.org/uniprotkb/{accession}`.
  Backend tidak memverifikasi eksternal terhadap URL lain.

## Keputusan yang perlu disepakati

| Topik | Pilihan | Keputusan yang dibutuhkan |
|---|---|---|
| CORS vs proxy | Aktifkan CORS terbatas / Next.js route handler | Pilih satu sebelum wiring frontend |
| Bahasa UI | Indonesia atau Inggris | Konsisten di semua layar |
| Fallback offline | Seed JSON lokal vs error message | Ditentukan di PRD P1 |
| Panjang halaman default | 10 (saat ini) atau lain | Sepakati sebelum integrasi |
