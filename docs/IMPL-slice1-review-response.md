# IMPL — Respons koreksi review independen slice 1

Status: **SEMUA TEMUAN HIGH & MEDIUM SUDAH DITANGGAPI & TERUJI.** 27 Nov 2026 (sesi lanjutan).
Menyusul `IMPL-slice1.md`. Review: `docs/REVIEW-slice1-independent.md` + probe `docs/review_slice1_checks.py`.
File baru, riwayat tidak ditimpa. Server di-restart dengan kode baru (PID lama di-kill).

## Ringkasan per temuan (HIGH dulu, sesuai usulan reviewer)

| # | Temuan (review) | Aksi | Hasil |
|---|---|---|---|
| H1 | Accession 10-char (A0A024RBG1) ditolak; pola 6-char terlalu luas (INSULI lolos); lowercase tidak konsisten | `ACC_6_RE`+`ACC_10_RE`: 6-char wajib ada digit, 10-char = `A0A`+7 alnum. `is_accession()` dinormalisasi (uppercase) & dipakai **sama** di search & profile. `A0A024RBG1` diverifikasi live (200). | `ACCESSION_CLASSIFICATION` probe: P04637=T, A0A024RBG1=T, INSULI=F, p04637=T. `LIVE_TEN_CHAR_LOCAL` kini **200** (bukan 422). Regresi `TestAccessionClassification` (7 test). |
| H2 | JSON error upstream (403 / `{}`) jadi protein kosong 200/available | `retrieve`: status 4xx non-404 → `UnknownUpstream`; success wajib punya `primaryAccession` non-kosong, selain itu `UpstreamMalformed`. `search`: item tanpa identity di-drop. | Probe: `SIM_UPSTREAM_403` & `SIM_EMPTY_RECORD` → **502 provider_error**. Tes: `test_upstream_403_is_provider_error_not_empty_protein`, `test_empty_record_is_malformed_not_available`. |
| H3 | ConnectError & nested field salah → HTTP 500 telanjang | `_get` tangkap `httpx.HTTPError` → `UnknownUpstream` (502). Mapping dipasangi guard `isinstance` untuk `proteinDescription`/`genes`/`comments`/`sequence` (shape salah = treat-absent, bukan fatal). | Probe: `SIM_CONNECTION_ERROR`→502, `SIM_INVALID_RECORD`→502. Tes: `test_connect_error_is_provider_error_not_500`, `test_malformed_nested_field_is_not_500`, `test_broken_json_syntax_is_provider_error`. |
| M1 | Next link invalid = diam-diam end of results | `next_cursor_from_headers` kini return **tuple `(cursor, ok)`**: tak ada Link = `(None, True)`; ada `rel="next"` tapi invalid = `(None, False)` → `MalformedPagination` → 502. | Probe `SIM_INVALID_NEXT_LINK` = `(None, False)`. Tes: `test_invalid_next_link_is_flagged_not_silent`, `test_wrong_path_next_link_is_flagged`. |
| M2 | Cursor reset "didokumentasikan" tapi tak diimplementasi | Keputusan: **frontend bertanggung jawab** drop cursor saat q/page_size berubah; backend meneruskan cursor apa adanya (bisa ditolak UniProt). Klaim "backend reset otomatis" dihapus; docstring + README + OpenAPI parameter description disesuaikan. | Probe `UPSTREAM_PARAMS` menunjukkan q+cursor+size diteruskan mentah (diharapkan, terdokumentasi). |
| M3 | Kontrak error tak ada di OpenAPI | Endpoint `search` & `entities` diberi `responses={...}` (400/429/502/504 + 404). Body error terdokumentasi via schema. | Probe `OPENAPI_PROFILE_CODES` = `['200','404','429','502','504','422']`. Tes: `TestOpenAPIErrorContract`. |
| M4 | Tidak ada deadline total (wall-clock) | `TOTAL_DEADLINE_S=35` di-check tiap iterasi retry loop (`time.monotonic()`), termasuk backoff. `ProviderTimeout` (504) bila melampaui. | Diterapkan di `_get` (panggilan + retry + backoff dalam satu atap). |

## Perubahan file
- `app/adapters/uniprot.py` — regex accession (6+10), `is_accession` normalisasi, `next_cursor_from_headers` tuple, `_get` + deadline + catch transport, `search`/`retrieve` validasi identity + 4xx, guard mapping, `MalformedPagination`/`UnknownUpstream`, `error_response`.
- `app/routers/entities.py` — pakai `is_accession` (10-char valid), pesan 422 diperbarui, `responses` OpenAPI.
- `app/routers/search.py` — `responses` OpenAPI, deskripsi parameter, docstring cursor-reset ownership.
- `tests/test_offline.py` — 21→**34 test** (+regresi: klasifikasi accession, 403, empty/broken record, nested-field, connect error, invalid-next-link, OpenAPI). Marker simulasi dijaga; aksesion lama diuji pakai `A1B2C3`/`A0A0000000`.
- `tests/test_api_live.py` — tak berubah (5 test tetap).

## Bukti eksekusi (kode baru, server PID 13500)
| Perintah | Hasil |
|---|---|
| `uv run pytest tests/test_offline.py` | **34 passed** |
| `uv run pytest -m live tests/test_api_live.py` | **5 passed** (LIVE-OK) |
| `uv run python ../docs/review_slice1_checks.py` | Semua baris HIGH kini sesuai: 10-char → lokal 200 (real record NUDT4B); 403/empty/invalid-record → 502 provider_error; connect → 502; invalid next-link → (None,False); OpenAPI memuat 404/429/502/504 |

> Catatan probe: `SIM_CURSOR_FORWARDED` tetap meneruskan `cursor` apa adanya saat q berubah — ini perilaku yang **disengaja** sesuai M2 (tanggung jawab frontend, terdokumentasi), bukan bug.

## Batasan / tersisa
- 429 live & retry-After nyata belum diamati (hanya simulasi offline berlabel) — belum ada kondisi rate-limit di UniProt saat sesi ini.
- Deadline total 35 s belum diuji beban nyata (logika ada, regresi timeout tetap simulasi).
- Frontend belum terintegrasi; NCBI Gene/provider lain belum ada; tanpa DB/login.
- Reviewer tidak mengubah kode aplikasi (read-only); perubahan di sini milik implementer.

## Server
- uvicorn kode **baru** berjalan di `http://127.0.0.1:8000`, **worker PID 12932** (launcher PID 13500, proses background `proc_505383e1fe94`). PID lama (23292/23764/24000) sudah di-kill.
- Hentikan: `taskkill /F /PID 12932`.

## Istilah baru (lanjutan)
- **Wall-clock deadline**: batas waktu total nyata (sejak mulai), bukan cuma tiap fase; mencegah retry+backoff tak terbatas.
- **OpenAPI `responses`**: mendeklarasikan status & bentuk respons error agar Swagger `/docs` memajang kontrak error utk frontend.
- **MalformedPagination**: status sukses tanpa Link = akhir sah; ada `rel="next"` tapi rusak = error, beda dengan akhir sah.
- **TrEMBL 10-char**: accession unreviewed UniProt, pola `A0A…` (mis. A0A024RBG1).
