# REVIEW — Koreksi putaran 1 (ringkasan)

Tanggal: 27 Nov 2026. Rancangan direview, koreksi terarah (bukan desain ulang).
Lihat `PROBE-uniprot-p04637.md` untuk bukti probe. Lihat `DESIGN-backend-slice1.md` untuk kontrak lengkap yang sudah diperbarui.

## Koreksi yang dilakukan
| Item | Sebelum | Sesudah |
|---|---|---|
| Search UniProt | "terblokir proxy/mitm, tak terverifikasi" | **Jalan 200 di lingkungan ini** — akar: path lama `/uniprotkb?query=` (301→:8080 mati), path benar `/uniprotkb/search?query=` |
| `primary_name` P04637 | "p53 tumor protein 21 kDa" (salah) | **"Cellular tumor antigen p53"** (dari `recommendedName.fullName.value` nyata) |
| `synonyms` | `["p53"]` (salah) | `["Antigen NY-CO-13","Phosphoprotein p53","Tumor suppressor p53"]` (dari `alternativeNames`) |
| `taxonomy_id` | `null` (salah — salah baca key) | **9606** (dari `organism.taxonId`); `taxonomyId` memang tak ada di payload → tetap nullable di kontrak |
| `proteinDescription` | di-read sebagai array `[0]` | **object/dict** — akses `.recommendedName.fullName.value`, `.alternativeNames[*]` |
| Gene xref | `NCBI-Gene` (asumsi, tak terbukti) | **`GeneID` + `HGNC`** (terkonfirmasi di payload); `NCBI-Gene` tak ada |
| Pagination | `page` (number) | **`cursor` (opaque) + `page_size`**; `next_cursor: null` saat habis |
| Cursor user | tak diatur | User cursor **bukan** URL arbitrer — backend validasi & kendalikan host/path UniProt sendiri |
| Status | tidak konsisten | Diseragam: `available`, `partial`, `not_found`, `provider_error` |
| 1 provider | klaim "fallback antar-provider" (PRD §8.2) | **Dicabut** — slice 1 = 1 provider, tak ada fallback |
| Exact accession | tak dijelaskan | Exact accession didahulukan; hasil pencarian nama **tidak otomatis dianggap record terpilih** |
| Tes offline | tes schema saja | Tes **adapter + endpoint** (fixture nyata UniProt, bukan simulasi buatan) |
| Tes live | "skip bila offline" | **Eksplisit** — accession, nama, profil diuji terpisah; gagal/skip → `LIVE-UNVERIFIED` |

## Kontrak API konsisten (ringkas)
- `GET /api/v1/health` → `{status:"ok"}`
- `GET /api/v1/search?q&cursor&page_size` → `{query, match_mode, results[], next_cursor, provider_status}`
- `GET /api/v1/entities/protein/{accession}` → `{accession, entity_type, primary_name, synonyms[], gene_symbols[], gene_crossrefs[], organism{scientific_name,taxonomy_id}, length, reviewed, function_annotations[], source, source_url, retrieved_at, status}`

HTTP: 200 (found/empty-not_found), 400 (query/cursor ilegal), 404 (404 tidak — 200 + `not_found`), 422 (Pydantic), 429 (rate limit Uniprot), 502 (Uniprot error).

## Hambatan masih nyata
1. `cursor=*` → 500 Uniprot — re-verify saat implementasi; fallback `next_cursor=null`.
2. Akses tulis repo publik belum diverifikasi oleh reviewer — jangan `git init`/push.
3. Namespace `NCBI-Gene` tak ada di payload — filter pakai `GeneID` + `HGNC` yang terkonfirmasi.
4. `taxonomy_id` nullable — kontrak wajib handle null (record lain bisa tak ada `taxonId`).

## Keputusan yang diterima
- `uv` + venv terisolasi: ✅
- Scope protein UniProt saja: ✅
- Backend di `D:/Projects/MoLearn` (konsep): ✅ — **jangan git init/clone/commit/push dulu**
