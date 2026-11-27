# MoLearn Backend — Rancangan Slice 1 (UniProt Search + Protein Profil)

Status: **RANCANGAN** — belum diimplementasi. Menunggu persetujuan.
Revisi: 27 Nov 2026 (koreksi putaran 1 pasca-review).
Semua nilai di bawah hasil probe read-only nyata di lingkungan ini.

## 1. Lingkungan & akses terverifikasi

| Item | Status |
|---|---|
| `D:/Projects/MoLearn` | Ada. Isi `docs/` (PRD v0.3–v1.1, review doc). Bukan repo Git. Belum ada `backend/`. |
| `python` (PATH) | 3.11.16 (venv Hermes) |
| `uv` | 0.12.13 → venv terisolasi proyek |
| `git` / `gh` | 2.56.1 / 2.104.0, login `SirZannn`, scope `repo` |
| Repo `tanagrahaendiarto/mo-learn` | **PUBLIK**, **KOSONG** (tak ada file, tak ada default branch) |

> ⚠️ **Catatan akses**: penempatan backend di `D:/Projects/MoLearn` disetujui secara konsep, tapi **scope token `repo` TIDAK membuktikan izin tulis**. Status "publik/kosong" dan akses tulis **belum diverifikasi** oleh reviewer. Jangan `git init`, clone, commit, atau push dulu.

## 2. Probe UniProt (data publik nyata, di lingkungan ini)

| URL | HTTP | Catatan |
|---|---|---|
| `GET /uniprotkb/P04637.json` | **200** | ~848 KB |
| `GET /uniprotkb/search?query=accession%3AP04637&format=json&size=1` | **200** | 1 hasil, ~848 KB |
| `GET /uniprotkb/search?query=protein_name%3A%22p53%22%20AND%20organism_id%3A%229606%22&format=json&size=5` | **200** | 5 hasil |
| `GET /uniprotkb/search?...&cursor=*` | **500** | `{"messages":["Internal server error"]}` — 2× ulangan, konsisten |

### Koreksi dari rancangan awal

1. **Search TIDAK rusak di jaringan ini.** Probe awal (giliran 1) memakai path **`/uniprotkb?query=`** (endpoint lama) yang 301-redirect ke `:8080` mati. Endpoint yang benar adalah **`/uniprotkb/search?query=`** → HTTP 200. Kesimpulan "proxy/mitm" dari rancangan awal **dicabut**: akar penyebabnya path yang salah, bukan gangguan jaringan.
2. **`cursor=*` memberi HTTP 500** secara konsisten (2 percobaan). **Gejala nyata, akar belum diketahui.** Jangan asumsikan format token-nya. Saat implementasi: verifikasi ulang; bila tetap 500, backend tetap menerbitkan `next_cursor` di kontrak API sendiri dan handle `next_cursor = null` bila UniProt tak memberi token.
3. `organism.taxonId = 9606` di record P04637 (bukan null — `taxonomyId` memang tak ada di payload; `taxonId` yang benar ada & terpopulasi).
4. **`proteinDescription` adalah object (dict), bukan array.** `recommendedName.fullName.value`, `alternativeNames[*].fullName.value`, `genes[*].geneName.value`, `comments[commentType==FUNCTION].texts[*].value` — semua terkonfirmasi dari payload nyata.

### Mapping nyata P04637 (dari payload 200)

| Field UniProt nyata | Nilai nyata | → field kontrak MoLearn |
|---|---|---|
| `primaryAccession` | `P04637` | `accession` |
| `entryType` | `UniProtKB reviewed (Swiss-Prot)` | `reviewed: true` |
| `organism.scientificName` | `Homo sapiens` | `organism.scientific_name` |
| `organism.taxonId` | `9606` | `organism.taxonomy_id` (nullable — bisa hilang di record lain) |
| `proteinDescription.recommendedName.fullName.value` | `Cellular tumor antigen p53` | `primary_name` |
| `proteinDescription.alternativeNames[*].fullName.value` | `Antigen NY-CO-13`, `Phosphoprotein p53`, `Tumor suppressor p53` | `synonyms` |
| `genes[*].geneName.value` | `TP53` | `gene_symbols` |
| `comments[commentType=FUNCTION].texts[*].value` | `Multifunctional transcription factor…` | `function_annotations` |
| `sequence.length` | `393` | `length` |
| `uniProtKBCrossReferences` | Namespace terkonfirmasi di payload P04637: **`GeneID`** (id=`7157`), **`HGNC`** (id=`HGNC:11998`). Namespace `NCBI-Gene` **TIDAK ADA** di payload ini. | `gene_crossrefs` |

## 3. Kontrak API (konsisten, siap review)

Prefix `/api/v1`. Slice 1: protein via UniProt, **satu provider, tidak ada klaim fallback antar-provider**.

### `GET /api/v1/health`
```jsonc
{ "status": "ok", "service": "molearn-backend", "version": "0.1.0" }
```

### `GET /api/v1/search?q=<query>&cursor=<opaque>&page_size=<int>`

Param:
- `q` — string, wajib. Bisa accession (`P04637`) atau nama (`p53`).
- `cursor` — string, opsional, **opaque**. Diterbitkan backend; pengguna **tidak** boleh pakai untuk menentukan URL UniProt. Backend hanya meneruskan `cursor` ke UniProt setelah memvalidasi formatnya (bukan URL arbitrer).
- `page_size` — int, default `10`, min `1`, maks `100`.
- **Tidak ada param `page`.**

Respons:
```jsonc
{
  "query": "p53",
  "match_mode": "name",
  "results": [
    {
      "entity_type": "protein",
      "accession": "P04637",
      "primary_name": "Cellular tumor antigen p53",
      "synonyms": ["Antigen NY-CO-13", "Phosphoprotein p53", "Tumor suppressor p53"],
      "gene_symbols": ["TP53"],
      "organism": { "scientific_name": "Homo sapiens", "taxonomy_id": 9606 },
      "reviewed": true,
      "source": "uniprot",
      "source_url": "https://www.uniprot.org/uniprotkb/P04637",
      "retrieved_at": "2026-11-27T04:00:00Z",
      "status": "available"
    }
  ],
  "next_cursor": null,
  "provider_status": "available"
}
```

`match_mode`: `"exact_accession"` bila `q` cocok pola accession UniProt dan retrieve direct berhasil; `"name"` bila query diteruskan sebagai text search. Hasil pencarian nama **tidak otomatis dianggap record terpilih** — pengguna harus membuka profil secara eksplisit.

Aturan perilaku:

| Kasus | HTTP | `provider_status` | Catatan |
|---|---|---|---|
| Query valid, hasil ada | 200 | `available` | `next_cursor` null bila habis |
| Query valid, hasil kosong | 200 | `not_found` | Data kosong ≠ error |
| `q` kosong / tak ada | 422 | — | Pydantic validasi |
| `q` format ilegal utk UniProt | 400 | — | Ditolak di adapter |
| UniProt timeout / 5xx setelah retry | 502 | `provider_error` | Body: `{"detail":"upstream_uniprot_error"}` |
| UniProt 429 | 429 | `provider_error` | Body: `{"detail":"rate_limited_by_uniprot"}` — tak auto-retry tanpa `Retry-After` |
| `cursor` user = URL arbitrer / format tak dikenal | 400 | — | Ditolak; backend tak memakai `cursor` user utk bangun URL UniProt |

**Pagination & cursor**: UniProt mengembalikan `cursor` per item (token opaque). Backend meneruskan `cursor` item terakhir sebagai `next_cursor`. Jika UniProt tak memberi token (mis. 500), `next_cursor = null` — backend **tidak mengarang** cursor.

### `GET /api/v1/entities/protein/{accession}`

```jsonc
{
  "accession": "P04637",
  "entity_type": "protein",
  "primary_name": "Cellular tumor antigen p53",
  "synonyms": ["Antigen NY-CO-13", "Phosphoprotein p53", "Tumor suppressor p53"],
  "gene_symbols": ["TP53"],
  "gene_crossrefs": [
    { "namespace": "GeneID", "id": "7157" },
    { "namespace": "HGNC",   "id": "HGNC:11998" }
  ],
  "organism": { "scientific_name": "Homo sapiens", "taxonomy_id": 9606 },
  "length": 393,
  "reviewed": true,
  "function_annotations": [
    "Multifunctional transcription factor that induces cell cycle arrest, DNA repair or apoptosis upon binding to its target DNA sequence (PubMed:11025664, ...)"
  ],
  "source": "uniprot",
  "source_url": "https://rest.uniprot.org/uniprotkb/P04637.json",
  "retrieved_at": "2026-11-27T04:00:00Z",
  "status": "available"
}
```

| Kasus | HTTP | Body / `status` |
|---|---|---|
| Accession valid, record ada | 200 | `status: "available"` |
| Accession tak ditemukan (UniProt 404) | 200 | `status: "not_found"` — data kosong ≠ error |
| Accession format ilegal | 422 | Pydantic |
| UniProt timeout / 5xx setelah retry | 502 | `{"status":"provider_error","detail":"upstream_uniprot_error"}` |
| UniProt 429 | 429 | `{"status":"provider_error","detail":"rate_limited_by_uniprot"}` |

Timeout/retry: 20 s per call, **1 retry** untuk 5xx/timeout. 429 tak di-retry tanpa `Retry-After`.

### Field `gene_crossrefs`
Diambil dari `uniProtKBCrossReferences`. Namespace terkonfirmasi di payload P04637: `GeneID`, `HGNC`. Namespace `NCBI-Gene` **tidak ditemukan** — jangan hardcode. Adapter filter:
```python
gene_xrefs = [x for x in record["uniProtKBCrossReferences"]
             if x["database"] in ("GeneID", "HGNC")]
```
Bila namespace lain ditemukan di record lain, extend daftar — jangan asumsikan.

## 4. Struktur file & depen (diperbarui)
```
D:/Projects/MoLearn/backend/
  app/__init__.py
  app/main.py             # FastAPI app, mount router, /docs aktif
  app/routers/health.py
  app/routers/search.py
  app/routers/entities.py
  app/adapters/uniprot.py # httpx: search+retrieve, timeout 20s, 1 retry 5xx
  app/schemas.py          # model Pydantic = kontrak stabil utk frontend
  tests/fixtures/         # JSON hasil nyata UniProt (P04637.json, search_p53.json)
  tests/test_adapter.py   # OFFLINE: fixture nyata → klaim mapping
  tests/test_search.py    # OFFLINE: query valid/invalid/empty/429/timeout
  tests/test_entities.py  # OFFLINE: 200/404/format-invalid
  tests/test_api_live.py  # LIVE (eksplisit): hit UniProt, skip bila offline
  pyproject.toml          # fastapi, uvicorn[standard], httpx, pytest
  README.md
```
Depen minimal: `fastapi`, `uvicorn[standard]`, `httpx`, `pytest`. Venv via `uv`. Versi tak dikunci. Tanpa Redis, login, microservices, chatbot.

**Database**: slice 1 stateless — tak butuh PostgreSQL. Kebutuhan database di slice berikutnya **diputuskan nanti**, bukan diasumsikan.

## 5. Rencana pengujian (diperbarui)

**Offline (fixture nyata dari UniProt, bukan simulasi buatan):**
- `tests/fixtures/P04637.json` = salinan respons `GET /uniprotkb/P04637.json` (HTTP 200, di-dump saat probe, 27 Nov 2026).
- `tests/fixtures/search_p53.json` = salinan respons search nama (HTTP 200).
- Tes offline: adapter + endpoint (bukan hanya schema) — klaim mapping P04637, field opsional hilang, query invalid (422), hasil kosong (200 `not_found`), 404, 429, timeout, 5xx, pagination (`next_cursor` null vs token).

**Live (`test_api_live.py`, dijalankan eksplisit):**
- Mencakup: (1) retrieve accession P04637, (2) search nama `p53` + organism 9606, (3) profil P04637.
- Satu hasil accession **bukan** bukti search nama lulus — keduanya diuji terpisah.
- Jika live test gagal / di-skip → integrasi tetap berstatus **belum terverifikasi**. Label di output: `[LIVE-UNVERIFIED]` atau `[LIVE-OK]`.

## 6. Hambatan & keputusan yang masih nyata

| # | Item | Status |
|---|---|---|
| 1 | Penempatan `backend/` di `D:/Projects/MoLearn` | ✅ Disetujui konsep; jangan `git init`/clone/commit/push dulu |
| 2 | Accession & nama search UniProt | ✅ Terkonfirmasi 200 di lingkungan ini |
| 3 | `cursor=*` → HTTP 500 | ⚠️ Gejala nyata, akar belum diketahui; verifikasi lagi saat implementasi |
| 4 | Namespace `NCBI-Gene` | ❌ Tidak ada di payload; pakai `GeneID` + `HGNC` yang terkonfirmasi |
| 5 | Akses tulis ke repo publik | ⚠️ Belum diverifikasi; jangan asumsikan dari scope token `repo` |
| 6 | Interpreter proyek: `uv` | ✅ Disetujui |
| 7 | Scope protein UniProt saja, NCBI Gene menyusul | ✅ Disetujui |
| 8 | Skill saat implementasi | TDD, graphify, systematic-debugging, verification-before-completion, requesting-code-review + github |
