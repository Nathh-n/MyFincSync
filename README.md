# MyFinSync - Pencatatan Keuangan

Mobile-first personal finance tracker berbasis HTML/CSS/JS + Supabase + Google Gemini AI.

**Live URL:** https://myfinsync.netlify.app/

## Fitur
- Autentikasi (register, login, lupa/reset password) via Supabase Auth
- Dashboard: saldo net, grafik rasio arus kas, pengeluaran terbesar, distribusi dompet, riwayat
- Pencatatan pemasukan & pengeluaran (manual + voice AI via Web Speech + Google Gemini)
- Transfer antar dompet (termasuk biaya admin)
- Laporan: ringkasan, rincian, filter, pagination, export CSV, edit transaksi
- Target Tabungan (goals) & Perencanaan (budget plans)
- Kelola dompet & kategori dari halaman Profile

## Teknologi
- Frontend: HTML5, CSS (vanilla), JavaScript (vanilla ES6+)
- Backend/Database: Supabase (PostgreSQL) + Supabase Auth
- AI: Google Gemini 2.5 Flash (via Supabase Edge Function)
- Chart: Chart.js, Icons: Font Awesome

## Setup Database & RLS (wajib)
Jalankan `supabase/schema.sql` di Supabase SQL Editor.
Script ini membuat semua tabel + mengaktifkan **Row Level Security** sehingga tiap user hanya bisa mengakses datanya sendiri.

## Setup Gemini AI (wajib)
API key Gemini TIDAK lagi disimpan di client (perbaikan keamanan). AI diakses lewat Edge Function proxy:

1. Set secret API key:
   ```
   supabase login
   supabase link --project-ref sxcyygkxjysadsmyhijg
   supabase secrets set GEMINI_API_KEY=your_key
   ```
2. Deploy fungsi:
   ```
   supabase functions deploy gemini-proxy
   ```

Jika Edge Function belum di-deploy, fitur voice AI akan menampilkan pesan error yang jelas.

## Deploy ke Netlify
- Deploy folder root sebagai static site.
- Pastikan URL callback auth di Supabase menambahkan `https://myfinsync.netlify.app`.

## Struktur
```
.
├── *.html                  # Halaman statis
├── css/                    # Stylesheet
├── js/                     # Modul JavaScript
│   ├── supabase.js         # Init Supabase client
│   ├── auth.js             # Autentikasi & reset password
│   ├── dashboard.js        # Dashboard
│   ├── transaction.js      # Form pemasukan/pengeluaran + voice AI
│   ├── transfer.js         # Transfer antar dompet
│   ├── report.js           # Laporan & export CSV
│   ├── goals.js            # Target tabungan
│   ├── planner.js          # Estimasi pengeluaran
│   ├── profile.js          # Profile, kelola dompet & kategori
│   └── wallet.js           # Render & sort dompet di dashboard
└── supabase/
    ├── schema.sql          # Tabel + RLS policies
    └── functions/
        └── gemini-proxy/   # Edge Function proxy Gemini
```
