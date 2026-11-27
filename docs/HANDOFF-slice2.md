# HANDOFF — backend slice 2 (NCBI Gene + unified search)

27 Nov 2026. Branch lokal `feat/backend-slice2`. **Belum di-commit, belum di-push.**
Slice 1 tetap utuh; tidak ada file frontend yang disentuh.

## Hasil tes (bukti nyata)

```text
.venv/Scripts/python.exe -m pytest tests/ -q
120 passed, 1 warning in 63.18s          # 102 offline + 18 live, 0 failed, 0 skipped

.venv/Scripts/python.exe -m pytest -m live tests/test_api_live.py -q
18 passed in 38.59s                      # live: UniProt + NCBI nyata
```

Warning yang tersisa hanya deprecation Starlette/httpx, sama seperti slice 1.

## Endpoint

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/v1/health` | tidak berubah |
| GET | `/api/v1/search` | **diperluas**: `entity_type` + dua provider |
| GET | `/api/v1/entities/protein/{accession}` | **tidak berubah** |
| GET | `/api/v1/entities/gene/{gene_id}` | **baru** |

### GET /api/v1/search

Parameter: `q` (wajib), `entity_type` = `all|gene|protein` (default `all`),
`cursor`, `page_size` (1-100, default 10).

Routing identifier (prioritas di atas pencarian nama):

| Query | entity_type | Perilaku | match_mode |
|---|---|---|---|
| `7157` | all / gene | exact NCBI GeneID | `exact_geneid` |
| `7157` | protein | hasil kosong (tidak ada fallback diam-diam) | `exact_geneid` |
| `P04637` | all / protein | exact UniProt accession | `exact_accession` |
| `P04637` | gene | hasil kosong | `exact_accession` |
| `TP53` | all | nama di dua provider | `name` |
| `BRCA1` | gene | NCBI saja | `name` |
| `insulin` | protein | UniProt saja | `name` |

### GET /api/v1/entities/gene/{gene_id}

`gene_id` = GeneID numerik positif (mis. `7157`). Field mengikuti
`GeneProfile` di `app/schemas.py`:

- `entity_type` = `"gene"` (konstan)
- `accession` = GeneID sebagai string
- `primary_name` = official symbol (`Gene-ref_locus`)
- `synonyms` / `gene_symbols`
- `organism.scientific_name`, `organism.taxonomy_id`
- `description`, `chromosome`, `gene_type` — **null bila NCBI tidak menyediakan**
- `cross_references[]` = `{namespace, id}` dari `Gene-ref_db`
- `related_proteins[]` = nama protein dari `Entrezgene_prot` (nama saja)
- `protein_links[]` = `{accession, primary_name, gene_symbols, reviewed, source_url, evidence}`
- `source` = `"ncbi_gene"`, `source_url`, `retrieved_at`, `status`

## Contoh respons nyata (observasi live, bukan simulasi)

`GET /api/v1/entities/gene/7157`:
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
  "status": "available",
  "chromosome": "17p13.1",
  "gene_type": "protein-coding",
  "cross_references": [
    {"namespace": "HGNC", "id": "HGNC:11998"},
    {"namespace": "Ensembl", "id": "ENSG00000141510"}
  ],
  "protein_links": [
    {"accession": "P04637", "primary_name": "Cellular tumor antigen p53",
     "reviewed": true, "evidence": "uniprot_geneid_crossref"}
  ]
}
```

`GET /api/v1/search?q=TP53&page_size=3` (live):
```json
{
  "match_mode": "name",
  "provider_status": "available",
  "providers": [
    {"name": "uniprot", "status": "available", "count": 3},
    {"name": "ncbi_gene", "status": "available", "count": 1}
  ],
  "results": [
    {"entity_type": "protein", "accession": "Q9Y2B4", "primary_name": "TP53-target gene 5 protein"},
    {"entity_type": "gene", "accession": "7157", "primary_name": "TP53"},
    {"entity_type": "protein", "accession": "Q9NQ88", "primary_name": "Fructose-2,6-bisphosphatase TIGAR"}
  ]
}
```

## Relasi gene–protein: aturan bukti

**Temuan penting dari probe nyata:** NCBI `Gene-ref_db` untuk 7157 **tidak**
memuat UniProtKB (hanya HGNC, Ensembl, MIM, AllianceGenome). Jadi bukti
tidak bisa diambil dari sisi NCBI.

Bukti yang dipakai (terverifikasi live): UniProtKB P04637 memuat
cross-reference `GeneID: 7157`. Relasi dibangun dengan query
`xref:geneid-<gene_id>` ke UniProt.

- `evidence` selalu `"uniprot_geneid_crossref"`.
- Kecocokan simbol gen **bukan** bukti dan tidak dipakai membuat relasi.
- Bila UniProt gagal, `protein_links` = `[]` dan profil gen tetap 200.
- Satu gen bisa punya banyak protein (one-to-many); live untuk 7157
  mengembalikan lebih dari satu (P04637 reviewed + varian TrEMBL).

## Kontrak cursor

Cursor = base64url dari `{u, n, g}`:
- `u` = token `Link rel="next"` UniProt (state UniProt)
- `n` = offset NCBI (state NCBI)
- `g` = penanda provider gene sudah habis

Frontend **wajib** membuang cursor saat `q`, `entity_type`, atau
`page_size` berubah. Backend tidak me-reset diam-diam.

Dua bug nyata yang ditemukan tes live dan sudah diperbaiki:
1. Provider gene habis di halaman 1 → offset kembali 0 → gen berulang di halaman 2. Diperbaiki dengan penanda `g`.
2. Pencarian protein-only tetap menaikkan offset gene. Diperbaiki: offset hanya maju bila `want_gene`.

`next_cursor = null` berarti tidak ada halaman berikutnya. Header `Link`
UniProt invalid = 502 `upstream_uniprot_malformed_pagination`.

## Status provider & kegagalan

`provider_status` level respons: `available | not_found | partial | error`.

| Kondisi | HTTP | provider_status |
|---|---|---|
| Kedua provider sukses, ada hasil | 200 | `available` |
| Kedua provider sukses, nol hasil | 200 | `not_found` |
| Satu provider gagal, satu sukses | 200 | `partial` |
| Kedua provider gagal | 502/429/504 | — (`provider_error`) |

`providers[]` memberi status per provider (`available`/`not_found`/`error`),
`detail` berisi kode error, `count` jumlah kontribusi. Kegagalan provider
**tidak pernah** disamakan dengan hasil kosong.

Kode error: `upstream_uniprot_error`, `upstream_uniprot_malformed`,
`upstream_uniprot_malformed_pagination`, `upstream_ncbi_error`,
`upstream_ncbi_malformed`, `rate_limited_by_uniprot`,
`rate_limited_by_ncbi`, `upstream_uniprot_timeout`, `upstream_ncbi_timeout`.

## Perubahan kontrak dari slice 1 (perlu penyesuaian frontend)

1. `results[]` kini bisa berisi `entity_type: "gene"`. Frontend harus
   menampilkan badge jenis record sebelum pengguna memilih.
2. `SearchResponse` menambah `providers[]`; `provider_status` menambah
   nilai `partial`.
3. `match_mode` menambah `exact_geneid`.
4. Query numerik `7157` kini dibaca sebagai GeneID, bukan nama.
5. `source_url` mengarah ke domain berbeda per provider (NCBI vs UniProt).
6. Filter `entity_type` tidak pernah melebar; hasil kosong adalah jawaban
   sah, bukan error.

## Setup lokal

```bash
cd D:/Projects/MoLearn/backend
uv sync
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- Docs: `http://127.0.0.1:8000/docs`
- OpenAPI: `http://127.0.0.1:8000/openapi.json` (memuat keempat path)
- Tidak ada CORS (proxy Next.js yang dipakai)
- Tidak ada DB/auth/Redis

Tes:
```bash
.venv/Scripts/python.exe -m pytest tests/ -q -m "not live"   # 102 offline
.venv/Scripts/python.exe -m pytest -m live tests/test_api_live.py -q  # 18 live
```
`conftest.py` memasang transport NCBI yang menolak, jadi tes offline yang
lupa meng-stub NCBI akan gagal keras, bukan diam-diam menembak jaringan.

## Batasan yang diakui

1. **Deadline**: soft total budget (35 s) + timeout fase per request.
   Bukan pembatalan in-flight yang keras. Respons yang mendarat lewat
   budget ditolak, tapi penantian pengguna tidak dijamin < 35 s.
2. **Link parser**: independen urutan parameter + validasi host/path/charset.
   Bukan implementasi RFC penuh.
3. **NCBI**: 3 req/detik tanpa API key (spacing 340 ms di adapter).
   Melebihi itu dapat 429.
4. **Pencarian nama NCBI dibatasi ke gen manusia (taxid 9606)** karena
   belum ada filter organisme di UI. Lookup GeneID exact tidak dibatasi.
5. **NCBI mengirim XML**, bukan JSON; field yang tidak ada menjadi null,
   tidak pernah diisi tebakan.
6. 429/5xx/malformed adalah simulasi offline; jalur happy path live.
7. Belum ada uji beban, konkurensi, atau audit keamanan.
8. **Belum di-commit / di-push.** Menunggu persetujuan.

## File yang berubah

- `app/adapters/ncbi.py` — baru, adapter E-utilities
- `app/routers/genes.py` — baru, profil gen + protein_links
- `app/routers/search.py` — ditulis ulang: entity_type, routing, partial, cursor
- `app/schemas.py` — GeneSummary, GeneProfile, ProteinLink, ProviderStatus
- `app/main.py` — router genes + versi 0.2.0
- `conftest.py` — guard NCBI offline
- `tests/test_slice2_offline.py` — baru, 41 tes
- `tests/test_api_live.py` — diperluas ke 18 tes (5 lama + 13 baru)
- `tests/test_offline.py` — 19 request diberi `entity_type=protein`
  (tes slice 1 menguji semantik protein-only)
- `tests/fixtures/ncbi_gene_7157.xml` — rekaman asli, dipangkas dari 34 MB
- `tests/fixtures/ncbi_esearch_tp53.json` — rekaman asli
