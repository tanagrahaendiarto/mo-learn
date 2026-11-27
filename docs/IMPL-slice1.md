# IMPL — MoLearn backend slice 1 (UniProt search + profil protein)

Status: **IMPLEMENTASI LOKAL SELESAI & TERUJI.** 27 Nov 2026.
Menyusul: `DESIGN-backend-slice1.md` (step 1), `PROBE-uniprot-p04637.md` (step 2), `REVIEW-correction-round1.md` (step 3).
File baru, tidak ada riwayat yang ditimpa.

## 1. Istilah baru (ringkas, untuk pemula backend)
- **venv (virtual environment)**: folder berisi Python + dependency proyek saja, terisolasi dari sistem. **`uv`** = alat cepat yang membuatnya dan menginstalnya. **`uv.lock`** = lockfile: versi tepat tiap dependency, jadi siapa pun dapat lingkungan yang sama (reproduksibel).
- **FastAPI**: framework web Python. Endpoint = fungsi; `/docs` otomatis memberi Swagger UI untuk mencoba API.
- **Pydantic**: model data; otomatis memvalidasi input (mis. `page_size` 1–100) dan membentuk respons.
- **Router**: pengelompokan endpoint. **Adapter**: modul yang menerjemahkan JSON UniProt ke kontrak MoLearn.
- **httpx**: klien HTTP untuk memanggil UniProt. **TestClient + MockTransport**: cara menguji endpoint TANPA jaringan, memakai fixture.
- **Fixture**: salinan respons UniProt asli (termasuk header HTTP, karena cursor pagination hidup di header `Link`).
- **Cursor pagination**: token tak terlihat isinya (opaque) yang meneruskan "halaman berikutnya"; bukan nomor halaman.
- **HTTP 400/404/422/429/502**: 400 input buruk, 404 tak ditemukan, 422 validasi gagal, 429 rate limit, 502 upstream error.

## 2. File yang dibuat (semua baru)
```
backend/
  pyproject.toml          # depen: fastapi, uvicorn[standard], httpx, pytest
  uv.lock                 # lockfile (hasil uv sync, 187 KB)
  conftest.py
  README.md               # setup/run/tes yang sudah dicoba
  app/main.py             # FastAPI app, /docs aktif, bind 127.0.0.1
  app/schemas.py          # kontrak Pydantic utk frontend
  app/adapters/uniprot.py # search+retrieve, timeout 20s, 1 retry, parsing Link
  app/routers/health.py   # GET /api/v1/health
  app/routers/search.py   # GET /api/v1/search
  app/routers/entities.py # GET /api/v1/entities/protein/{accession}
  tests/test_offline.py   # 21 tes offline
  tests/test_api_live.py  # 5 tes live (marker: live)
  tests/fixtures/
    P04637.json/.headers          # RESPONS ASLI UniProt (200, 27 Nov 2026)
    search_p53_p1.json/.headers  # halaman 1 ASLI: P04637, O15350 + header Link
    search_p53_p2.json/.headers  # halaman 2 ASLI (dikutip via cursor Link p1): Q9Y6P5, A1A5B4
    search_sim_lastpage.json/.headers  # SIMULASI: respons 200 tanpa header Link
docs/IMPL-slice1.md       # file ini
```

## 3. Perintah tes & hasil sebenarnya
| Perintah | Hasil |
|---|---|
| `uv sync` | sukses; `uv.lock` dibuat |
| `uv run pytest tests/test_offline.py` | **21 passed** (0 failed, 0 skipped) |
| `uv run pytest -m live tests/test_api_live.py` (server lokal ON) | **5 passed** (0 failed, 0 skipped) → label **[LIVE-OK]** |

Tes live MENEMBUS API backend lokal di `http://127.0.0.1:8000`, bukan langsung ke UniProt.
Kondisi halaman terakhir diuji via fixture simulasi (respons sukses tanpa header `Link` → `next_cursor=null`), sesuai arahan batasi investigasi; seluruh 219 halaman TIDAK ditelusuri.

## 4. Contoh respons backend nyata (diringkas, dari server lokal)
- `GET /api/v1/search?q=P04637` → 200, `match_mode=exact_accession`, hasil pertama `P04637` "Cellular tumor antigen p53", `Homo sapiens` (9606), gene `TP53`, `next_cursor=null`, `provider_status=available`.
- `GET /api/v1/search?q=p53&page_size=2` → 200, hasil `['P04637','O15350']`, `next_cursor=88d6…` (token asli UniProt dari header Link).
- Halaman 2 dengan cursor itu → 200, `['Q9Y6P5','A1A5B4']`, **tidak ada overlap** dengan halaman 1. (Sesuai probe reviewer: P04637/O15350 lalu Q9Y6P5/A1A5B4.)
- `GET /api/v1/entities/protein/P04637` → 200: `length=393`, `reviewed=true`, `function_annotations[0]` = "Multifunctional transcription factor that induces cell cycle arrest, DNA repair or apoptos…", gene_crossrefs `GeneID:7157`, `HGNC:HGNC:11998`.
- `/docs` → 200; `/openapi.json` memuat 3 path.

## 5. Status pagination (sesuai koreksi wajib)
- ✅ Halaman pertama tanpa cursor.
- ✅ `next_cursor` dibaca dari **header `Link` rel="next"** (divalidasi: https, host `rest.uniprot.org`, path `/uniprotkb/search`, charset `^[A-Za-z0-9_-]{1,200}$`) — BUKAN dari item JSON (item memang tidak punya field cursor, diverifikasi di fixture p1).
- ✅ Cursor user tidak pernah menjadi URL request; host UniProt tetap ditentukan backend.
- ✅ `cursor=*` / URL / token >200 char → 400 `cursor_invalid`.
- ✅ `next_cursor=null` hanya bila respons SUKSES tanpa next link (dibuktikan fixture simulasi + halaman 1 search accession P04637 yang memang habis). Kegagalan provider tetap error (502/429/504), bukan null.
- ✅ `q`/`page_size` dipertahankan saat lanjut halaman; perubahan keduanya = reset (terdokumentasi di README + docstring endpoint).

## 6. Perubahan kontrak dari rancangan sebelumnya
1. **Pagination**: rancangan putaran 1 menulis "cursor per-item / next_cursor=null bila UniProt 500" — DICAUT. Sekarang: cursor dari header Link; kegagalan provider → error (`provider_error`), bukan null.
2. **Format accession**: pola di rancangan (3x(huruf+angka), "7 char") TIDAK cocok untuk P04637 (P-0-4-6-3-7). Format yang terdokumentasi sekarang: **6 karakter, `[A-Z][A-Z0-9]{5}`** (P04637, O15350, Q9Y6P5, A1A5B4 semua cocok; XYZ / A1B2C3D ditolak).
3. **Profil not-found**: prompt mensyaratkan **HTTP 404** + `{"status":"not_found","detail":"protein_not_found"}`; tabel rancangan menulis 200. Mengikuti prompt → 404.
4. **Escaping nama**: didefinisikan & terdokumentasi: nama menjadi `protein_name:"<nama>"` setelah hapus backslash, escape `"` jadi `\"`, maks 100 char. Input tak pernah diteruskan sebagai ekspresi UniProt mentah.
5. **Retry-After**: hanya dihormati jika ≤ 3 detik (batas total waktu), sesuai larangan menunggu tanpa batas.
6. Field `gene_crossrefs` tetap dari namespace `GeneID` + `HGNC` (terkonfirmasi payload P04637; `NCBI-Gene` memang tidak ada di payload).

## 7. Batasan / yang tersisa
- Frontend BELUM terintegrasi (dikerjakan teman, mengikuti kontrak `schemas.py` + `/openapi.json`).
- Slice 1 hanya UniProt; NCBI Gene & provider lain menyusul. Tanpa DB, login, Redis, chatbot.
- Timeout tes 429/5xx/malformed = simulasi (offline), bukan observasi live — label SIMULASI ada di `test_offline.py`.
- Urutan hasil UniProt dijamin stabil hanya untuk halaman yang sama (token cursor); tes live memakai klaim keanggotaan/overlap, bukan urutan mutlak.
- Akses tulis repo GitHub tetap belum diverifikasi (di luar scope sesi ini; tidak ada git init/commit dilakukan, sesuai batasan).

## 8. Server: masih berjalan?
- **Ya.** uvicorn berjalan di `http://127.0.0.1:8000` (bind 127.0.0.1 saja, bukan semua interface), PID 23292 (proses background Hermes `proc_77c551b2f658`).
- Cara hentikan: `taskkill /PID 23292 /F` atau matikan proses background Hermes.
- Menjalankan ulang: `cd D:/Projects/MoLearn/backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000`
