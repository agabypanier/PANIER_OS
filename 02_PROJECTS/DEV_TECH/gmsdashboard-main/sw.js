self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("gms-cache").then(cache => {
      return cache.addAll([
        "/",
        "/GMS_Dashboard.html",
        "/manifest.json"
      ]);
    })
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});