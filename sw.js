// Service Worker untuk Arisan App - Versi Stabil
const CACHE_NAME = 'arisan-cache-v1';

// Install: langsung aktif
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: ambil alih klien
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Helper: buat ikon PNG (data URI)
function createIcon(size) {
  // Buat canvas secara dinamis
  return new Response(
    new Blob([`
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#4f46e5;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${size}" height="${size}" fill="url(#grad)"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="${size*0.45}px" font-family="Arial, sans-serif" font-weight="bold">A</text>
      </svg>
    `], { type: 'image/svg+xml' }),
    { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'max-age=31536000' } }
  );
}

// Fetch: tangani ikon dan lainnya
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Sediakan ikon secara dinamis
  if (url.pathname.endsWith('/icon-192.png')) {
    event.respondWith(createIcon(192));
    return;
  }
  if (url.pathname.endsWith('/icon-512.png')) {
    event.respondWith(createIcon(512));
    return;
  }
  
  // Untuk request lainnya: network first, fallback cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
