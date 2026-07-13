// BIO — service worker (PWA)
// Estratégia: rede-primeiro para navegação (o conteúdo está sempre atualizado
// quando há conexão; o cache é só fallback offline) e cache-primeiro para os
// assets hasheados (imutáveis — e manter os antigos protege abas abertas de
// "chunk sumiu" após um novo deploy).
// Atualização: skipWaiting + clients.claim — a nova versão assume no próximo
// carregamento; o app avisa o usuário para recarregar (ver PwaManager.tsx).
const VERSION = "bio-v1";
const PAGES = `${VERSION}-pages`;
const RUNTIME = `${VERSION}-runtime`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("bio-") && !k.startsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Supabase, fontes do Google etc. ficam fora — só o próprio site
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(PAGES);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(req);
          return cached ?? (await caches.match("/")) ?? Response.error();
        }
      })(),
    );
    return;
  }

  const cacheable =
    url.pathname.startsWith("/assets/") ||
    ["script", "style", "font", "image"].includes(req.destination);
  if (!cacheable) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const resp = await fetch(req);
      if (resp.ok) {
        const cache = await caches.open(RUNTIME);
        cache.put(req, resp.clone());
      }
      return resp;
    })(),
  );
});
