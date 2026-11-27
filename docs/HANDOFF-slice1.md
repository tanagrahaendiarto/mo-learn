# HANDOFF — MoLearn backend slice 1 (diskusi lintas-agent)

Tujuan: ringkasan kerja yang bisa langsung didiskusikan/ direview agent lain tanpa harus membaca ulang sesi. Detail penuh di `docs/IMPL-slice1.md`. Tanggal 27 Nov 2026.

## Status singkat
- Backend slice 1 **berjalan lokal & teruji** di `D:/Projects/MoLearn/backend`.
- **Review independen selesai & ditanggapi**: 3 HIGH + 4 MEDIUM semuanya difix & teruji (`docs/IMPL-slice1-review-response.md`).
- Server uvicorn **aktif** di `http://127.0.0.1:8000` (**worker PID 12932**, launcher uvicorn PID 13500, kode pasca-review). Bind 127.0.0.1 saja.
- **34/34 offline passed**, **5/5 live passed** (live menembus API lokal) → **[LIVE-OK]**.

## Cara reproduce
```
cd D:/Projects/MoLearn/backend
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000   # server
uv run pytest tests/test_offline.py                            # offline
uv run pytest -m live tests/test_api_live.py                   # live (server harus jalan)
```

## Keputusan kunci (poin yang layak didiskusikan)
1. **Pagination = header Link, bukan item JSON.** `next_cursor` hanya dari `Link: rel="next"` yang validasi (https, host `rest.uniprot.org`, path `/uniprotkb/search`). `null` hanya bila respons SUKSES tanpa next link; kegagalan provider tetap error (502/429/504). Ini mengoreksi rancangan putaran 1.
2. **Format accession (pasca-review) = 6 char `[A-Z][A-Z0-9]{5}` wajib memuat digit, ATAU 10 char `A0A[A-Z0-9]{7}` (TrEMBL).** INSULI (nama protein insulin, semua huruf) TIDAK dianggap accession; `p04637` dinormalisasi ke `P04637`. Dipakai sama oleh search & profile. A0A024RBG1 diverifikasi live (200, NUDT4B).
3. **Profil not-found = HTTP 404** `{"status":"not_found","detail":"protein_not_found"}` (prompt) — rancangan tabel tulis 200; prompt menang.
4. **Escaping nama terdokumentasi:** nama → `protein_name:"<nama>"` (hapus backslash, escape `"`, maks 100 char). Input tak pernah jadi ekspresi UniProt mentah.
5. **Kondisi halaman terakhir = SIMULASI** (fixture respons 200 tanpa header Link). Sesuai arahan: investigasi pagination dibatasi 2 halaman live; 219 halaman TIDAK ditelusuri seluruhnya.
6. **Slice 1 = UniProt saja**, stateless, tanpa DB/login/Redis. Frontend belum terintegrasi (kontrak = `app/schemas.py` + `/openapi.json`).
7. **(pasca-review)** Error upstream (4xx selain 404, transport/ConnectError, JSON rusak, record tanpa identity) → **502 `provider_error`**, bukan 500 telanjang / bukan protein kosong. Deadline total `TOTAL_DEADLINE_S=35` membatasi call+retry+backoff; 429 hormati `Retry-After` hanya jika ≤3 s.
8. **(pasca-review)** Invalid `rel="next"` (host/path/charset salah) = **`upstream_uniprot_malformed_pagination` (502)**, dibedakan dari akhir sah tanpa Link. Cursor-reset = tanggung jawab **frontend** saat q/page_size berubah; backend meneruskan apa adanya (terdokumentasi, bukan reset diam-diam).
9. **(pasca-review)** Kontrak error (400/404/429/502/504) kini **terdokumentasi di OpenAPI** via `responses=` sehingga `/docs` memajangnya utk frontend.

## Bukti nyata (ringkas)
- p1 `q=p53&page_size=2` → `['P04637','O15350']` + `next_cursor` (asli).
- p2 (pakai cursor p1) → `['Q9Y6P5','A1A5B4']`, tanpa overlap.
- `P04637` profil → `length=393`, `Homo sapiens(9606)`, gene `TP53`, xref `GeneID:7157` + `HGNC:HGNC:11998`, fungsi = "Multifunctional transcription factor…".

## Batasan / belum selesai
- Live 429/5xx/malformed hanya **simulasi offline** (belum observasi live).
- Akses tulis repo GitHub **belum diverifikasi**; tidak ada git init/commit/push (sesuai batasan).
- NCBI Gene & provider lain = slice berikutnya.

## Cara hentikan server
`taskkill /F /PID 12932` (worker yang memegang port :8000; launcher uvicorn PID 13500, proses background Hermes `proc_505383e1fe94` → kode pasca-review). PID lama 23292/23764 sudah di-kill.
