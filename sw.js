// Service Worker untuk PWA Wrapper Aplikasi Arisan
// Versi 2.0 - Disesuaikan untuk subdirektori /Arisan/

const CACHE_NAME = 'arisan-wrapper-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// ----- Helper: Generate Icon PNG Dinamis -----
function generateIconDataURL(size, bgColor, textColor, text) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, bgColor);
    grad.addColorStop(1, '#7c3aed');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    
    ctx.fillStyle = textColor;
    ctx.font = `bold ${size * 0.45}px "Plus Jakarta Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size/2, size/2);
    
    return canvas.convertToBlob({ type: 'image/png' });
  } else {
    // Fallback SVG untuk browser lama
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
    return Promise.resolve(new Blob([svg], { type: 'image/svg+xml' }));
  }
}

// ----- Install -----
self.addEventListener('install', event => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// ----- Activate -----
self.addEventListener('activate', event => {
  console.log('[SW] Activate');
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

// ----- Fetch -----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Tangani permintaan icon (relatif)
  if (url.pathname.endsWith('/icon-192.png')) {
    event.respondWith(
      generateIconDataURL(192, '#4f46e5', '#ffffff', 'A').then(blob => {
        return new Response(blob, {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=31536000' }
        });
      })
    );
    return;
  }
  
  if (url.pathname.endsWith('/icon-512.png')) {
    event.respondWith(
      generateIconDataURL(512, '#4f46e5', '#ffffff', 'A').then(blob => {
        return new Response(blob, {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=31536000' }
        });
      })
    );
    return;
  }
  
  // Navigasi: network first, fallback cache, lalu offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          return caches.match('./index.html').then(indexCache => {
            if (indexCache) return indexCache;
            return new Response(
              `<!DOCTYPE html>
              <html lang="id">
              <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arisan - Offline</title>
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
  
  // Google Apps Script: selalu network
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Aset statis: cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
