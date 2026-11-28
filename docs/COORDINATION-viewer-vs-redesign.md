# Koordinasi: 3D viewer vs Responsive UI/UX Sprint

Tanggal: 2026-11-28
Worktree: `D:/Projects/MoLearn-3d-viewer` · Branch: `feat/interactive-structure-viewer` · Base: `d928291`
Sifat dokumen: **inspeksi dan analisis saja**. Tidak ada perubahan kode, commit, push, merge, atau rebase yang dilakukan untuk menjawab pertanyaan di bawah.

Dasar penilaian: `git status`/`git diff` aktual, isi source code, dan struktur repository saat ini — bukan asumsi umum.

---

## 1. Scope pekerjaan yang sedang dikerjakan

Slice 5.1: **interactive molecular viewer** (Mol* 5.13.1) + **perbaikan lebar modul Exploration**. Bukan redesign halaman. Backend, API contract, dan scientific data processing tidak disentuh.

Status nyata saat dokumen ini ditulis:

- Belum di-commit (nol commit di branch).
- Render browser **belum pernah dijalankan**.
- `npm run build` belum dijalankan → ukuran chunk dan timing belum ada.
- ESLint: 0 error, **1 warning** yang menggagalkan gate `--max-warnings=0`.
- Terbukti jalan: tes aturan murni 5/5 lulus, `tsc --noEmit` bersih, CORS RCSB/AlphaFold terverifikasi, kontrak backend 7 record, pemetaan chain 6XRE = M terverifikasi dari data.

## 2. Branch dan base commit

| Item | Nilai |
|---|---|
| Worktree | `D:/Projects/MoLearn-3d-viewer` |
| Branch | `feat/interactive-structure-viewer` |
| Base commit | `d928291` (origin/master) |
| Upstream tracking | dihapus (tidak menunjuk master) |
| Commit di branch | **nol** — semuanya masih working tree |
| Worktree lama | `D:/Projects/MoLearn` — tidak disentuh |

## 3. File: sudah, sedang, akan

### Sudah diubah (tracked, belum commit)

| File | +/− | Isi perubahan |
|---|---|---|
| `frontend/package.json` | +1 | `"molstar": "5.13.1"` pinned |
| `frontend/package-lock.json` | +2.563 | lockfile Mol*, tidak ada paket lain yang berubah versi |
| `frontend/src/components/StructureResults.tsx` | +2 | import + satu baris mount `<StructureViewer>` |
| `frontend/src/app/entity/[type]/[id]/page.tsx` | +13/−13 | pindah `<section>` Exploration ke baris penuh |
| `frontend/src/components/GeneProfile.tsx` | +8/−8 | sama, untuk view gene |

Total tracked diff: **5 file, +2.505 / −103 baris** (2.563 di antaranya lockfile).

### Baru (untracked)

`frontend/src/lib/structure-viewer-rules.ts` · `frontend/src/components/StructureViewer.tsx` · `frontend/tests/structure-viewer-rules.test.mjs` · `docs/DESIGN-interactive-structure-viewer.md` · `docs/EXECUTION-interactive-viewer-approved.md` · `docs/CHANGES-interactive-structure-viewer.md` · dokumen ini.

### Sedang dikerjakan

Warning ESLint `react-hooks/exhaustive-deps` di `StructureViewer.tsx:178` (cleanup membaca `generation.current` lewat ref).

### Akan dikerjakan

1. Perbaiki warning ESLint.
2. `npm run build` + ukur ukuran chunk viewer dan route.
3. Tes Playwright Edge: render, resize, picking mengembalikan string identitas, target 6XRE = chain M saja, assembly vs deposited, switch cepat A→B (B menang), close/reopen tanpa pertumbuhan konteks WebGL, fallback WebGL/provider, viewport 1440/1024/768/390.
4. Laporan tahap + screenshot.

### Tidak akan dikerjakan

Homepage, search results, Navbar, Footer, typography, spacing, microinteractions, AI Study Companion, global CSS, backend.

## 4. Apakah mengubah komponen frontend, protein profile, structure module, global CSS, dependencies, atau layout

| Area | Status | Catatan |
|---|---|---|
| Komponen frontend | **Ya** | Hanya `StructureResults.tsx`, `GeneProfile.tsx` |
| Protein profile (`page.tsx`) | **Ya** | Pindah posisi section Exploration |
| Structure module | **Ya** | `StructureViewer.tsx` baru, di dalam `StructureResults.tsx` |
| `ExplorationModules.tsx` | **Tidak** | Hanya wadah/section-nya yang dipindah |
| `globals.css` / design token | **Tidak** | Nol perubahan |
| Dependencies | **Ya** | Hanya `molstar`, pinned |
| Layout | **Ya** | Terbatas pada posisi section Exploration di 2 file |
| Navbar, Footer, SearchInput, `states.tsx`, `PixelCard`, `PixelButton`, `StudyCompanion`, homepage, search | **Tidak** | Nol perubahan |

Token desain yang **dipakai** viewer (jadi kontrak tidak langsung): `bg-surface`, `border-outline-subtle`, `text-body-sm`, `text-on-surface-variant`, `text-center`. Semuanya didefinisikan di `globals.css` baris 58–141.

## 5. Potensi tabrakan dengan rencana redesign — **ya, nyata**

Rencana sprint menyebut **"Memperbaiki layout gene dan protein profile"** dan **"Memperbaiki layout scientific exploration modules"**. Itu tepat tiga file yang diubah implementasi viewer. Ini bukan risiko hipotetis: jika kedua sisi mengedit `page.tsx` dan `GeneProfile.tsx` dari `d928291`, diff akan bertabrakan pada blok JSX yang sama.

### Zona tabrakan

| File | Titik konflik | Tingkat |
|---|---|---|
| `src/app/entity/[type]/[id]/page.tsx` | Blok `<section>` Exploration dipindah keluar dari kolom `md:col-span-2` | Tinggi |
| `src/components/GeneProfile.tsx` | Idem | Tinggi |
| `src/components/StructureResults.tsx` | Baris `<StructureViewer>` ditambahkan setelah preview statis | Rendah (1 baris) |
| `package.json` / `package-lock.json` | Jika sprint menambah dependency UI | Sedang |

### Yang **tidak** berisiko

Karena sprint menyatakan tidak mengubah backend, API contract, scientific data processing, dan logika internal viewer, tidak ada konflik di `backend/**`, di `src/lib/exploration.ts`, atau di dalam `StructureViewer.tsx` sendiri.

## 6. File/komponen yang sebaiknya tidak disentuh sementara

### Bekukan total

- `frontend/src/components/StructureViewer.tsx`
- `frontend/src/lib/structure-viewer-rules.ts`
- `frontend/tests/structure-viewer-rules.test.mjs`
- Baris `<StructureViewer … />` di `StructureResults.tsx`

Alasan: bagian ini mengunci logika ilmiah (pemetaan author→label chain, verifikasi assembly, batas ukuran) dan sedang menunggu verifikasi browser. Perubahan kosmetik di sini memaksa tes ulang penuh.

### Jangan diubah tanpa koordinasi

- Class grid modul di `ExplorationModules.tsx`: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (baris 240) dan `sm:col-span-2 lg:col-span-3` (baris 92). Perhitungan lebar viewer bergantung pada rantai ini.
- Token yang dipakai viewer: `--color-surface`, `--color-outline-subtle`, `--text-body-sm`, `--color-on-surface-variant`. Mengganti nilainya boleh; **menghapus namanya** mematahkan styling viewer.
- `package.json` dependencies.
- `data-testid="molstar-host"` — titik ukur tes browser.

### Larangan keras

- Jangan memasang renderer kedua (3Dmol.js / NGL). Dua renderer = dua konteks WebGL + dua kontrak picking.
- Jangan membungkus viewer dengan `transform`/`scale`/`filter` pada ancestor — koordinat picking WebGL akan meleset.
- Jangan menambahkan `overflow: hidden` global untuk menyembunyikan masalah lebar; itu menutupi cacat, bukan memperbaiki.

## 7. Component interface & container requirements

### Interface

```tsx
// client component ("use client"), dynamic import Mol* di dalamnya
import { StructureViewer } from "@/components/StructureViewer";

<StructureViewer
  key={`${record.source}:${record.source_id}`}   // wajib: remount bersih per record
  record={record}                                 // tipe: StructureRecord
/>
```

`StructureRecord` (dari `@/lib/exploration`) berisi: `kind` (`"experimental" | "predicted"`), `coverage[{ chain, start, end }]`, `downloads[{ format, url }]`, `preview_url`, `source_id`, `source`, `source_url`, `protein_accession`, `methods`, `resolution_angstrom`, `mean_plddt`, `retrieved_at`.

Komponen **tidak** menyediakan: `className` override, prop `height`, callback `onReady`. Jika sprint butuh kontrol tinggi dari luar, itu perubahan kecil di file viewer — minta lewat koordinasi, jangan fork komponennya.

### Container requirements

| Kebutuhan | Alasan teknis |
|---|---|
| Parent `position: relative` dengan tinggi pasti | Host canvas memakai `absolute inset-0`; tanpa tinggi, canvas 0 px |
| Tinggi internal saat ini: `360px` mobile, `480px` ≥ md | Sudah ada di komponen. Boleh dioverride parent; jangan dihapus |
| `min-w-0` di setiap rantai flex/grid induk | Canvas WebGL cenderung memaksa lebar induk jika `min-width:auto` |
| Tanpa `transform`, `scale`, `filter` di ancestor | Memutus pemetaan koordinat picking |
| Tanpa `overflow: hidden` yang memotong toolbar | Toolbar berada di bawah canvas dan ikut wrap |
| `ResizeObserver` sudah terpasang pada host | Cukup ubah ukuran parent; viewer menyesuaikan sendiri |
| Tidak boleh SSR | Mol* diimpor dinamis; komponen `"use client"` |
| `data-testid="molstar-host"` dipertahankan | Titik ukur tes |

### Perilaku yang dijamin komponen

- Koordinat diunduh sendiri: timeout 30 dtk, cap 25 MiB streamed, `redirect:"error"`, `credentials:"omit"`, allowlist host+path provider.
- Batas 250.000 atom setelah assembly expansion.
- Fallback teks selalu ada: metadata, provenance, preview statis, dan tautan unduh/sumber tetap tampil saat WebGL gagal, chunk gagal, CORS ditolak, timeout, file rusak, atau melebihi batas.
- Label provenance ketat: "Deposited coordinates (asymmetric unit)" vs "Biological assembly N" vs "Predicted model (AlphaFold)". Tidak pernah menyebut satu kompleks multiprotein sebagai protein yang sedang dipelajari.

## 8. Strategi file ownership dan urutan merge

### Rekomendasi utama

**Serahkan pekerjaan layout ke tim sprint.** Perubahan layout viewer (memindah section Exploration) justru bagian yang akan mereka redesign. Membatalkannya menghapus 2 dari 3 sumber konflik dan menurunkan risiko secara signifikan.

### Pembagian ownership final

| Pemilik | File |
|---|---|
| Implementasi viewer | `StructureViewer.tsx`, `structure-viewer-rules.ts`, tesnya, 1 baris di `StructureResults.tsx`, `package.json` + lockfile |
| Tim sprint | `page.tsx`, `GeneProfile.tsx`, `ExplorationModules.tsx`, `globals.css`, Navbar, Footer, homepage, search, `states.tsx`, tipografi, spacing, microinteractions |

### Urutan merge

1. Viewer menyelesaikan gate (ESLint, build, tes browser), lalu commit ke `feat/interactive-structure-viewer`. Hasilnya kecil: ~5 file, tanpa perubahan layout.
2. Viewer **mengembalikan** dua edit layout (`page.tsx`, `GeneProfile.tsx`) ke kondisi `d928291`. Penataan posisi section menjadi tanggung jawab tim sprint.
3. Tim sprint membuat branch dari `d928291` sekarang dan bekerja paralel.
4. Merge pekerjaan viewer **lebih dulu** — tidak menyentuh file milik tim sprint.
5. Tim sprint rebase ke atas viewer; sisa konflik praktis hanya `StructureResults.tsx` (1 baris) dan `package.json`.

Jangan merge pekerjaan sprint lebih dulu: konflik di `StructureResults.tsx` sepele tapi memaksa resolusi manual yang tidak perlu dan berisiko menghapus baris mount viewer.

## 9. Bisakah berjalan paralel tanpa saling menunggu

**Bisa**, dengan dua syarat yang bisa dipenuhi hari ini:

1. Viewer melepas edit `page.tsx` dan `GeneProfile.tsx`.
2. Tim sprint tidak menyentuh tiga file viewer yang dibekukan dan memberi tahu sebelum mengubah token warna/tipografi.

Setelah itu kedua pekerjaan independen secara teknis: tidak ada dependency build, tidak ada perubahan API, tidak ada konflik runtime.

## 10. Klasifikasi pekerjaan frontend

### SAFE — dapat langsung dikerjakan

- Visual identity & design system: token warna, tipografi, spacing di `globals.css` (asal **nama** token yang dipakai viewer tetap ada).
- Homepage (`src/app/page.tsx`) dan search results.
- Navbar, Footer, `SearchInput`, `states.tsx`, `PixelCard`, `PixelButton`, `HelpTooltip`, `EntityCard`.
- Loading/error state di komponen yang bukan bagian rantai viewer.
- Microinteractions pada elemen non-canvas.
- AI Study Companion (`StudyCompanion.tsx`) — tidak beririsan.
- Referensi desain dari Google Stitch / v0 sebagai artefak terpisah, sebelum menyentuh codebase.

### COORDINATE — butuh koordinasi dulu

- `ExplorationModules.tsx`: class grid `grid-cols-*` dan `col-span-*`. Perhitungan lebar viewer bergantung di sini.
- `StructureResults.tsx`: selain baris mount viewer.
- `page.tsx` dan `GeneProfile.tsx`: posisi section Exploration.
- `package.json` / `package-lock.json`: dependency baru apa pun.
- Perubahan token yang dipakai viewer (`surface`, `outline-subtle`, `body-sm`, `on-surface-variant`).

### BLOCKED — tunggu implementasi viewer selesai

- Sentuhan apa pun pada `StructureViewer.tsx`, `structure-viewer-rules.ts`, tesnya.
- Menambah renderer molekuler kedua.
- Mengubah tinggi/`overflow`/`transform` pada kontainer viewer.
- Menghapus atau mengganti nama `data-testid="molstar-host"`.
- Mengintegrasikan hasil Google Stitch / v0 ke area structure module.
- Redesign `StructureResults.tsx` di luar baris mount.

## 11. Conflict-risk verdict

**COORDINATE — bukan SAFE, bukan BLOCKED.**

Dasar: overlap terbatas pada 3 file tracked + 1 blok dependency, semuanya dapat dihindari dengan menyerahkan layout ke tim sprint. Tidak ada konflik arsitektural karena backend, API contract, dan logika internal viewer tidak diubah oleh pihak mana pun.

- Turun menjadi **SAFE** jika viewer melepas edit `page.tsx` dan `GeneProfile.tsx`, dan tim sprint tidak menyentuh tiga file viewer yang dibekukan.
- Naik menjadi **BLOCKED** jika tim sprint menambah renderer kedua, mengubah token yang dipakai viewer tanpa memberi tahu, atau menghapus `data-testid="molstar-host"`.

## 12. Dua catatan yang harus diketahui sebelum sprint mulai

1. Pekerjaan viewer **belum di-commit**, jadi belum bisa di-branch atau di-merge. Langkah 1 pada bagian 8 harus selesai lebih dulu.
2. Halaman protein dan gene **belum pernah dirender dengan viewer aktif di browser**. Jangan menganggap integrasi 3D sudah terbukti stabil; verifikasi browser masih menjadi gate yang harus dilewati.

## 13. Ringkasan satu tabel

| Pertanyaan | Jawaban singkat |
|---|---|
| Scope aktif | Interactive viewer Mol* + lebar modul Exploration |
| Branch / base | `feat/interactive-structure-viewer` / `d928291` |
| Commit | Nol |
| File diubah | 5 tracked, 3 baru, +2.505/−103 baris |
| Menyentuh CSS global | Tidak |
| Menyentuh backend | Tidak |
| Tabrakan redesign | Ya, 2 file layout + 1 baris mount |
| File dibekukan | `StructureViewer.tsx`, `structure-viewer-rules.ts`, tesnya |
| Container viewer | `relative` + tinggi pasti + `min-w-0`, tanpa `transform` |
| Urutan merge | Viewer dulu, sprint rebase setelahnya |
| Paralel | Bisa, setelah viewer melepas 2 edit layout |
| Kategori | **COORDINATE** |
