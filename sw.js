// Service worker: guarda os arquivos do app no aparelho para funcionar offline.
// IMPORTANTE: ao alterar qualquer arquivo do app, incremente VERSAO
// para que os aparelhos baixem a versão nova.
const VERSAO = 'v2';
const CACHE = `demandas-${VERSAO}`;

const ARQUIVOS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './dados.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// 1. install: baixa todos os arquivos e guarda no cache.
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
  );
});

// 2. activate: apaga caches de versões antigas.
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((nome) => nome !== CACHE).map((nome) => caches.delete(nome))
      ))
      .then(() => self.clients.claim())
  );
});

// 3. fetch: responde com o cache primeiro; se não tiver, busca na rede.
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;

  evento.respondWith(
    caches.match(evento.request, { ignoreSearch: true }).then((emCache) => {
      if (emCache) return emCache;
      return fetch(evento.request).catch(() => {
        // Offline e sem cópia: para navegação, entrega a página principal.
        if (evento.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
