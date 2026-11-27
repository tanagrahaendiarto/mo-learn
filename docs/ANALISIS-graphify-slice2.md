# ANALISIS — graphify atas repo MoLearn (pasca slice 2)

27 Nov 2026. Read-only analysis + satu perbaikan kecil yang ditemukan saat
verifikasi. Tidak ada commit, tidak ada push, tidak ada file frontend diubah.

## Graph

```text
graphify update .   -> 910 nodes, 1470 edges, 51 communities
Extraction: 95% EXTRACTED, 5% INFERRED, 0% AMBIGUOUS
Import cycles: none
Graph freshness: built from working tree commit 8d8ce54b
```

`graphify label` dijalankan tapi **tidak** menghasilkan nama: tidak ada LLM
backend (GOOGLE_API_KEY tidak diset), jadi nama komunitas tetap
`Community N` / hub-derived. Itu keterbatasan lingkungan, bukan kegagalan kode.

Output: `graphify-out/graph.json`, `graph.html`, `GRAPH_REPORT.md`.

## Arsitektur yang terbaca dari graph

God nodes (paling terhubung): `cn()` 27, `MoLearn` 26/24 (dua dokumen PRD
berbeda), `search_proteins()` 22, `TestUnifiedSearch` 21,
`next_cursor_from_headers()` 19, `is_accession()` 17.

Struktur backend bersih: tiga adapter (`uniprot.py`, `ncbi.py`) + tiga router
(`search.py`, `entities.py`, `genes.py`) + `schemas.py`. Tidak ada import
cycle. `search_proteins()` adalah satu-satunya titik orkestrasi — semua
routing provider lewat situ, sesuai desain.

## TES ULANG (bukti nyata, dijalankan sekarang)

```text
.venv/Scripts/python.exe -m pytest tests/ -q
121 passed, 1 warning in 62.76s        # 103 offline + 18 live, 0 failed, 0 skipped
.venv/Scripts/python.exe -m pytest -m live tests/test_api_live.py -q
18 passed in 40.67s
```

Probe curl langsung ke server hidup (bukan test framework):

| # | Probe | Hasil |
|---|---|---|
| 1 | `GET /api/v1/health` | `version 0.2.0` (lihat temuan 1) |
| 2 | `GET /entities/gene/7157` | TP53, taxid 9606, protein_links 7 entri termasuk P04637 |
| 3 | `search?q=7157` | `exact_geneid`, 1 hasil gene |
| 4 | `search?q=TP53&entity_type=gene` | hanya `ncbi_gene`, hasil gene saja |
| 5 | `search?q=TP53&entity_type=protein` | hanya `uniprot`, 3 hasil |
| 6 | `entity_type=organism` | 422 |
| 7 | `cursor=!!!` | 400 `cursor_invalid` |
| 8 | `/entities/gene/abc` | 422 |

8/8 sesuai kontrak.

## Temuan

### 1. FIXED — `/api/v1/health` melaporkan versi yang salah
Health hardcode `"0.1.0"` sementara app sudah `0.2.0`. Frontend yang memakai
health untuk memastikan backend siap akan salah mengira versi.

Perbaikan: `health.py` membaca `app.version` (satu sumber kebenaran, tidak bisa
melenceng lagi). Tes regresi `test_health_version_matches_openapi` ditambahkan.
Terverifikasi live: `{"status":"ok","service":"molearn-backend","version":"0.2.0"}`.

### 2. DIBLOKIR (bukan bug backend) — proxy Next.js menolak `/entities/gene/`
`frontend/src/app/api/backend/[...path]/route.ts` `isAllowed()` hanya
mengizinkan `/api/v1/health`, `/api/v1/search`, dan
`/api/v1/entities/protein/`. Endpoint gen baru akan dijawab 404 oleh proxy.

Backend sendiri benar (probe 2 & 3 di atas membuktikan). Ini pekerjaan
frontend, dan sesuai instruksi **file frontend tidak disentuh**.

### 3. KESENJANGAN KONTRAK — frontend belum mengenal bentuk respons slice 2
`frontend/src/lib/api.ts` masih mengetik lama:

```ts
match_mode: "exact_accession" | "name";        // slice 2 menambah exact_geneid
provider_status: "available" | "not_found";    // slice 2 menambah "partial"
results: BackendProteinSummary[];
```

`providers[]` belum dikenal sama sekali, dan `api.ts:249` masih hard-code
"Only protein profiles available in slice 1. Gene profiles coming in slice 2."

Dampak bila tidak disesuaikan: respons `partial` akan jatuh ke jalur
`b.status !== "available"` (dianggap gagal), dan hasil `gene` tidak punya
tipe yang benar. **Backend tidak perlu diubah**; frontend harus menyesuaikan
ke `docs/HANDOFF-slice2.md`.

### 4. CATATAN — label komunitas tidak dapat dibuat
Tidak ada LLM backend untuk `graphify label`. Nama komunitas tetap
placeholder. Tidak memblokir apa pun; cukup set `GOOGLE_API_KEY` bila nama
yang terbaca manusia diinginkan.

## Status pekerjaan

- Slice 2 backend: **lengkap dan terverifikasi** (121 tes, 0 failed, 0 skipped).
- Satu bug nyata ditemukan dan diperbaiki saat analisis ini (health version).
- Integrasi frontend slice 2: **belum** — butuh perubahan di sisi frontend
  (allow-list proxy + tipe api.ts), di luar izin sesi ini.
- Belum di-commit, belum di-push.

## File yang berubah pada sesi analisis ini

- `backend/app/routers/health.py` — versi dari `app.version`
- `backend/tests/test_slice2_offline.py` — +1 tes regresi versi
- `docs/ANALISIS-graphify-slice2.md` — laporan ini
- `graphify-out/*` — hasil rebuild (910 nodes)
