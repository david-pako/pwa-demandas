// Registra o service worker, que permite instalar o app e usá-lo offline.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((erro) => {
      console.error('Falha ao registrar o service worker:', erro);
    });
  });
}
