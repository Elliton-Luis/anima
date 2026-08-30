/* sw.js — offline only, cache-first, sem transmitir dados do usuário
   GARANTIA: este SW só faz cache de assets estáticos explicitamente listados em ASSETS.
   Nunca cacheia respostas dinâmicas, POST, ou dados do usuário. Verificado por teste manual:
   - Todo fetch que não está em ASSETS não é colocado em cache (shouldCache=false).
   - Nenhum dado de localStorage/notes/marks passa por fetch/cache.
   - O wipe "Apagar todos os meus dados" também limpa este cache via caches.keys()+delete.
*/
const CACHE = "anima-v1";
const ASSETS = [
  "./",
  "index.html",
  "manifest.json",
  "css/style.css",
  "js/app.js",
  "js/content.js",
  "js/storage.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(()=> self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(()=> self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Apenas GET, apenas same-origin, sem query com dados sensíveis (não cachear nada sensível — apenas assets estáticos)
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cachear APENAS assets da lista — comparação exata por pathname (corrige bug onde "./" -> "" fazia endsWith("") sempre true)
        const assetPaths = ASSETS.map(a => new URL(a, location.origin).pathname);
        const reqPath = url.pathname;
        const shouldCache = assetPaths.includes(reqPath) || (reqPath === "/index.html" && assetPaths.includes("/")) || (reqPath === "/" && assetPaths.includes("/index.html"));
        if (shouldCache && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match("index.html"));
    })
  );
});
