// Service worker: app disponível offline; cadernos em PDF ficam salvos depois do primeiro uso.
const VERSION = 'v7';
const SHELL = `enem-shell-${VERSION}`;
const PDFS = 'enem-pdfs-v1';
const YEARS = [2021, 2022, 2023, 2024, 2025];
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/data.js', 'js/evolution.js', 'js/intro.js', 'js/exam.js', 'js/results.js', 'js/stats.js', 'js/store.js', 'js/tri.js', 'js/ui.js', 'js/viewer.js',
  'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs',
  'fonts/archivo-latin.woff2', 'fonts/atkinson-next-latin.woff2',
  'img/caderno-2024.webp',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'data/gabaritos.json', 'data/disciplinas.json', 'data/itens.json', 'data/habilidades.json',
  ...YEARS.flatMap(y => [`data/layout/${y}_d1.json`, `data/layout/${y}_d2.json`]),
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('enem-shell-') && k !== SHELL).map(k => caches.delete(k)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/provas/')) {
    // PDFs: do cache primeiro (são imutáveis); senão baixa e guarda
    e.respondWith(caches.open(PDFS).then(async c => {
      const hit = await c.match(url.href);
      if (hit) return hit;
      const res = await fetch(url.href);
      if (res.ok) c.put(url.href, res.clone());
      return res;
    }));
    return;
  }
  // resto: rede primeiro, sempre revalidando (o GitHub Pages manda cache de 10 min), cache se offline
  e.respondWith(fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
    if (res.ok) caches.open(SHELL).then(c => c.put(e.request, res.clone()));
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
