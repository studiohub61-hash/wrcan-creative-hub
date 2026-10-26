const CACHE = 'wrcan-offline-v1';
const PUBLIC_PAGES = ['/', '/offline', '/smartstart'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await Promise.allSettled(PUBLIC_PAGES.map(path => cache.add(path)));
    await self.skipWaiting();
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('wrcan-offline-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.includes('__server')) return;
  const asset = /\.(js|css|woff2?|png|jpg|jpeg|webp|ico)(\?|$)/.test(url.pathname) || url.pathname.startsWith('/src/') || url.pathname.startsWith('/node_modules/.vite/') || url.pathname.startsWith('/__l5e/assets-v1/');
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async response => {
      if (response.ok && PUBLIC_PAGES.includes(url.pathname)) { const cache = await caches.open(CACHE); await cache.put(request, response.clone()); }
      return response;
    }).catch(async () => {
      const cache = await caches.open(CACHE);
      if (url.pathname !== '/offline') return Response.redirect(new URL('/offline', url.origin).href);
      return await cache.match('/offline') || new Response('Reconnect once to download offline access.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }));
  } else if (asset) {
    event.respondWith(fetch(request).then(async response => {
      if (response.ok) { const cache = await caches.open(CACHE); await cache.put(request, response.clone()); }
      return response;
    }).catch(() => caches.match(request).then(cached => cached || Response.error())));
  }
});