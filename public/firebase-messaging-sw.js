// Firebase Messaging + offline application shell service worker
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCbPxOtCK-mrTnlIENrz-PG-Oao4h5bgwo",
  authDomain: "alsaif-family-hub-rsmy.firebaseapp.com",
  projectId: "alsaif-family-hub-rsmy",
  storageBucket: "alsaif-family-hub-rsmy.firebasestorage.app",
  messagingSenderId: "471598482928",
  appId: "1:471598482928:web:b4899f018f1de5376ec935",
});

const messaging = firebase.messaging();
const APP_CACHE = "alsaif-app-v3";
const MEDIA_CACHE = "alsaif-media-v3";
const USER_ROUTE_CACHE_PREFIX = "alsaif-user-routes-v1:";
const SESSION_META_CACHE = "alsaif-offline-session-v1";
const ACTIVE_USER_KEY = "/__alsaif_active_offline_user__";
const CORE_URLS = ["/", "/manifest.json", "/logo-home.png"];
const OFFLINE_FALLBACK = "/__alsaif_offline_fallback__";
const WARM_CONCURRENCY = 3;

const offlineHtml = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#064e3b">
  <title>السيف — دون اتصال</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f1e8;color:#073f31;font-family:system-ui,-apple-system,sans-serif;padding:24px}
    main{width:min(460px,100%);background:#fff;border:1px solid #d7c18a;border-radius:28px;padding:34px;text-align:center;box-shadow:0 24px 60px #073f3120}
    .mark{width:70px;height:70px;margin:auto;display:grid;place-items:center;border-radius:22px;background:#073f31;color:#e2bd68;font-size:32px}
    h1{font-size:24px;margin:22px 0 10px}p{line-height:1.9;color:#64748b;margin:0}button{margin-top:24px;border:0;border-radius:16px;background:#073f31;color:#fff;padding:13px 24px;font:inherit;font-weight:800}
  </style>
</head>
<body><main><div class="mark">⌁</div><h1>لا يوجد اتصال بالإنترنت</h1><p>افتح الموقع مرة واحدة أثناء الاتصال حتى نحفظ صفحاته على هذا الجهاز، ثم يمكنك تصفح ما تم حفظه دون إنترنت.</p><button onclick="location.reload()">إعادة المحاولة</button></main></body>
</html>`;

function normalizeUserId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{6,128}$/.test(value) ? value : null;
}

function userRouteCacheName(userId) {
  return `${USER_ROUTE_CACHE_PREFIX}${userId}`;
}

async function getActiveOfflineUserId() {
  try {
    const cache = await caches.open(SESSION_META_CACHE);
    const response = await cache.match(ACTIVE_USER_KEY);
    if (!response) return null;
    return normalizeUserId(await response.text());
  } catch {
    return null;
  }
}

async function setActiveOfflineUserId(userId) {
  const normalized = normalizeUserId(userId);
  if (!normalized) return;

  const cache = await caches.open(SESSION_META_CACHE);
  await cache.put(
    ACTIVE_USER_KEY,
    new Response(normalized, { headers: { "content-type": "text/plain; charset=utf-8" } }),
  );

  const names = await caches.keys();
  await Promise.all(
    names
      .filter(
        (name) =>
          name.startsWith(USER_ROUTE_CACHE_PREFIX) && name !== userRouteCacheName(normalized),
      )
      .map((name) => caches.delete(name)),
  );
}

async function clearOfflineCaches() {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter(
        (name) =>
          name === MEDIA_CACHE ||
          name === SESSION_META_CACHE ||
          name.startsWith(USER_ROUTE_CACHE_PREFIX),
      )
      .map((name) => caches.delete(name)),
  );
}

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
}

async function putIfCacheable(cacheName, request, response) {
  if (!(response.ok || response.type === "opaque")) return response;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  await trimCache(cacheName, cacheName === MEDIA_CACHE ? 120 : 180);
  return response;
}

async function installCore() {
  const cache = await caches.open(APP_CACHE);
  await cache.put(
    OFFLINE_FALLBACK,
    new Response(offlineHtml, { headers: { "content-type": "text/html; charset=utf-8" } }),
  );

  await Promise.all(
    CORE_URLS.map(async (url) => {
      try {
        const request = new Request(url, { credentials: "same-origin" });
        const response = await fetch(request);
        await putIfCacheable(APP_CACHE, request, response);
      } catch {
        // A partial core cache is still useful; do not abort installation.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(installCore().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter(
              (name) =>
                name.startsWith("alsaif-") &&
                name !== APP_CACHE &&
                name !== MEDIA_CACHE &&
                name !== SESSION_META_CACHE &&
                !name.startsWith(USER_ROUTE_CACHE_PREFIX),
            )
            .map((name) => caches.delete(name)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

async function navigationResponse(request) {
  const activeUserId = await getActiveOfflineUserId();
  const userCacheName = activeUserId ? userRouteCacheName(activeUserId) : null;

  try {
    const response = await fetch(request);
    if (response.ok && userCacheName) {
      await putIfCacheable(userCacheName, request, response);
    }
    return response;
  } catch {
    if (userCacheName) {
      const userCache = await caches.open(userCacheName);
      const cachedRoute = await userCache.match(request, { ignoreSearch: false });
      if (cachedRoute) return cachedRoute;
    }

    const appCache = await caches.open(APP_CACHE);
    return (await appCache.match("/")) || (await appCache.match(OFFLINE_FALLBACK));
  }
}

async function cachedResource(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => putIfCacheable(cacheName, request, response))
    .catch(() => null);

  return cached || (await network) || Response.error();
}

async function warmUserRoutes(userId, values) {
  const normalized = normalizeUserId(userId);
  if (!normalized || !Array.isArray(values)) return;

  await setActiveOfflineUserId(normalized);

  const cacheName = userRouteCacheName(normalized);
  // Replace this user's route cache on every permissions warm-up. This purges
  // routes that may have become unauthorized after a role/section change.
  await caches.delete(cacheName);
  const queue = values.slice(0, 100);
  let cursor = 0;

  const worker = async () => {
    while (cursor < queue.length) {
      const value = queue[cursor++];
      try {
        const url = new URL(value, self.location.origin);
        if (url.origin !== self.location.origin) continue;
        if (url.pathname.startsWith("/api/") || url.pathname.includes("/_server/")) continue;

        const request = new Request(url.toString(), {
          method: "GET",
          credentials: "same-origin",
        });
        const response = await fetch(request);
        if (response.ok) await putIfCacheable(cacheName, request, response);
      } catch {
        // One unavailable route must not cancel the rest of the warm-up.
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(WARM_CONCURRENCY, queue.length) }, () => worker()),
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!["http:", "https:"].includes(url.protocol)) return;

  // Connectivity probes must always reach the network and must never be cached.
  if (url.searchParams.has("__alsaif_network_probe")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/") || url.pathname.includes("/_server/")) return;
    event.respondWith(cachedResource(request, APP_CACHE));
    return;
  }

  if (["image", "font", "style"].includes(request.destination)) {
    event.respondWith(cachedResource(request, MEDIA_CACHE));
  }
});

self.addEventListener("message", (event) => {
  const message = event.data || {};

  if (message.type === "SET_OFFLINE_USER") {
    event.waitUntil(setActiveOfflineUserId(message.userId));
    return;
  }

  if (message.type === "WARM_OFFLINE_ROUTES") {
    event.waitUntil(warmUserRoutes(message.userId, message.urls));
    return;
  }

  // Backward-compatible warm-up for static resources only. Route documents are
  // deliberately excluded because authenticated HTML belongs in per-user caches.
  if (message.type === "WARM_OFFLINE_CACHE" && Array.isArray(message.urls)) {
    event.waitUntil(
      Promise.all(
        message.urls.slice(0, 100).map(async (value) => {
          try {
            const url = new URL(value, self.location.origin);
            if (url.origin !== self.location.origin) return;
            if (url.pathname === "/" || !/\.[a-zA-Z0-9]{2,8}$/.test(url.pathname)) return;

            const request = new Request(url.toString(), { credentials: "same-origin" });
            const response = await fetch(request);
            await putIfCacheable(APP_CACHE, request, response);
          } catch {
            // Individual static resources may be transient.
          }
        }),
      ),
    );
    return;
  }

  if (message.type === "CLEAR_OFFLINE_CACHES") {
    event.waitUntil(clearOfflineCaches());
  }
});

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "إشعار جديد";
  const options = {
    body: payload.notification?.body || payload.data?.body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
