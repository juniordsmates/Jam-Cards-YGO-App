// Service worker da versão web: guarda cada imagem de carta no cache do navegador,
// para que cada imagem seja baixada da YGOPRODeck uma única vez (regra do guia da API).
const CACHE = "ygo-images-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (new URL(event.request.url).hostname !== "images.ygoprodeck.com") return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      // <img> sem CORS gera resposta "opaque"; ela também pode ir para o cache
      if (res.ok || res.type === "opaque") cache.put(event.request, res.clone());
      return res;
    }),
  );
});
