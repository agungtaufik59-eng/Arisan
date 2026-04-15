// Service Worker untuk PWA Wrapper Aplikasi Arisan
// Versi: 2.0.0 (Diperbarui dengan strategi caching yang lebih baik)

const CACHE_NAME = 'arisan-wrapper-v2'; // Naikkan versi cache agar pembaruan terdeteksi
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // '/install.js', // jika file terpisah, tambahkan di sini
  // '/icon-192.png', // tidak perlu karena di-generate dinamis
  // '/icon-512.png'
];

// ----- Helper: Generate Icon PNG Dinamis (dengan fallback) -----
function generateIconDataURL(size, bgColor, textColor, text) {
  // Cek dukungan OffscreenCanvas
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, bgColor);
    grad.addColorStop(1, '#7c3aed');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    
    // Text (inisial)
    ctx.fillStyle = textColor;
    ctx.font = `bold ${size * 0.45}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size/2, size/2);
    
    return canvas.convertToBlob({ type: 'image/png' });
  } else {
    // Fallback: buat ikon sederhana menggunakan SVG yang dikonversi ke PNG melalui Response
    // (Untuk browser yang tidak mendukung OffscreenCanvas, seperti Safari versi lama)
    console.warn('OffscreenCanvas tidak didukung, gunakan fallback SVG.');
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${size}" height="${size}" fill="url(#grad)"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="${size*0.45}px" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-weight="bold">${text}</text>
      </svg>
    `;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    return Promise.resolve(blob);
  }
}

// ----- Install Event -----
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(urlsToCache);
    }).catch(err => {
      console.error('[SW] Cache addAll error:', err);
    })
  );
  self.skipWaiting(); // Langsung aktif tanpa menunggu reload
});

// ----- Activate Event -----
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Ambil alih halaman yang terbuka
});

// ----- Fetch Event: Strategi Campuran -----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const request = event.request;

  // 1. Tangani permintaan ikon dinamis (dari manifest)
  if (url.pathname === '/icon-192.png') {
    event.respondWith(
      generateIconDataURL(192, '#4f46e5', '#ffffff', 'A').then(blob => {
        return new Response(blob, {
          headers: { 
            'Content-Type': 'image/png', 
            'Cache-Control': 'public, max-age=31536000, immutable' 
          }
        });
      })
    );
    return;
  }
  
  if (url.pathname === '/icon-512.png') {
    event.respondWith(
      generateIconDataURL(512, '#4f46e5', '#ffffff', 'A').then(blob => {
        return new Response(blob, {
          headers: { 
            'Content-Type': 'image/png', 
            'Cache-Control': 'public, max-age=31536000, immutable' 
          }
        });
      })
    );
    return;
  }

  // 2. Permintaan navigasi (halaman utama) - Network first, fallback ke cache, lalu halaman offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Update cache dengan versi terbaru (stale-while-revalidate)
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Jika tidak ada di cache, tampilkan halaman offline khusus
            return caches.match('/index.html').then(indexCache => {
              if (indexCache) return indexCache;
              // Buat halaman offline dinamis
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
          });
        })
    );
    return;
  }

  // 3. Permintaan ke Google Apps Script (iframe) - Network only, jangan cache
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') {
    event.respondWith(fetch(request));
    return;
  }

  // 4. Aset statis lokal (CSS, JS, dll) - Cache first, network fallback
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        // Stale-while-revalidate: ambil dari cache, lalu update di background
        fetch(request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response));
          }
        }).catch(() => { /* Abaikan error network */ });
        return cachedResponse;
      }
      // Tidak ada di cache, ambil dari network
      return fetch(request).then(response => {
        // Cache respons untuk pemakaian selanjutnya
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }
        return response;
      });
    })
  );
});

// ----- Opsional: Tangani pesan dari klien (misal untuk skipWaiting manual) -----
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
