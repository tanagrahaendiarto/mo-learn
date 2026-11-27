# Product Requirements Document — MoLearn

**Status:** Draft 0.1 · perlu disepakati oleh dua anggota tim  
**Tanggal:** 24 November 2026  
**Target:** Produk semifinal STACK 2026 untuk diajukan ke babak final  
**Batas pengumpulan menurut handbook tim:** 30 November 2026, 23.59 WIB  
**Tim:** Tana dan satu teman

## 1. Ringkasan produk

MoLearn adalah ruang belajar berbasis web yang membantu mahasiswa tahun awal ilmu hayati mengenali record biologis yang benar, memahami fungsi dasarnya, dan mengikuti hubungan biologisnya melalui sumber yang dapat diperiksa.

Pengguna dapat mencari nama, simbol, alias, atau identifier; membedakan gen, protein, dan proses biologis; membaca penjelasan ringkas; membuka peta relasi; lalu memeriksa sumber yang mendukung informasi tersebut. Pendamping belajar menjawab dari record dan relasi yang tersedia. Jawaban tidak boleh menyiratkan penggunaan AI generatif jika penyedia model belum terpasang.

**Nilai utama:** satu alur untuk menemukan record yang tepat, memahami konteksnya, dan menelusuri buktinya.

## 2. Masalah dan bukti awal

Mahasiswa yang baru belajar biologi molekuler dapat menemukan nama atau singkatan yang sama pada jenis record berbeda. Informasi fungsi dan relasinya tersebar di basis data, sehingga pengguna harus membuka beberapa halaman dan menilai sendiri sumber yang relevan.

Survei awal tim yang tercatat di materi proyek memiliki 19 responden: 17/19 melaporkan pernah bingung dengan entitas yang tidak dikenal dan 15/19 pernah memilih entri yang salah. Angka ini adalah **temuan survei awal tim**, bukan hasil uji MoLearn. Tim perlu menyimpan instrumen dan data survei agar angka tersebut dapat diperiksa saat presentasi.

## 3. Pengguna sasaran

### Pengguna utama

Mahasiswa tahun pertama atau kedua di bidang ilmu hayati yang sedang mempelajari gen, protein, dan proses biologis, tetapi belum terbiasa membaca record basis data.

### Kebutuhan utama

- Mengetahui apakah hasil pencarian adalah gen, protein, atau jenis record lain.
- Memastikan organisme dan identifier sebelum memakai informasi.
- Mendapatkan penjelasan sederhana tanpa kehilangan tautan ke sumber ilmiah.
- Memahami relasi antara record dan dapat membuka record terkait.

### Jobs to be done

> Saat menemukan nama atau singkatan biologis yang asing, saya ingin memastikan record yang benar dan memahami hubungannya dengan entitas lain, supaya saya dapat melanjutkan tugas tanpa menebak-nebak dari hasil pencarian yang mirip.

## 4. Tujuan, bukan tujuan, dan prinsip

### Tujuan produk

1. Mengurangi kebingungan saat pengguna memilih record biologis.
2. Membantu pengguna memahami fungsi dan hubungan biologis dengan bahasa yang lebih mudah.
3. Membuat klaim dan relasi dapat ditelusuri ke sumber.
4. Menyediakan fondasi data dan API yang dapat diperluas setelah hackathon.

### Bukan tujuan MVP

- Menggantikan NCBI, UniProt, STRING, buku teks, dosen, atau penilaian ahli.
- Memberikan diagnosis atau saran klinis.
- Mencakup semua spesies, seluruh basis data, atau semua jalur biologis.
- Mengklaim hasil belajar meningkat sebelum pilot dijalankan.
- Menghasilkan jawaban AI tanpa bukti yang dapat ditelusuri.

### Prinsip produk

- **Identitas sebelum penjelasan:** jenis record, organisme, dan identifier terlihat jelas.
- **Bukti dekat dengan klaim:** sumber ditampilkan pada profil dan relasi yang didukungnya.
- **Konteks, bukan sekadar pencarian:** record terhubung melalui relasi yang dapat dibuka.
- **Jujur terhadap status:** bedakan data survei, target pilot, dan hasil yang benar-benar diukur.

## 5. Ruang lingkup MVP hackathon

MVP memprioritaskan satu alur yang dapat diperagakan dan diuji: pencarian → identifikasi record → pemahaman profil → eksplorasi relasi → pemeriksaan sumber.

### P0 — wajib untuk MVP

1. **Pencarian record** berdasarkan nama, simbol, alias, atau identifier.
2. **Disambiguasi hasil** dengan label jenis record, organisme, simbol, dan identifier utama.
3. **Profil record** berisi ringkasan bahasa sederhana, organisme, identifier, dan sumber.
4. **Peta relasi interaktif** yang memungkinkan pengguna memilih record terkait.
5. **Daftar relasi tekstual** di samping peta agar relasi tetap dapat dibaca tanpa interaksi grafis.
6. **Pendamping belajar berbasis bukti** yang menggunakan record dan relasi tersimpan, menampilkan sumber, dan memberi tahu pengguna saat data tidak cukup.
7. **Tampilan bukti dan validasi** yang membedakan survei awal tim dari rencana atau hasil pilot.
8. **Mode tanpa layanan eksternal** yang tetap dapat membuka dataset seed yang telah dikurasi.

### P1 — setelah alur P0 stabil

- Menambah kumpulan record dari topik biologis lain yang ditetapkan tim.
- Menambahkan sinkronisasi atau impor data dari sumber publik resmi.
- Menyimpan koleksi pengguna lintas sesi atau perangkat setelah kebutuhan akun disepakati.
- Menghubungkan pendamping belajar ke model bahasa dengan retrieval dan sitasi, jika waktu, biaya, dan kebijakan data mendukung.

### Di luar ruang lingkup pengumpulan ini

- Akun dan autentikasi multi-pengguna.
- Editor graf atau kurasi kolaboratif.
- Analisis sekuens, prediksi struktur, atau rekomendasi klinis.
- Klaim otomatis tentang dampak pembelajaran tanpa data pilot.

## 6. Alur utama pengguna

1. Pengguna membuka halaman Explore dan mencari, misalnya, `INS`.
2. MoLearn menampilkan hasil yang membedakan gen INS dari protein insulin dan record terkait, beserta organisme dan identifier.
3. Pengguna membuka satu hasil dan membaca profil ringkas serta tautan sumber.
4. Pengguna memilih node pada peta atau relasi pada daftar untuk membuka record yang terhubung.
5. Pengguna bertanya kepada pendamping belajar atau memilih pertanyaan contoh.
6. MoLearn menyajikan jawaban dari record terpilih dan relasi tersimpan, berikut sumbernya. Jika bukti tidak cukup, aplikasi menyatakan batasnya.

## 7. Persyaratan fungsional dan kriteria penerimaan

| ID | Kebutuhan | Prioritas | Kriteria penerimaan |
|---|---|---:|---|
| FR-01 | Cari berdasarkan nama, simbol, alias, atau identifier | P0 | Query `INS` mengembalikan entri gen dan protein sebagai hasil terpisah; query identifier menemukan record yang sesuai. |
| FR-02 | Filter berdasarkan jenis record dan organisme | P0 | Pengguna dapat menyaring hasil dan melihat organisme pada setiap record. |
| FR-03 | Tampilkan profil bersumber | P0 | Profil menampilkan jenis, organisme, identifier, ringkasan, dan tautan langsung ke setiap sumber yang mendukungnya. |
| FR-04 | Jelajahi relasi | P0 | Pengguna dapat membuka record tetangga dari peta maupun daftar relasi tekstual. Setiap relasi menampilkan sumber. |
| FR-05 | Jawab pertanyaan dari bukti yang tersedia | P0 | Jawaban hanya dibangun dari record/relasi terpilih, menyertakan sumber, dan menyatakan bukti tidak cukup bila tidak ada dukungan yang cocok. |
| FR-06 | Tampilkan status bukti tim secara jujur | P0 | Survei diberi label jumlah responden dan tanggal; target pilot tidak ditampilkan sebagai hasil. |
| FR-07 | Simpan record | P1 | Pengguna dapat membuka kembali record tersimpan pada perangkat yang sama; UI menjelaskan bahwa penyimpanan belum tersinkron lintas perangkat. |
| FR-08 | Tahan gangguan API | P0 | Jika API atau basis data tidak tersedia, alur utama tetap berfungsi dari dataset seed dan UI menandai sumber data dengan benar. |

## 8. Persyaratan nonfungsional

- **Keterlacakan:** setiap ringkasan dan relasi yang tampil memiliki sumber tercatat; target cakupan untuk data MVP adalah 100%.
- **Akurasi identitas:** jangan gabungkan dua record hanya karena nama atau simbolnya mirip.
- **Aksesibilitas:** navigasi keyboard, fokus terlihat, label kontrol, peta dengan daftar relasi alternatif, dan dukungan reduced motion.
- **Responsif:** pencarian dan profil tetap dapat digunakan pada layar ponsel.
- **Kinerja:** target awal, bukan hasil terukur: pencarian seed ≤1 detik dan respons API ≤2 detik pada demo lokal.
- **Keamanan:** jangan simpan secret di source control; gunakan `.env` lokal untuk kredensial pengembangan.
- **Privasi:** MVP tidak meminta data pribadi atau menyimpan riwayat pertanyaan di server.
- **Bahasa:** UI dan konten demo memakai satu bahasa konsisten. Tim menetapkan Bahasa Indonesia atau Inggris sebelum merekam demo.

## 9. Data dan rancangan teknis

### Model data utama

- **Organism** — identitas taksonomi.
- **Entity** — gen, protein, atau proses biologis beserta identifier dan ringkasan.
- **Relationship** — relasi bertipe yang menghubungkan dua entity.
- **Source** — sumber publik dan tautan record.
- **Evidence** — klaim spesifik yang menghubungkan entity atau relationship dengan source.
- **Saved entity** — struktur untuk koleksi pengguna pada tahap berikutnya.

### Sumber awal

- NCBI Gene untuk record gen.
- UniProtKB untuk record protein dan fungsi terkait.
- Sumber relasi tambahan seperti STRING hanya setelah format, atribusi, batas penggunaan, dan kualitas evidence diperiksa.

Contoh awal yang telah dikurasi adalah INS, insulin, insulin receptor, dan homeostasis glukosa manusia. Dataset saat ini berisi 4 entity dan 3 relasi; ini seed untuk membangun serta memvalidasi alur, belum cakupan produk final.

### Arsitektur yang direncanakan

- **Web:** Next.js, React, TypeScript.
- **API:** FastAPI dengan validasi skema.
- **Penyimpanan:** PostgreSQL untuk entity, identifier, relasi, source, dan evidence.
- **Graf:** Cytoscape.js untuk peta relasi.
- **Pengembangan lokal:** Docker Compose.
- **Seed dan fallback:** JSON terkurasi sebagai sumber data awal ketika API/database belum tersedia.

Prinsip batas sistem: browser berkomunikasi melalui route handler web; route handler meneruskan permintaan ke API; API membaca basis data dan mempertahankan fallback seed. Integrasi eksternal melewati lapisan API, menormalisasi record sebelum disimpan, dan mempertahankan provenance.

## 10. Status fondasi saat PRD dibuat

Bagian ini membedakan kemampuan yang sudah ada dari kebutuhan MVP yang masih harus diselesaikan. Status berikut merujuk pada workspace per 24 November 2026.

| Area | Status saat ini | Pekerjaan berikutnya |
|---|---|---|
| UI Explore | Pencarian, filter, profil, sumber, daftar relasi, peta Cytoscape, koleksi lokal, dan halaman Evidence sudah dibuat. | Tinjau bersama teman; pastikan alur ponsel dan label bahasa sesuai pengguna. |
| API dan data | Route web, FastAPI, skema PostgreSQL, migration, dan JSON seed sudah dibuat. Fallback seed tersedia. | Jalankan seluruh stack bersama database; pastikan hasil database dan fallback konsisten. |
| Dataset | Empat entity dan tiga relasi pada contoh INS. | Pilih serta kurasi topik tambahan; pastikan setiap klaim dan relasi memiliki sumber. |
| Pendamping belajar | Jawaban disusun dari ringkasan dan relasi seed; belum memakai LLM. | Tambahkan perilaku “bukti tidak cukup” dan periksa kecocokan jawaban terhadap pertanyaan. |
| Sumber eksternal | Belum ada ingest atau refresh otomatis dari NCBI, UniProt, atau STRING. | Tetapkan satu sumber tambahan dan cara normalisasi sebelum membuat konektor. |
| Validasi | Belum ada pilot produk. | Rekrut 5–8 peserta dan catat baseline serta hasil dengan metode yang disepakati. |
| Simpanan | Tersimpan pada browser/perangkat lokal. | Pertahankan batasan ini untuk MVP; evaluasi sinkronisasi akun setelah hackathon. |

Build web dan pemeriksaan sintaks data/API pernah dijalankan. Integrasi PostgreSQL belum diperiksa dengan database yang sedang berjalan di workspace ini.

## 11. Metrik keberhasilan dan validasi

### Metrik pilot yang diusulkan

Jalankan pilot kecil dengan 5–8 mahasiswa tahun awal. Minta setiap peserta menyelesaikan tugas yang sama dengan cara lookup biasa dan menggunakan MoLearn.

- **Ketepatan identifikasi:** peserta memilih jenis record dan organisme yang benar.
- **Pemahaman fungsi:** peserta menjelaskan fungsi record dengan rubrik sederhana yang ditinjau anggota tim.
- **Pemahaman relasi:** peserta dapat menyebutkan satu relasi dan membuka record terkait.
- **Pemeriksaan sumber:** peserta menemukan sumber yang mendukung klaim.
- **Waktu tugas:** bandingkan waktu menyelesaikan tugas dengan metode lookup biasa.
- **Kejelasan:** minta peserta menilai kemudahan membedakan record dan memahami hubungan.

Target awal tim adalah mengurangi waktu menemukan profil yang tepat sebesar 20%. Angka ini adalah **target**, bukan hasil. Setelah pilot, laporkan jumlah peserta, metode, tugas, hasil, dan keterbatasan.

### Syarat sebelum mengklaim dampak

- Tim memiliki catatan tugas dan data pilot yang dapat ditinjau.
- Baseline dan cara menghitung waktu ditetapkan sebelum pengujian.
- Hasil tidak disamakan dengan survei kebutuhan awal.
- Materi presentasi menyebut ukuran sampel dan keterbatasan.

## 12. Kesesuaian dengan bobot penilaian

| Kriteria STACK 2026 | Bobot | Bukti yang harus ditampilkan |
|---|---:|---|
| Pemahaman masalah | 25% | Persona mahasiswa awal, konteks kebingungan record, metode dan hasil survei awal tim. |
| Desain solusi | 25% | Satu alur pencarian hingga bukti: disambiguasi, profil, relasi, pendamping belajar. |
| Kelayakan teknis | 20% | Model data dengan provenance, batas web/API/database, peta interaktif, strategi fallback. |
| Eksekusi dan validasi | 20% | Prototipe berjalan, riwayat keputusan, pilot kecil, metrik, dan keterbatasan yang dilaporkan. |
| Komunikasi | 10% | Demo singkat yang menunjukkan masalah, alur solusi, bukti sumber, hasil validasi, dan langkah berikutnya. |

## 13. Pembagian kerja untuk dua orang

Pembagian ini **usulan awal** karena kekuatan dan ketersediaan teman belum dicatat. Kalian dapat menukar pemilik tugas, tetapi setiap kebutuhan harus punya satu pemilik utama.

| Area | Tana — usulan pemilik | Teman — usulan pemilik | Dikerjakan bersama |
|---|---|---|---|
| Produk dan prioritas | Estimasi teknis dan pemecahan kebutuhan menjadi tugas | Menjaga fokus pengguna dan mencatat keputusan | Mengunci P0 dan memotong scope bila terlambat |
| Web/API/database | Implementasi UI, API, skema, integrasi | Review alur dan mencoba skenario pengguna | Meninjau perubahan besar sebelum masuk branch utama |
| Data dan evidence | Membuat format ingest dan validasi teknis | Memeriksa record, sumber, dan ringkasan biologis | Memastikan setiap klaim punya provenance |
| Validasi | Menyiapkan pencatatan waktu dan tugas | Merekrut peserta, memandu sesi, mencatat temuan | Menganalisis hasil dan menentukan perbaikan |
| Presentasi | Menjelaskan arsitektur dan batas teknis | Menjelaskan masalah, pengguna, dan bukti | Menulis demo, proposal, dan jawaban juri |

## 14. Rencana sampai tenggat

Rencana ini disusun dari tanggal PRD dan tenggat handbook tim. Sesuaikan jika jadwal resmi tim berbeda.

| Tanggal | Hasil kerja |
|---|---|
| 24 Nov | Tinjau dan sepakati PRD, peran, bahasa demo, serta scope data. |
| 25–26 Nov | Stabilkan pencarian dan profil; validasi data dan tautan sumber; siapkan dataset untuk skenario demo. |
| 27 Nov | Rapikan peta relasi, pendamping belajar, fallback, dan integrasi web/API/database. |
| 28 Nov | Jalankan pilot kecil; catat metrik dan temuan tanpa mengubahnya menjadi klaim berlebihan. |
| 29 Nov | Terapkan perbaikan prioritas, siapkan proposal/video/demo, dan lakukan pemeriksaan akhir. |
| 30 Nov | Bekukan perubahan, pastikan seluruh artefak siap, dan submit sebelum 23.59 WIB. |

## 15. Risiko dan keputusan terbuka

| Pertanyaan | Asumsi kerja sementara | Pemilik keputusan |
|---|---|---|
| Bahasa UI/demo? | Tetapkan satu bahasa untuk semua layar dan narasi. | Berdua |
| Cakupan data final? | Mulai dari topik yang cukup untuk menguji alur, lalu tambah cluster yang disepakati. | Berdua |
| Integrasi sumber eksternal? | Jangan mengandalkan API eksternal saat demo; simpan seed yang tervalidasi. | Tana + teman untuk review data |
| Model AI? | Jangan menambahkan model sampai retrieval, sitasi, biaya, dan fallback jelas. | Berdua |
| Siapa merekrut pilot? | Teman menjadi pemilik awal, Tana menyiapkan tugas dan pencatatan. | Teman |
| Apakah target 20% layak? | Pertahankan sebagai hipotesis sampai baseline dan pilot selesai. | Berdua |

## 16. Definition of Done untuk MVP

MVP siap dinilai ketika:

- Pengguna dapat menyelesaikan alur utama tanpa arahan tim.
- Record bernama mirip tampil sebagai jenis dan identifier berbeda.
- Profil dan relasi menampilkan sumber yang bisa dibuka.
- Pendamping belajar tidak mengarang fakta di luar data dan dapat menyatakan bukti tidak cukup.
- UI berfungsi pada desktop dan ponsel, termasuk alternatif tekstual bagi peta.
- Demo dapat berjalan dari seed lokal jika layanan eksternal tidak tersedia.
- Angka survei, target pilot, dan hasil aktual ditandai terpisah.
- Kedua anggota tim memahami fitur, batas, dan kontribusi kode yang akan dipresentasikan.

## 17. Referensi kerja

- Handbook STACK 2026 yang diberikan tim — bobot penilaian dan tenggat pengumpulan.
- Proposal awal MoLearn yang diberikan tim — konteks produk dan teknologi yang diusulkan.
- NCBI Gene 3630: https://www.ncbi.nlm.nih.gov/gene/3630
- UniProtKB P01308: https://www.uniprot.org/uniprotkb/P01308
- UniProtKB P06213: https://www.uniprot.org/uniprotkb/P06213

## Catatan penggunaan AI

Codex membantu menyusun draft PRD dan fondasi proyek. Kedua anggota tim perlu meninjau isi, mengoreksi keputusan yang tidak sesuai kesepakatan, memahami kode yang akan dipresentasikan, serta mengikuti aturan pengungkapan penggunaan AI pada handbook STACK 2026.
