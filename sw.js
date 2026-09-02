// MyFinSync Service Worker - PWA Offline Support
const CACHE_NAME = 'myfinsync-v1';

// Aset statis aplikasi yang akan di-cache saat install
const APP_SHELL = [
  './',
  './index.html',
  './login.html',
  './register.html',
  './forgot-password.html',
  './reset-password.html',
  './dashboard.html',
  './income.html',
  './expense.html',
  './transfer.html',
  './report.html',
  './goals.html',
  './planner.html',
  './profile.html',
  './manifest.json',
  './css/dashboard.css',
  './css/auth.css',
  './js/supabase.js',
  './js/auth.js',
  './js/shared.js',
  './js/dashboard.js',
  './js/wallet.js',
  './js/transaction.js',
  './js/transfer.js',
  './js/report.js',
  './js/goals.js',
  './js/planner.js',
  './js/profile.js',
  './assets/favicon.png'
];

// INSTALL: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE: hapus cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH: cache-first untuk aset statis, network-first untuk navigasi
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Abaikan request ke API Supabase / domain lain (selalu online)
  if (url.origin !== self.location.origin) return;

  // Halaman navigasi: network-first, fallback ke cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Aset statis lainnya: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
