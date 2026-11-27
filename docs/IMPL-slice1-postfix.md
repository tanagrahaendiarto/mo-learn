# IMPL — slice 1 postfix (perbaikan terbatas atas REVIEW-slice1-postfix.md)

27 Nov 2026. MoLearn sebagai pelaksana. Cakupan: 5 temuan postfix, tidak ada fitur baru, tidak ada review ulang dari nol.

## Temuan → perubahan

### 1 (High): search menolak record malformed, tidak lagi masking
- `app/adapters/uniprot.py` `search()`: satu record dengan `primaryAccession`
  missing/non-string/blank → seluruh halaman `UpstreamMalformed` (502
  `upstream_uniprot_malformed`). Hasil benar kosong (`results: []`) tetap
  200 `not_found` — dibedakan eksplisit, bukan partial-result setengah-setengah.
- Mapping `:245-246` tidak bisa lagi memfabrikasi identifier kosong karena
  record tanpa identitas tak sampai ke mapping. Filter `isinstance` mati di
  `routers/search.py` dihapus (adapter kini menjamin bentuk).
- Regresi: `TestSearchMalformedRecords` (5 tes) di `tests/test_offline.py`,
  termasuk kedua kasus probe postfix (numeric id, record kosong) + blank
  string + kontrol empty/valid.

### 2 (Medium): deadline jadi pembatas nyata, klaim direvisi
- `_get` kini: pre-check budget tiap attempt; request in-flight diberi
  timeout per-request `min(TIMEOUT_S, remaining)`; respons yang mendarat
  setelah deadline ditolak sebagai `ProviderTimeout` (504). Backoff retry
  dibatasi sisa budget.
- **Klaim "hard wall-clock cap" dihapus** dari docstring modul. Dinyatakan
  keterbatasan jujur: tanpa cancellation (httpx sinkron) — respons yang
  sudah di-kabel ditunggu hingga timeout per-request-nya, lalu dibuang,
  tidak pernah dikembalikan terlambat. Upgrade path: async client +
  `asyncio.wait_for`. Ini pilihan kecil; arsitektur besar TIDAK dilakukan.
- Regresi: `TestDeadlineBudget` (2 tes, simulasi clock & timeout): hasil
  terlambat ditolak; panggilan yang melewati budget terpotong cepat.

### 3 (Medium): accession = aturan resmi UniProt
- Regex resmi dari `https://www.uniprot.org/help/accession_numbers`
  (halaman last modified 12 Jun 2026):
  `[OPQ][0-9][A-Z0-9]{3}[0-9] | [A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}`
  (6 char = `{1}`, 10 char = `{2}`). Menggantikan tebakan lama
  (six-char + digit / `A0A[A-Z0-9]{7}`).
- Dampak tervalidasi: probe `ABC123`/`A0AAAAAAAA` kini False; `A0A024RBG1`,
  `A0A022YWF9` (contoh resmi) True; `B4DMQ7` (6 char resmi) True.
  Ketidakcocokan lama: `B4DMQ7` dulu False, kini benar; kasus offline
  500-sim pindah ke `A0A022YWF9`.
- Pesan 422 di `routers/entities.py` (yang menyebut "5 letters + 4 digits")
  diganti merujuk sintaks resmi; tidak lagi menyamakan panjang dengan
  status reviewed/unreviewed.
- Regresi: `TestAccessionSyntaxOfficial` + `TestProfileValidationMessage`.

### 4 (Medium): parser Link tahan urutan parameter + cursor tetap opaque
- `next_cursor_from_headers` ditulis ulang: setiap target `<...>` di-parse
  terpisah dari blok parameternya; `rel` dikenali apa pun urutan
  parameternya (RFC 5988; kasus probe `; type="application/json"; rel="next"`
  kini → `('abc', True)`). Aturan tidak berubah: https, host
  `rest.uniprot.org`, path `/uniprotkb/search`, token cursor URL-decoded
  harus lolos charset+panjang maksimum yang terdokumentasi (pola token
  internal tetap tidak diandalkan).
- Regresi: `TestLinkHeaderParsing` (9 tes) termasuk kontrol rel-first,
  rel-only-prev, host/path salah, tanpa cursor, cursor di luar charset.

### 5 (Low): OpenAPI 400 selaras
- `routers/search.py` schema 400: `detail` kini `enum: [cursor_invalid,
  query_too_long]` — kedua detail yang benar-benar bisa dikembalikan.
- Regresi: `TestOpenAPIBadRequestDetails`.

## Bukti eksekusi (27 Nov 2026, backend/ `D:/Projects/MoLearn/backend`)

```text
.venv/Scripts/python.exe -m pytest tests/test_offline.py -q
60 passed, 1 warning in 2.47s        # 34 lama + 26 regresi baru, 0 failed/skipped
.venv/Scripts/python.exe -m pytest -m live tests/test_api_live.py -q
5 passed in 3.93s                    # menembus server lokal + UniProt, 0 skip
.venv/Scripts/python.exe ../docs/review_slice1_checks.py          # selesai
.venv/Scripts/python.exe ../docs/review_slice1_postfix_checks.py  # selesai
```

Perilaku probe postfix pasca-perbaikan (semua SIMULASI, label dijaga):
`SIM_SEARCH missing_id/numeric_id` → 502 `upstream_uniprot_malformed`
(dulu 200/available+accession kosong & 200/not_found);
`SIM_DEADLINE` → `correctly rejected late result` (dulu returned_success);
`CLASSIFICATION ABC123/A0AAAAAAAA` → False (dulu True);
`SIM_LINK_EXTRA_PARAMETER` → `('abc', True)` (dulu `(None, True)`).

Live (observasi nyata, bukan simulasi): server uvicorn restart — listener
:8000 cek `netstat` dulu, port KOSONG (server lama mati sendiri; tidak ada
proses orang lain di-kill), lalu uvicorn baru dijalankan (Hermes
background, PID 24348 saat ini). `LIVE_TEN_CHAR_LOCAL` profil A0A024RBG1
→ 200, accession benar, NUDT4B. Halaman live = tes suite (maks 2 halaman,
p53 page_size=2), sesuai batas.

## Keterbatasan tersisa (jelas, bukan klaim)
- Deadline: pembatasan via budget + timeout per-request + reject respons
  terlambat — **bukan** cancellation in-flight (butuh async client,
  out-of-scope, upgrade path terdokumentasi di docstring).
- 429/5xx/malformed live tetap hanya simulasi offline; happy path live.
- `results: []` + record kosong dalam batch yang sama tidak mungkin
  terjadi upstream; kebijakan = tolak batch (konservatif, sesuai review).

## File yang disentuh
- `app/adapters/uniprot.py` (regex resmi, Link parser, deadline, validasi
  identitas hasil, docstring)
- `app/routers/search.py` (schema 400, filter mati)
- `app/routers/entities.py` (docstring + pesan 422)
- `tests/test_offline.py` (+26 tes regresi; kunci sim 500-sim → A0A022YWF9)
- `docs/IMPL-slice1-postfix.md` (file ini)
