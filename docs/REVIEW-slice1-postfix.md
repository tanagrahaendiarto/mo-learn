# Review independen pasca-perbaikan slice 1

27 November 2026. Reviewer membaca kode aktual, menjalankan suite dan dua probe. Tidak mengubah aplikasi, restart server, commit, atau push.

## Hasil nyata

Dari backend/:

```text
.venv/Scripts/python.exe -m pytest tests/test_offline.py tests/test_api_live.py -q
39 passed, 1 warning in 4.82s
.venv/Scripts/python.exe ../docs/review_slice1_checks.py
.venv/Scripts/python.exe ../docs/review_slice1_postfix_checks.py
```

34 offline + 5 live melalui server lokal lulus tanpa skip. Warning deprecation Starlette/httpx bukan kegagalan. Profil A0A024RBG1: UniProt 200, backend lokal 200 dengan accession benar. Server lama tidak disentuh; listener PID tidak diperiksa dalam review ini.

## Yang terverifikasi membaik

- Profil 10-karakter contoh A0A024RBG1 sekarang bekerja live.
- SIMULASI ConnectError, upstream 403, profil kosong, dan JSON/record invalid tanpa identity menghasilkan 502 provider_error.
- Next link dengan host salah menghasilkan tuple (None, False), tidak dianggap halaman terakhir.
- OpenAPI profil sudah memuat 404/429/502/504.
- Kepemilikan reset cursor sekarang dijelaskan sebagai tanggung jawab frontend pada docstring dan deskripsi parameter API.

## Temuan tersisa — wajib diperbaiki sebelum fitur baru

### High: search masih bisa menghasilkan identifier kosong / menyamarkan data rusak
`app/adapters/uniprot.py:206` hanya memeriksa truthiness primaryAccession, tidak memastikan string nonkosong valid. Mapping :245-246 mengubah identifier numerik menjadi string kosong.

SIMULASI endpoint search:
- Upstream {results:[{primaryAccession:123}]} -> HTTP 200, provider_status=available, accession kosong, URL tanpa accession.
- Upstream {results:[{}]} -> HTTP 200, provider_status=not_found.

Keduanya bukan hasil biologis yang sah. Bedakan hasil memang kosong dari record sumber malformed. Pilihan minimum: tolak batch malformed dengan 502; jangan mengimplementasikan partial secara setengah-setengah. Tambah regresi kedua kasus.

### Medium: deadline 35 detik bukan hard wall-clock cap
`_get` :159 memeriksa waktu sebelum request saja. Request sinkron :162 tidak menggunakan remaining budget; respons terlambat langsung dikembalikan. httpx timeout merupakan timeout fase/inaktivitas, bukan hard total deadline.

SIMULASI clock: request memajukan waktu dari 0 ke 40 detik lalu mengembalikan 200; retrieve tetap berhasil walau limit 35 detik. Tidak ada penantian nyata 40 detik pada probe.

Perlu deadline yang benar-benar membatasi operasi atau keputusan eksplisit merevisi guarantee. Memeriksa waktu setelah respons saja tidak membatasi waktu tunggu pengguna. Jangan menulis hard cap tanpa cancellation/bounded execution yang mendukungnya. Tambah tes deadline dan retry budget.

### Medium: accession syntax masih tebakan
:39-40,97-106 memakai six-character + any digit atau prefix A0A. Bukan validasi UniProt yang telah diverifikasi dari dokumentasi resmi. Probe ABC123=True, A0AAAAAAAA=True. Contoh A0A024RBG1 berhasil tidak membuktikan aturan umum benar. Gunakan regex resmi 6/10 karakter dan referensi sumber; perbaiki pesan entities.py yang bahkan menyebut '10 chars = 5 letters + 4 digits'. Jangan menyamakan panjang accession dengan reviewed/unreviewed status.

### Medium: parser Link mengira next link sah sebagai akhir hasil
:126 regex hanya menerima rel tepat setelah URL.
SIMULASI header sah:
<https://rest.uniprot.org/uniprotkb/search?cursor=abc>; type="application/json"; rel="next"
Hasil parser (None, True), padahal next relation ada. Gunakan parser Link yang sudah tersedia (misalnya mekanisme httpx yang diperiksa) atau parser kecil yang menangani parameter order. Cursor regex tetap asumsi format internal; pertahankan host tetap dan panjang terbatas tanpa bergantung pola token yang tidak didokumentasikan.

### Low: OpenAPI 400 tidak mencakup query_too_long
search.py:62 hanya mendeklarasikan detail const cursor_invalid, sedangkan :95 mengembalikan query_too_long. Selaraskan schema dengan perilaku.

## Keputusan

Happy path berfungsi, tetapi belum approve selesai penuh. Tugas Fable berikutnya: PERBAIKAN TERBATAS atas temuan dalam laporan ini, bukan review ulang dari nol atau fitur NCBI. Pertahankan kode yang benar. Tambahkan tes yang gagal dulu, perbaiki, jalankan seluruh suite dan maksimal dua halaman live. Tidak commit/push/deploy sebelum review.

## Artefak
- docs/REVIEW-slice1-postfix.md (laporan ini)
- docs/review_slice1_postfix_checks.py (probe simulasi tambahan, dapat dijalankan ulang)
- docs/review_slice1_checks.py (probe lama, dijalankan ulang tanpa modifikasi)
