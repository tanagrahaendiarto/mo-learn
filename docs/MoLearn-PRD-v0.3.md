# MoLearn
## Product Requirements Document
**Versi:** 0.3 — usulan untuk review tim  
**Tanggal:** 24 November 2026  
**Tim:** Belom ke Push  
**Selected case:** Case 1: Smarter Campus and Learning  
**Anggota:** Ghilar Reydhika Agusta (leader), Tana Graha Endioarto, Muhammad Farand, Muhammad Fauzan Zulfaqar  
**Target pengumpulan:** 30 November 2026, 23.59 WIB, berdasarkan PRD awal; wajib dikonfirmasi ke handbook.

> Dokumen ini menyelaraskan rancangan MVP dengan abstrak tim. Seluruh fitur, ukuran dataset, target kinerja, pembagian peran, dan jadwal merupakan rencana, kecuali dinyatakan sebagai temuan survei. Status kode belum diaudit. Dokumen ini tidak menggantikan atau mengubah abstrak yang sudah ada.

## 1. Ringkasan eksekutif
MoLearn adalah aplikasi web responsif untuk membantu mahasiswa awal ilmu hayati mengenali entitas biologis yang tepat, memahami fungsi dasarnya, dan menelusuri hubungan biologis melalui sumber yang dapat diperiksa.

Pengguna mencari nama, simbol, alias, atau identifier; membandingkan hasil yang berlabel jenis dan organisme; membuka profil sederhana; menelusuri peta relasi; menyimpan entitas; lalu bertanya kepada pendamping belajar berbasis LLM yang dibatasi oleh record terpilih dan bukti relevan.

**Janji produk:** satu alur untuk memastikan identitas, memahami konteks, dan memeriksa bukti—tanpa meminta pemula menggabungkan sendiri informasi dari banyak halaman teknis.

**Keputusan produk utama:** eksplorasi tetap menjadi alur utama sesuai abstrak. Latihan singkat menjadi fitur tambahan setelah alur inti stabil, bukan perubahan produk menjadi aplikasi kuis. LLM tetap masuk MVP sesuai abstrak, tetapi bukan pengganti sumber ilmiah.

## 2. Masalah dan bukti awal
Mahasiswa dapat menemukan istilah yang sama atau mirip pada record berbeda. Gen dan produk proteinnya berkaitan tetapi bukan entitas yang sama; organisme berbeda dapat memiliki nama mirip; informasi fungsi dan relasi tersebar di beberapa sumber. Kesalahan memilih record dapat menyebabkan salah identifier, salah konteks fungsi, atau sumber yang tidak sesuai dengan tugas.

### Temuan survei tim
Sumber: survei “Survei Singkat: Belajar Mengenal Gen, Protein, dan Enzim”, 8 November 2026, sebagaimana dilaporkan dalam abstrak; 19 responden dari Bioinformatika, Biokimia, Biologi, dan program terkait.

| Temuan | Angka dalam abstrak |
|---|---|
| Pernah bingung menghadapi gen, protein, atau enzim yang tidak dikenal | 17/19 (89%) |
| Pernah memilih entri keliru karena kemiripan nama | 15/19 (79%) |
| Membuka sedikitnya empat sumber | 8/19 (42%) |
| Menghabiskan sedikitnya 15 menit | 15/19 (79%) |
| Kesulitan memahami hubungan gen, protein, dan proses | 37% |
| Kesulitan menemukan informasi yang tersebar | 32% |

Angka terakhir dipertahankan sebagaimana abstrak; denominasi dan bentuk pertanyaannya harus diperiksa sebelum dianalisis lebih lanjut. Temuan ini bukan hasil uji MoLearn, bukan estimasi populasi, dan belum membuktikan penyebab kebingungan.

### Validasi masalah tambahan
Observasi 3–5 calon pengguna menyelesaikan tugas lookup nyata. Catat istilah yang dicari, kandidat yang dipilih, alasan pilihan, sumber yang dibuka, dan titik kebingungan. Gunakan temuan untuk memilih skenario demo, bukan menambah fitur tanpa bukti.

## 3. Pengguna dan jobs to be done
**Pengguna utama:** mahasiswa tahun pertama atau kedua ilmu hayati, terutama Bioinformatika dan Biokimia, yang belum terbiasa membaca record basis data ilmiah.

**Konteks:** tugas kuliah meminta penjelasan entitas biologis; pengguna perlu memastikan jenis, organisme, fungsi, dan relasi sebelum memakai informasi tersebut.

> Saat menemukan nama biologis yang asing, saya ingin memilih record yang sesuai, memahami perannya, dan menemukan bukti pendukungnya supaya dapat mengerjakan tugas tanpa menebak dari hasil yang mirip.

Peneliti yang membutuhkan pencarian menyeluruh, analisis omik, atau analisis sekuens bukan sasaran MVP.

## 4. Nilai produk dan batas klaim
MoLearn tidak menggantikan NCBI Gene, Ensembl, UniProt, atau buku teks. Pembeda yang diusulkan adalah penyajian ramah pemula yang menjaga pemisahan identitas dan menghubungkan profil, relasi, serta bantuan belajar dengan bukti spesifik.

| Alternatif | Kekuatan | Nilai tambahan yang diuji di MoLearn |
|---|---|---|
| Basis data ilmiah | Record dan anotasi teknis | Identitas diprioritaskan; rincian teknis dapat dibuka bertahap |
| Mesin pencari umum | Menemukan halaman | Hasil terstruktur menurut jenis dan organisme |
| Buku atau slide | Penjelasan konsep | Konsep terhubung dengan record dan identifier nyata |
| Chatbot umum | Pertanyaan fleksibel | Jawaban dibatasi konteks terpilih dan sitasi yang dapat ditelusuri |

Tidak ada klaim bahwa MoLearn merupakan solusi pertama, selalu lebih akurat, atau telah meningkatkan pembelajaran. Keunggulan harus didukung pilot.

## 5. Tujuan dan bukan tujuan
### Tujuan MVP
1. Pengguna memilih record sesuai jenis entitas dan organisme yang dibutuhkan.
2. Pengguna menjelaskan fungsi dasar melalui profil yang mudah dibaca.
3. Pengguna memahami satu hubungan biologis dan membuka record terkait.
4. Pengguna menemukan sumber yang mendukung klaim atau jawaban.
5. Tim memiliki demo stabil dan data pilot yang dapat ditinjau.

### Bukan tujuan
Cakupan semua organisme; pengganti basis data; diagnosis atau saran klinis; analisis sekuens; prediksi struktur; akun multi-pengguna; kurasi kolaboratif; sinkronisasi koleksi; dan klaim dampak pembelajaran jangka panjang.

## 6. Cakupan dataset
**Usulan tema demo:** insulin dan pengaturan glukosa, dimulai dari record INS, produk proteinnya, dan reseptor insulin. Tema dikunci setelah observasi singkat dan review tim.

Target kerja 12–20 entitas jika kurasi memungkinkan. Tidak mengejar jumlah dengan mengorbankan bukti. Sebelum pilot, bekukan daftar entitas dan versi dataset.

Cakupan minimum berbasis kasus:
- Sedikitnya dua pasangan gen–protein untuk menunjukkan alur bukan hanya satu contoh.
- Contoh protein dengan fungsi enzimatik yang bukti fungsinya sudah ditinjau, sesuai cakupan abstrak.
- Sedikitnya satu kasus nama mirip lintas organisme jika organisme menjadi bagian evaluasi.
- Alias yang merujuk entitas sama, identifier langsung, hasil kosong, dan pertanyaan di luar cakupan.
- Relasi cukup untuk menguji perpindahan profil dan penelusuran bukti.

**Taksonomi:** enzim bukan kategori identitas yang dipisahkan secara eksklusif dari protein. Untuk demo ini, protein berfungsi enzimatik tetap bertipe protein dan diberi label fungsi enzimatik. Label tersebut tidak menyatakan bahwa seluruh enzim dalam biologi selalu protein.

Konsep proses atau reaksi boleh menjadi node konteks, tetapi diberi label jelas dan bukan fokus perluasan cakupan. Jangan membuat edge “catalyzes” ke proses umum tanpa objek reaksi dan dukungan yang tepat.

UI selalu menampilkan bahwa pencarian dibatasi dataset demo. Data tidak tersedia ditulis “belum tersedia”, bukan dilengkapi melalui tebakan model.

## 7. Alur pengguna utama
1. **Explore:** pengguna mencari istilah, misalnya INS. Contoh pencarian tersedia untuk pengguna yang belum punya istilah.
2. **Pilih record:** hasil menampilkan nama, jenis, organisme, sumber, identifier, dan satu kalimat pembeda. Pengguna dapat memfilter jenis dan organisme.
3. **Pahami profil:** bagian utama menjawab “apa ini?”, “apa fungsinya?”, dan “pada organisme serta konteks lokasi apa?”. Lokasi ekspresi/subseluler hanya ditampilkan jika bersumber; dibedakan dari organisme.
4. **Buka Advanced details:** identifier tambahan dan informasi teknis tidak mendominasi tampilan awal.
5. **Jelajahi hubungan:** pengguna memilih node atau baris daftar relasi, membaca makna hubungan, lalu membuka profil terkait.
6. **Tanya pendamping:** pertanyaan contoh atau pertanyaan bebas dikirim bersama konteks entity terpilih. Jawaban menautkan klaim ke bukti yang relevan.
7. **Simpan:** pengguna menyimpan entity ke koleksi browser dan membukanya kembali.
8. **Periksa sumber:** pengguna membuka panel bukti atau tautan sumber asli kapan pun diperlukan.

## 8. Struktur antarmuka
### Explore
Kolom pencarian, contoh query, filter, hasil terstruktur, penanda cakupan dataset, dan state tanpa hasil.

### Entity profile
Header identitas tetap terlihat; ringkasan bahasa sederhana; bagian fungsi; konteks lokasi jika tersedia; Advanced details; tombol simpan; panel sumber.

### Relationships
Peta berukuran kecil dengan legenda dan label edge; daftar tekstual setara; fokus pada tetangga entity terpilih. Peta bukan dekorasi dan tidak harus menampilkan seluruh dataset sekaligus.

### Study companion
Identitas konteks aktif, pertanyaan contoh, kolom tanya, jawaban bersitasi, indikator memuat/gagal, serta pemberitahuan keterbatasan. Ketika entity berganti, konteks lama direset atau dinyatakan jelas agar jawaban tidak tercampur.

### Collection
Simpanan lokal dengan informasi bahwa data tidak tersinkron dan dapat hilang ketika penyimpanan browser dibersihkan.

### About and evidence
Metode kurasi, cakupan data, keterbatasan, status survei/pilot, dan penggunaan AI. Halaman ini mendukung transparansi tetapi bukan penghalang alur belajar.

## 9. Prioritas fitur
| Prioritas | Fitur | Batas MVP |
|---|---|---|
| P0 | Search dan disambiguasi | Nama, simbol, alias, identifier; exact match didahulukan |
| P0 | Profil sederhana | Identitas, fungsi, konteks tersedia, sumber, Advanced details |
| P0 | Graf dan daftar relasi | Tetangga terbatas; edge bertipe dan bersumber |
| P0 | LLM study companion | Retrieval terstruktur, sitasi, penolakan ketika bukti kurang |
| P0 | Koleksi browser | Simpan/hapus/buka kembali; tanpa akun |
| P0 | Dataset snapshot | Alur penelusuran tidak bergantung API sumber saat demo |
| P0 | Penanganan kegagalan | Hasil kosong, sumber tidak tersedia, LLM timeout, data hilang |
| P1 | Latihan cek pemahaman | Satu kasus transfer; bukan jalur wajib Explore |
| P1 | Perbandingan dua record | Hanya jika label hasil belum cukup membantu |
| P1 | Perluasan topik atau importer | Setelah alur dan kurasi P0 stabil |

Ditunda: autentikasi, vector database, multi-agent, editor graf, gamifikasi, unggah dokumen, sinkronisasi koleksi, dan ingest real-time multi-sumber.

## 10. Kontrak pendamping LLM
### Konteks yang boleh digunakan
Record terpilih, klaim terkurasi terkait, tetangga yang relevan maksimal satu langkah untuk MVP, dan evidence yang dirujuk. Tidak melakukan browsing bebas atau membuka seluruh database tanpa kebutuhan.

### Pipeline minimum
1. Server memvalidasi pertanyaan dan ID entitas terhadap dataset.
2. Server mengambil konteks terstruktur dan daftar evidence yang diizinkan.
3. Model menyusun jawaban pendek dengan ID evidence, bukan membuat URL sendiri.
4. Server memvalidasi struktur keluaran dan memastikan ID sitasi termasuk evidence yang diberikan.
5. UI memetakan ID ke sumber serta menampilkan batas informasi.

Pemeriksaan ID sitasi hanya mencegah referensi fiktif; tidak membuktikan kecocokan makna. Kecocokan klaim dengan bukti tetap dinilai melalui benchmark manual sebelum rilis.

### Perilaku wajib
- Menjawab pertanyaan, bukan mengulang ringkasan untuk semua input.
- Meminta klarifikasi jika entitas atau organisme ambigu.
- Mengatakan “belum didukung dataset MoLearn” ketika konteks tidak cukup.
- Tidak menyamakan tidak adanya data dengan tidak adanya hubungan biologis.
- Tidak memberi rekomendasi diagnosis, terapi, atau dosis.
- Memperlakukan isi sumber dan pertanyaan sebagai data tidak tepercaya; instruksi di dalamnya tidak boleh mengubah aturan sistem.

### Kegagalan layanan
Jika model timeout atau tidak tersedia, aplikasi menyatakan pendamping AI sedang tidak tersedia. Profil, graf, sumber snapshot, koleksi, dan kartu penjelasan terkurasi tetap berfungsi. Kartu tersebut dilabeli non-generatif; jangan menyebutnya jawaban LLM.

### Batas operasional usulan
Pertanyaan maksimal 1.000 karakter; jawaban ditargetkan singkat; satu permintaan aktif per sesi; timeout server 30 detik; rate limit dan batas biaya ditetapkan sebelum URL dibagikan. Nilai operasional ditinjau setelah uji provider, bukan dianggap hasil terukur.

Provider dan model dipilih melalui smoke test kualitas, latensi, biaya, dan kebijakan data. Secret hanya berada di server; kredensial proxy pribadi atau langganan konsumen tidak diasumsikan sesuai untuk deployment publik.

## 11. Data, relasi, dan provenance
### Model minimum
| Objek | Isi |
|---|---|
| Organism | Taxonomy ID dan nama |
| Entity | ID internal, tipe, nama, alias, identifier berserta namespace, organisme bila relevan |
| Claim | Pernyataan atomik tentang entity |
| Relationship | Sumber, tujuan, tipe, arah, konteks, evidence |
| Source | Database, identifier record, URL, tanggal akses |
| Evidence | Klaim/relasi didukung, bagian sumber relevan, status review, peninjau |
| DatasetManifest | Versi, cakupan, tanggal kurasi |
| LocalCollection | Daftar ID entity dan versi format penyimpanan browser |

### Aturan biologis
- Record tidak digabung hanya karena nama sama.
- Gen dan protein mempunyai namespace identifier berbeda.
- Proses tidak dipaksa memiliki organisme intrinsik tunggal; konteks organisme dapat berada pada anotasi/relasi.
- “Encodes”, “binds”, “catalyzes”, “participates in”, dan “associated with” tidak saling menggantikan.
- Hubungan STRING tidak otomatis merupakan ikatan fisik atau sebab-akibat. Tipe evidence harus dipertahankan.
- Penyederhanaan pemrosesan prekursor insulin harus diberi catatan; record protein dan produk matang tidak disamakan tanpa penjelasan.

### Sumber
NCBI Gene sebagai sumber awal gen; UniProtKB untuk protein dan fungsi. Ensembl menjadi alternatif, bukan konektor wajib tambahan. STRING digunakan hanya untuk relasi yang tipe, bukti, lisensi/atribusi, dan cara pemetaannya sudah diperiksa. Jika belum siap, jangan mengklaim integrasinya berjalan.

Setiap klaim dan relasi yang dirilis harus memiliki sumber dan pemeriksaan kesesuaian bukti. Dataset divalidasi untuk ID duplikat, referensi putus, evidence kosong, namespace, dan field wajib. Ringkasan berisi beberapa fakta harus menautkan bukti yang sesuai, bukan satu URL dekoratif.

## 12. Arsitektur dan deployment
Pertahankan stack dalam abstrak: Next.js/React/TypeScript, FastAPI, PostgreSQL, dan Cytoscape.js. Hindari rewrite besar sebelum integrasi yang ada diperiksa.

- Browser mengakses route server Next.js; kredensial tidak dikirim ke browser.
- FastAPI menangani query terstruktur dan normalisasi data.
- PostgreSQL menyimpan dataset terkurasi dan provenance.
- Snapshot JSON berversi dihasilkan dari dataset yang sama, bukan dipelihara sebagai isi terpisah tanpa pemeriksaan konsistensi.
- Jika API/database gagal, route web dapat menyajikan snapshot yang dibundel pada lapisan web. Fallback di FastAPI saja tidak cukup ketika FastAPI mati.
- Integrasi LLM berada pada layanan server yang jelas; jangan menggandakan logika di beberapa lapisan.

Deployment publik, jika dibutuhkan handbook, harus diuji dari perangkat selain laptop pembuat. Docker Compose digunakan untuk pengembangan lokal bila membantu; bukan bukti bahwa deployment sudah siap.

**Batas offline:** snapshot menghilangkan ketergantungan API sumber untuk membaca konten, tetapi tidak otomatis membuat situs dapat dibuka tanpa internet. Demo lokal disiapkan sebagai cadangan. LLM dan pembukaan sumber asli tetap membutuhkan jaringan.

## 13. Persyaratan nonfungsional
- Bahasa UI dan ringkasan: Bahasa Indonesia; nama ilmiah, identifier, dan label sumber dipertahankan. Bahasa video mengikuti handbook.
- Responsif pada lebar ponsel sekitar 360 px dan desktop; tidak ada kontrol inti tersembunyi di luar layar.
- Keyboard, fokus terlihat, label kontrol, kontras memadai, dan alternatif tekstual graf.
- Target awal pencarian snapshot ≤1 detik dan profil ≤2 detik pada lingkungan uji yang dicatat; latensi LLM dilaporkan terpisah.
- Jangan meminta data pribadi untuk memakai MVP; jangan menyimpan riwayat pertanyaan di server secara default.
- Jelaskan bahwa pertanyaan ke pendamping diproses provider AI. Kebijakan retensi provider harus diperiksa, bukan diasumsikan nihil.
- Log operasional tidak memuat secret atau isi pertanyaan mentah secara default.
- Model output dan konten sumber dirender aman; batasi tautan bukti ke sumber yang tersimpan.
- Layanan eksternal memiliki timeout, pesan gagal, dan tidak melakukan retry tanpa batas.

## 14. Kriteria penerimaan
| ID | Skenario | Syarat lulus |
|---|---|---|
| AC-01 | Query nama/alias/identifier | Query uji yang dikurasi menemukan record yang dimaksud; exact identifier tidak tertukar |
| AC-02 | Disambiguasi | Gen/protein dan kandidat lintas organisme ditampilkan sebagai record terpisah |
| AC-03 | Profil | Identitas, fungsi, sumber, dan field tidak tersedia ditampilkan jujur |
| AC-04 | Advanced details | Informasi teknis dapat dibuka tanpa menghalangi ringkasan |
| AC-05 | Graf/daftar | Keduanya membuka entity terkait dan memperlihatkan tipe serta bukti edge |
| AC-06 | Koleksi | Simpan, hapus, dan buka kembali setelah reload berhasil pada browser sama |
| AC-07 | LLM didukung | Jawaban relevan, sitasi valid, dan klaim sesuai evidence pada set evaluasi |
| AC-08 | Bukti kurang | Pendamping menolak atau meminta klarifikasi, bukan mengarang |
| AC-09 | LLM gagal | Pesan gagal jelas; penelusuran non-AI tetap berfungsi |
| AC-10 | API/database gagal | Web menyajikan snapshot dan menandai mode data secara benar |
| AC-11 | Integritas dataset | Tidak ada ID duplikat, reference putus, atau klaim rilis tanpa evidence |
| AC-12 | Aksesibilitas | Alur inti selesai lewat keyboard dan layar ponsel; graf bukan satu-satunya akses |

## 15. Rencana evaluasi
### A. Benchmark LLM sebelum pilot
Siapkan 30 pertanyaan: 20 pertanyaan yang bisa dijawab dataset, 5 di luar cakupan, dan 5 ambigu atau berpremis keliru. Simpan pertanyaan, versi dataset, model, prompt, output, dan penilaian; jangan memilih hanya output yang berhasil.

Untuk 20 pertanyaan yang didukung, respons lulus jika menjawab pertanyaan dan seluruh klaim faktualnya didukung evidence yang ditautkan. Penolakan pada pertanyaan yang seharusnya dapat dijawab dihitung gagal. Target: sedikitnya 18/20 (90%) respons lulus pada benchmark tersebut, bukan klaim akurasi universal.

Untuk 10 kasus lainnya, target seluruhnya meminta klarifikasi atau menyatakan keterbatasan dengan tepat. Klaim biologis penting yang salah dan sitasi fiktif adalah penghambat rilis meskipun persentase agregat tercapai. Kegagalan ditangani dengan perbaikan retrieval/prompt, pembatasan cakupan, lalu pengujian ulang yang dicatat.

### B. Pilot 5–8 mahasiswa
Gunakan dua set tugas sebanding dan seimbangkan urutan MoLearn versus lookup biasa. Catat definisi lookup biasa: sumber yang boleh dipakai, aturan penggunaan chatbot, batas waktu, dan bantuan fasilitator. Peserta tidak diberi jawaban melalui onboarding.

| Metrik | Definisi dan target dari abstrak |
|---|---|
| Identitas | ≥80% peserta menyelesaikan tugas pemilihan jenis/organisme dengan benar |
| Fungsi | ≥80% memenuhi rubrik fungsi yang ditetapkan sebelum sesi |
| Relasi | ≥80% mengenali relasi dan membuka record terkait |
| Jawaban bersumber | Dinilai melalui benchmark terpisah dan dicatat juga pada sesi pilot |
| Waktu | Target median pengurangan waktu berpasangan ≥20% untuk tugas mencapai profil benar |

Rubrik fungsi: 0 salah/tidak menjawab; 1 sebagian benar tetapi fungsi inti terlewat; 2 fungsi inti benar tanpa kesalahan utama. Tetapkan ambang lulus sebelum pilot, usulan skor 2.

Persentase waktu per peserta = (waktu baseline − waktu MoLearn) / waktu baseline × 100%. Analisis waktu utama hanya untuk pasangan tugas yang sama-sama berhasil; jumlah kegagalan dan timeout tetap dilaporkan agar peningkatan waktu tidak menutupi salah jawab. Sebut jumlah pasangan yang dianalisis.

Laporkan jumlah mentah: pada 5 peserta, target ≥80% berarti minimal 4 berhasil; pada 8 peserta berarti minimal 7. Pisahkan ketiga jenis tugas, jangan menutupi kelemahan lewat rata-rata gabungan.

Pilot merupakan evaluasi eksploratif, bukan bukti dampak populasi atau retensi belajar jangka panjang. Target yang tidak tercapai tetap dilaporkan. Persetujuan peserta dan data anonim diperlukan; rekaman hanya dengan izin.

## 16. Pembagian kerja empat anggota
Pembagian awal berdasarkan fungsi; nama pemilik dikunci dalam rapat tim, bukan ditebak dari kemampuan yang belum diketahui.

| Peran | Tanggung jawab | Hasil wajib |
|---|---|---|
| Produk dan validasi | Scope, observasi, rekrutmen, instrumen, analisis pilot | Skenario dan catatan evaluasi |
| Frontend dan UX | Explore, profil, graf/daftar, koleksi, responsif | Alur utuh yang dapat dipakai |
| Backend dan AI | Skema, snapshot, API, retrieval, LLM, deployment | Integrasi dan fallback teruji |
| Data dan komunikasi | Kurasi sumber, review biologis, materi demo/proposal | Dataset ditinjau dan narasi berbukti |

Ghilar sebagai leader mengoordinasikan penetapan pemilik dan penyelesaian hambatan. Setiap area memiliki satu penanggung jawab dan satu peninjau. Kurator tidak menjadi satu-satunya orang yang menyetujui klaim biologis penting. Semua anggota memahami alur, batas sistem, dan kontribusinya.

## 17. Jadwal dan batas pemotongan
| Tanggal | Hasil |
|---|---|
| 24 Nov | Cek handbook, kunci peran, tema, bahasa, scope, dan provider uji |
| 25 Nov | Observasi masalah; kurasi batch awal; satu alur search–profile–source berjalan |
| 26 Nov | Graf/daftar, koleksi, integrasi LLM dasar dan benchmark awal |
| 27 Nov | Bekukan dataset pilot; uji integrasi, fallback, ponsel, dan benchmark LLM |
| 28 Nov | Pilot 5–8 peserta; catat hasil tanpa mengubah metode setelah melihat angka |
| 29 Nov | Perbaiki blocker; benchmark ulang bila ada perubahan; rekam demo dan finalisasi proposal |
| 30 Nov | Bekukan fitur; periksa seluruh artefak; submit dengan waktu cadangan |

Jika terlambat: potong P1, perluasan dataset di luar kasus wajib, animasi, dan importer terlebih dahulu. Jangan memotong ketepatan identitas, provenance, atau penanganan kegagalan.

Jika pendamping LLM belum layak sebelum pilot, uji alur non-AI secara terpisah dan laporkan status LLM secara terbuka. Menghapus LLM dari komitmen MVP memerlukan keputusan tim dan penyesuaian materi pengumpulan; fallback terkurasi tidak boleh dipresentasikan seolah memenuhi janji LLM dalam abstrak.

## 18. Demo dan artefak pengumpulan
Demo singkat memperlihatkan masalah, bukan daftar menu:
1. Cari istilah yang memiliki kandidat gen/protein atau organisme berbeda.
2. Jelaskan alasan memilih satu record melalui label identitas.
3. Baca fungsi sederhana dan buka Advanced details.
4. Ikuti satu edge, lihat maknanya, lalu buka buktinya.
5. Ajukan satu pertanyaan LLM yang didukung dan satu yang di luar cakupan.
6. Simpan entity dan buka kembali koleksi.
7. Tampilkan hasil pilot nyata, ukuran sampel, serta batasnya.

Artefak: aplikasi sesuai persyaratan handbook, dataset berversi, README menjalankan proyek, contoh konfigurasi tanpa secret, ringkasan arsitektur, laporan pilot, benchmark LLM, video/demo cadangan, serta pengungkapan penggunaan AI.

## 19. Risiko dan mitigasi
| Risiko | Mitigasi |
|---|---|
| Produk terasa hanya database viewer | Sorot keputusan identitas dan hubungan bersumber pada demo; uji manfaatnya |
| Dataset terlalu sempit | Penuhi variasi kasus wajib; tampilkan cakupan secara jujur |
| Penyederhanaan biologis salah | Review klaim, arah edge, konteks, dan pemrosesan prekursor |
| Jawaban LLM tidak didukung | Retrieval terbatas, validasi ID sitasi, benchmark manual, abstention |
| API sumber berubah atau dibatasi | Snapshot terkurasi; jangan bergantung ingest langsung saat demo |
| Stack banyak lapisan gagal | Uji end-to-end lebih awal; fallback tersedia di lapisan web |
| Efek latihan mengacaukan pilot | Set tugas sebanding dan urutan berimbang |
| Biaya atau latensi AI membesar | Batas input/output, rate limit, timeout, budget, dan monitoring agregat |
| Angka target dianggap hasil | Label target/hasil terpisah di aplikasi, laporan, dan pitch |

## 20. Definition of Done
MVP siap diajukan ketika:
- Alur search–identity–profile–relationship–source dapat diselesaikan tanpa arahan pembuat.
- Dataset rilis lolos pemeriksaan teknis dan review biologis.
- Graf dan daftar konsisten, koleksi lokal berfungsi, dan UI dapat dipakai di ponsel.
- LLM diuji dengan benchmark tersimpan; kegagalan serta keterbatasannya dinyatakan.
- Fallback API/database dan kegagalan LLM telah diuji nyata, bukan hanya direncanakan.
- Pilot dijalankan atau, bila tidak terlaksana, status tersebut dilaporkan tanpa hasil rekaan.
- Target, survei kebutuhan, dan hasil aktual tidak dicampur.
- Deployment/artefak sesuai handbook; tidak ada secret di repo atau browser.
- Semua anggota menyetujui scope dan memahami kontribusi yang dipresentasikan.

## 21. Keputusan yang harus dikunci
1. Persyaratan resmi AI, hosting, format artefak, dan tenggat.
2. Pemilik setiap peran dari empat anggota.
3. Tema demo dan daftar kasus wajib final.
4. Provider/model, budget, dan kebijakan data LLM.
5. Lingkungan deployment dan perangkat demo cadangan.
6. Instrumen survei mentah dan ketersediaan peserta pilot.

## 22. Referensi dan status verifikasi
- Abstrak tim MoLearn, dibaca 24 November 2026: https://docs.google.com/document/d/1TxZpkmEE9_TrrwHIxm7jCkBMpRcfRLZZ/edit
- PRD Draft 0.1 yang dilampirkan tim: konteks implementasi dan tenggat; status workspace belum diverifikasi dalam penyusunan dokumen ini.
- Survei tim 8 November 2026: angka diambil dari abstrak; instrumen dan data mentah belum diperiksa.
- NCBI Gene 3630: https://www.ncbi.nlm.nih.gov/gene/3630
- UniProtKB P01308: https://www.uniprot.org/uniprotkb/P01308
- UniProtKB P06213: https://www.uniprot.org/uniprotkb/P06213

Tautan record di atas merupakan titik awal kurasi, bukan pengganti pemeriksaan bukti untuk setiap klaim. Handbook belum dibaca; tidak ada bobot penilaian yang dianggap telah terverifikasi.

**Catatan editorial:** gunakan “MoLearn” secara konsisten. Variasi “moLearn” dan “EmoLearn” pada abstrak perlu ditinjau tim sebelum pengumpulan berikutnya.
