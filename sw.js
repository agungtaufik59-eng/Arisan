// Service Worker untuk PWA Wrapper Aplikasi Arisan
const CACHE_NAME = 'arisan-wrapper-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js'
];

// Install: cache aset statis wrapper
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate: bersihkan cache lama
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Helper: generate gambar icon secara dinamis (SVG lalu dikonversi ke PNG)
function generateIconDataURL(size, bgColor, textColor, text) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#4f46e5');
  grad.addColorStop(1, '#7c3aed');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  
  // Border radius effect (optional)
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  
  // Text (inisial)
  ctx.fillStyle = textColor;
  ctx.font = `bold ${size * 0.45}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size/2, size/2);
  
  return canvas.convertToBlob({ type: 'image/png' });
}

// Intercept fetch: untuk ikon dinamis dan fallback offline
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Tangani permintaan icon-192.png dan icon-512.png
  if (url.pathname === '/icon-192.png') {
    event.respondWith(
      generateIconDataURL(192, '#4f46e5', '#ffffff', 'A').then(blob => {
        return new Response(blob, {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=31536000' }
        });
      })
    );
    return;
  }
  
  if (url.pathname === '/icon-512.png') {
    event.respondWith(
      generateIconDataURL(512, '#4f46e5', '#ffffff', 'A').then(blob => {
        return new Response(blob, {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=31536000' }
        });
      })
    );
    return;
  }
  
  // Untuk permintaan navigasi (halaman utama) - coba cache dulu, fallback ke network, lalu offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html').then(cached => {
          if (cached) return cached;
          // Jika tidak ada cache, buat halaman offline sederhana
          return new Response(
            `<!DOCTYPE html>
            <html lang="id">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arisan App - Offline</title>
            <style>body{font-family:system-ui;text-align:center;padding:2rem;background:#f8fafc;color:#1e293b;margin-top:20vh;}h1{font-size:1.8rem;}p{margin:1rem 0;}.btn{display:inline-block;background:#4f46e5;color:white;padding:0.75rem 1.5rem;border-radius:2rem;text-decoration:none;margin-top:1rem;}</style>
            </head>
            <body>
            <h1>📡 Tidak Ada Koneksi</h1>
            <p>Aplikasi Arisan memerlukan internet untuk mengakses data.</p>
            <button class="btn" onclick="location.reload()">Coba Lagi</button>
            </body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
    );
    return;
  }
  
  // Untuk asset statis lainnya: cache first
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
