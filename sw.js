const CACHE='trebol-solar-v5';
const FILES=[
  './','./index.html','./styles.css','./app.js','./extras.js','./solar-math.js',
  './manifest.webmanifest','./vendor/jspdf.umd.min.js',
  './icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png',
  './fonts/dm-sans-latin-400-normal.woff2','./fonts/dm-sans-latin-500-normal.woff2',
  './fonts/dm-sans-latin-600-normal.woff2','./fonts/dm-sans-latin-700-normal.woff2',
  './fonts/playfair-display-latin-600-normal.woff2','./fonts/playfair-display-latin-600-italic.woff2'
];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// Red primero: con conexión siempre se usa la versión más reciente; la caché solo sirve sin conexión.
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{
    if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}
    return r;
  }).catch(()=>caches.match(e.request).then(cached=>cached||caches.match('./index.html'))));
});
