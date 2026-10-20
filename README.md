# Madan Official Market

Website katalog responsif berbasis HTML, CSS, dan JavaScript. Dapat dipublikasikan gratis dengan GitHub Pages.

## Isi file
- `index.html` — struktur halaman, katalog, kontak, dan panel tambah produk.
- `style.css` — desain responsif.
- `script.js` — pencarian, kategori, pengurutan, form tambah produk lokal, dan tombol WhatsApp.
- `products.js` — katalog publik yang bisa diedit untuk produk yang terlihat semua pengunjung.

## Jalankan di GitHub Pages dari HP Android
1. Ekstrak ZIP ini di HP.
2. Buka GitHub di browser dan masuk ke akunmu.
3. Buat repository baru, misalnya `madan-official-market`.
4. Unggah empat file: `index.html`, `style.css`, `script.js`, dan `products.js` ke halaman utama/root repository.
5. Buka **Settings → Pages**.
6. Di bagian **Build and deployment**, pilih **Deploy from a branch**, branch `main`, folder `/(root)`, lalu tekan **Save**.
7. Tunggu proses publikasi, kemudian buka URL yang ditampilkan di halaman Pages.

## Cara menambah produk agar tampil untuk semua pengunjung
Edit `products.js`. Tambahkan objek baru di dalam array `window.MADAN_PRODUCTS`, pisahkan antarobjek dengan koma. Contoh:

```js
{
  id: "produk-3",
  name: "Nama Produk",
  price: 125000,
  category: "Game",
  description: "Deskripsi dan informasi produk.",
  image: "images/foto-produk.jpg",
  createdAt: "2026-10-21T00:00:00.000Z"
}
```

Untuk foto lokal, buat folder `images` di repository lalu unggah gambar ke sana. Pastikan path pada `image` sama persis. Bisa juga memakai URL gambar publik yang stabil. Setelah itu commit perubahan; produk akan tampil setelah GitHub Pages selesai memperbarui situs.

## Panel “Kelola Produk” — batasan penting
Form tambah produk bekerja tanpa backend, tetapi hasilnya hanya disimpan di penyimpanan browser/perangkat tempat form digunakan. Produk tersebut **tidak otomatis terlihat oleh pengunjung lain**, tidak tersinkron ke HP lain, dan dapat hilang jika data situs browser dibersihkan. Untuk katalog publik, edit `products.js` seperti petunjuk di atas. Agar posting bisa dilakukan dari website dan langsung tersimpan untuk semua pengunjung, perlu backend/database online dan autentikasi pengelola.

## Chat
Tombol pesan membuka WhatsApp dengan teks pesanan yang sudah disiapkan. Pembeli dapat memilih salah satu dari:
- 0851-2017-0736
- 0812-9276-6723

Website statis ini belum menyediakan chat internal real-time; fitur itu memerlukan layanan backend tambahan.

## Catatan keamanan
Ini adalah katalog/pemesanan, bukan sistem pembayaran otomatis. Konfirmasikan produk, harga, kepemilikan, dan ketentuan transaksi sebelum pembayaran. Jangan menaruh kata sandi atau data rahasia di file publik repository.
