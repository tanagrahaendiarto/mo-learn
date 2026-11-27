# MoLearn — Konvensi Proses (per-step output)

Aturan sesi MoLearn (dari user):
- **Setiap step jawaban ditulis ke file .md sendiri** di folder ini, bukan cuma di chat.
- Folder ini: `D:/Projects/MoLearn/docs/`.
- Nama file:
  - `DESIGN-<topik>.md` — rancangan / kontrak
  - `REVIEW-<step>.md` — hasil koreksi & ringkasan review
  - `PROBE-<step>.md` — bukti probe/read-only (URL, HTTP, field)
  - `IMPL-<step>.md` — implementasi (setelah disetujui)
- File lama tidak dihapus; step baru = file baru (append-style history), jadi reviewer lain bisa lacak.
- Tidak boleh mengubah docs lain milik tim tanpa izin.

## Index step (MoLearn backend slice 1)
| # | File | Isi |
|---|---|---|
| 1 | `DESIGN-backend-slice1.md` | Rancangan slice 1 (sudah terkoreksi putaran 1) |
| 2 | `PROBE-uniprot-p04637.md` | Bukti probe UniProt (200/500, mapping nyata) |
| 3 | `REVIEW-correction-round1.md` | Ringkasan koreksi + kontrak + hambatan |
| 4 | `IMPL-slice1.md` | Implementasi lokal + hasil tes (offline & live) |
| 5 | `REVIEW-slice1-independent.md` | Review independen (3 HIGH + 4 MEDIUM) + probe |
| 6 | `IMPL-slice1-review-response.md` | Respons implementer: semua temuan ditangani & teruji |
