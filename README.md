# MyFinSync

Aplikasi pencatatan keuangan pribadi berbasis web (mobile-first) untuk mencatat pemasukan & pengeluaran, merencanakan budget, dan mewujudkan target tabungan — dengan dukungan pencatatan suara bertenaga AI.

## Fitur

- **Autentikasi** — register, login, lupa/reset password via Supabase Auth
- **Dashboard** — saldo bersih, grafik rasio arus kas, pengeluaran terbesar, distribusi dompet, riwayat transaksi
- **Pencatatan transaksi** — manual atau **voice AI** (Web Speech + Google Gemini) untuk pemasukan & pengeluaran
- **Transfer antar dompet** — termasuk biaya admin
- **Laporan** — ringkasan per periode, filter, pencarian, pagination, edit transaksi, export CSV
- **Target tabungan** — buat impian, pantau progres, nabung/tarik dana
- **Perencanaan** — estimasi pengeluaran harian & bulanan
- **Multi-wallet & kategori** — kelola dompet dan kategori dari halaman Profile

## Teknologi

- **Frontend:** HTML5, CSS, JavaScript (vanilla ES6+)
- **Backend & Database:** Supabase (PostgreSQL) + Supabase Auth
- **AI:** Google Gemini 2.5 Flash (via Supabase Edge Function)
- **Lainnya:** Chart.js, Font Awesome, PWA (Service Worker + manifest)

## Persyaratan

- Akun [Supabase](https://supabase.com)
- API key [Google Gemini](https://aistudio.google.com)
- Akun [Netlify](https://netlify.com) (untuk hosting)

## Menjalankan Secara Lokal

Repo ini adalah situs statis murni — cukup jalankan server statis apa pun:

```bash
# contoh dengan Python
python -m http.server 8000
```

Lalu buka `http://localhost:8000`.

## Konfigurasi

### 1. Database & Row Level Security (RLS)

Buka **Supabase Dashboard → SQL Editor**, lalu jalankan isi `supabase/schema.sql`.

Script ini membuat semua tabel dan mengaktifkan **RLS** sehingga setiap user hanya dapat mengakses datanya sendiri. **Wajib dijalankan** — keamanan aplikasi bergantung pada ini.

> Catatan: `js/supabase.js` berisi URL proyek dan anon key yang bersifat publik. Data pengguna terlindungi oleh RLS, bukan dengan menyembunyikan anon key.

### 2. Fitur Voice AI (Gemini)

API key Gemini disimpan di server, tidak di client. Deploy Edge Function `gemini-proxy`:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase secrets set GEMINI_API_KEY=<key-anda>
supabase functions deploy gemini-proxy
```

Atau deploy manual melalui **Supabase Dashboard → Edge Functions** dan tempel isi `supabase/functions/gemini-proxy/index.ts`, lalu set env `GEMINI_API_KEY`.

## Deployment

1. Upload seluruh folder ke Netlify sebagai static site (via drag-and-drop atau git).
2. Di Supabase → **Authentication → URL Configuration**, pastikan URL domain Netlify ditambahkan ke **Redirect URLs** (agar link reset password berfungsi).

## Struktur Proyek

```
.
├── *.html                  # Halaman statis
├── css/                    # Stylesheet
│   ├── dashboard.css       # Style aplikasi (mobile)
│   └── auth.css            # Style halaman autentikasi
├── js/                     # Modul JavaScript
│   ├── supabase.js         # Inisialisasi klien Supabase
│   ├── auth.js             # Autentikasi & reset password
│   ├── shared.js           # Util global (modal, format, sanitasi)
│   ├── dashboard.js        # Dashboard
│   ├── transaction.js      # Form transaksi + voice AI
│   ├── transfer.js         # Transfer antar dompet
│   ├── report.js           # Laporan & export CSV
│   ├── goals.js            # Target tabungan
│   ├── planner.js          # Estimasi pengeluaran
│   ├── profile.js          # Profil, kelola dompet & kategori
│   └── wallet.js           # Render & sort dompet di dashboard
├── assets/                 # Aset statis (favicon)
├── supabase/
│   ├── schema.sql          # Skema tabel + RLS policies
│   └── functions/
│       └── gemini-proxy/   # Edge Function proxy Gemini
├── manifest.json           # PWA manifest
└── sw.js                   # Service Worker (offline)
```

## Lisensi

Hak cipta © 2026 MyFinSync. Semua hak dilindungi.
