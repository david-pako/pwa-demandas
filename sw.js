// Service worker: guarda os arquivos do app no aparelho para funcionar offline.
// IMPORTANTE: ao alterar qualquer arquivo do app, incremente VERSAO
// para que os aparelhos baixem a versão nova.
const VERSAO = 'v8';
const CACHE = `demandas-${VERSAO}`;

const ARQUIVOS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './dados.js',
  './nuvem.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/icon.svg',
];

// Firebase (vem de outro site). A versão fixa na URL garante que a cópia guardada não fica velha.
const FIREBASE = 'https://www.gstatic.com/firebasejs/13.1.0/';
const ARQUIVOS_FIREBASE = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js']
  .map((nome) => FIREBASE + nome);

// 1. install: baixa todos os arquivos e guarda no cache.
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ARQUIVOS).then(() =>
        // Se o Firebase falhar aqui, não impede a instalação: ele é guardado no primeiro uso.
        cache.addAll(ARQUIVOS_FIREBASE).catch(() => {})
      ))
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

  // Conversas com os servidores do Google (login, Firestore) passam direto, sem cache.
  const url = evento.request.url;
  const ehDoApp = url.startsWith(self.location.origin);
  const ehFirebase = url.startsWith(FIREBASE);
  if (!ehDoApp && !ehFirebase) return;

  evento.respondWith(
    caches.match(evento.request, { ignoreSearch: true }).then((emCache) => {
      if (emCache) return emCache;
      return fetch(evento.request).then((resposta) => {
        // Firebase que ainda não estava guardado: guarda para usar offline depois.
        if (ehFirebase && resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put(evento.request, copia));
        }
        return resposta;
      }).catch(() => {
        // Offline e sem cópia: para navegação, entrega a página principal.
        if (evento.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
