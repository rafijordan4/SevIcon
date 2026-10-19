# SevIcon untuk Acode

Plugin Acode untuk mengatur ikon bahasa pemrograman, tipe file, dan folder, lengkap dengan sistem icon pack (impor/ekspor ZIP).

> **Status jujur:** plugin ini sudah lulus tes otomatis untuk logika intinya (lihat bagian Pengujian), tetapi **belum diuji langsung di aplikasi Acode** karena lingkungan pembuatnya tidak punya Acode. Bagian yang bergantung pada API Acode ditandai "belum terverifikasi".

## Cara pasang (Android, tanpa komputer)

1. Simpan `SevIcon-1.0.0.zip` di HP.
2. Buka Acode → menu (☰) → **Plugins** → ikon **+ / Install from file** (nama menu bisa berbeda antar versi) → pilih ZIP.
3. Aktifkan plugin SevIcon.

## Cara membuka SevIcon

- **Palet perintah** Acode (Ctrl+Shift+P / menu perintah) → ketik **"SevIcon: Open icon customizer"**.
- Tombol **Open SevIcon** di sidebar plugin (jika versi Acode kamu mendukung `sidebarApps`, belum terverifikasi).
- Halaman terbuka sebagai halaman plugin tersendiri. Bukan file `.txt` palsu, tidak menyentuh file proyek, dan tab editor tetap utuh. Jika `page`/`WCPage` tidak tersedia, SevIcon tampil sebagai layar penuh dengan tombol Close.

## Fitur

- Overview, Languages, File Types, Folders, Icon Library, My Packs, Settings.
- 72 ikon bawaan (39 dasar + 33 varian bulat), semua SVG **orisinal buatan sendiri**, tanpa icon pack pihak ketiga, jadi tidak ada atribusi lisensi lain. Tidak butuh internet.
- Ubah ikon per tipe file/bahasa/folder, tambah ekstensi kustom (mis. `.abc`), cocok huruf besar/kecil, ikon cadangan `file`.
- Impor ikon SVG/PNG/WebP sendiri (SVG ≤ 100 KB, PNG/WebP ≤ 200 KB; SVG berskrip/tautan eksternal ditolak).
- Pack: buat, ganti nama, duplikat, hapus, aktifkan, reset, impor ZIP, ekspor ZIP. Pack bawaan bersifat baca-saja; saat pertama mengubah ikon, SevIcon menawarkan salinan "My Icons".
- Perubahan tidak pernah diterapkan diam-diam: selalu lewat tombol Apply/Cancel/Reset dan konfirmasi untuk aksi merusak.

## Format pack

```
SevIcon-Pack/            (folder pembungkus tunggal boleh ada atau tidak)
  manifest.json
  icons/
    python.svg
    ...
```

`manifest.json`:

```json
{
  "format": "sevicon-pack",
  "formatVersion": 1,
  "name": "My Pack",
  "icons": [{ "id": "python", "name": "Python", "file": "icons/python.svg", "mime": "image/svg+xml" }],
  "assignments": { "python": "python" }
}
```

Validasi impor: hanya `manifest.json` dan `icons/<nama>.svg|png|webp`; path dengan `..`, `/` di awal, `\`, atau file lain ditolak; maks 400 entri, 5 MB total; ZIP terenkripsi/ZIP64 ditolak; checksum diperiksa; impor selalu membuat pack baru, tidak menimpa pack yang ada.

## Batasan Acode (penting)

- Dari dokumentasi resmi yang berhasil saya baca (`acode.setPluginInit`, `setPluginUnmount`, `addIcon`, `require`, dll.), **tidak ada API publik untuk menambah tab di samping tab file atau mengaitkan aksi ke tombol plus (+)**. Jadi SevIcon tidak dipasang ke tombol plus dan tidak dibuat sebagai file palsu.
- **Tidak ada API publik terdokumentasi untuk mengganti ikon bawaan file browser Acode.** Ikon kustom pasti tampil di panel SevIcon sendiri.
- Ada opsi **eksperimental** "native styling" (Settings, mati secara default) yang menyuntikkan CSS ke kelas `.file_type_<ext>`. Itu bergantung pada nama kelas internal yang **tidak saya verifikasi**, jadi bisa tidak berefek sama sekali. Jangan anggap ikon native Acode berubah kecuali kamu melihatnya sendiri.
- Folder: hanya status tertutup/terbuka yang bisa dikustomisasi dan ditampilkan di panel SevIcon.
- Ikon plugin (`icon.png`) putih transparan; bisa kurang terlihat di tema terang.

## API yang dipakai (semua dicek dengan `try/catch`)

`acode.setPluginInit`, `acode.setPluginUnmount`, `acode.addIcon`, `acode.require('page' | 'WCPage' | 'confirm' | 'alert' | 'prompt' | 'toast' | 'fileBrowser' | 'fsOperation' | 'sidebarApps')`, `acode.fsOperation`, `editorManager.editor.commands.addCommand/removeCommand`. Selain itu: `localStorage`, `<input type=file>`, `DecompressionStream`.
Yang **belum terverifikasi di Acode asli**: nama/parameter `page`/`WCPage`, `sidebarApps.add/remove`, `fileBrowser`+`fsOperation.createFile` untuk simpan ekspor (ada cadangan unduhan browser), dan `fsOperation.readFile/writeFile` untuk salinan data di file cache plugin.

## Penyimpanan

Data (penugasan ikon, ekstensi kustom, pack, ikon impor, tema, ukuran ikon) disimpan di `localStorage` dan disalin ke file cache plugin bila tersedia. Cache plugin bisa dibersihkan Acode, makanya ekspor pack secara berkala. Data lama dimigrasi tanpa menghapus pengaturan; data rusak diabaikan dengan aman. Tidak ada jaringan, telemetri, atau analitik.

## Logo

Logo di `assets/sevicon-logo.svg` dan `icon.png` adalah **placeholder orisinal** (file putih dengan "7" dan panah unduh) karena gambar logo referensi tidak ikut terkirim. Ganti kedua file itu dengan logo aslimu (putih, latar transparan), lalu jalankan ulang zip. UI memakai logo dari `src/core.js` (`LOGO_SVG`); ubah di sana lalu `node build.js`.

## Pengembangan

```
node build.js      # gabungkan src/*.js menjadi main.js (tidak perlu bundler)
node test/test.js  # jalankan tes
```

## Pengujian

Lihat `TEST-RESULTS.md` untuk hasil yang benar-benar dijalankan. Tes UI/DOM, tata letak mobile, dan instalasi di Acode **tidak** dijalankan.

Lisensi: MIT.
