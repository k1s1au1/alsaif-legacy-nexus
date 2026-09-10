const DB_NAME = "alsaif-offline-data";
const DB_VERSION = 1;
const RESPONSE_STORE = "responses";
const MAX_RESPONSE_SIZE = 4 * 1024 * 1024;
const ACTIVE_OFFLINE_USER_KEY = "alsaif:offline:active-user";

type CachedHttpResponse = {
  key: string;
  body: string;
  status: number;
  statusText: string;
  headers: [string, string][];
  savedAt: number;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RESPONSE_STORE)) {
        const store = db.createObjectStore(RESPONSE_STORE, { keyPath: "key" });
        store.createIndex("savedAt", "savedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return dbPromise;
}

async function readCachedResponse(key: string): Promise<CachedHttpResponse | null> {
  const db = await openOfflineDb();
  if (!db) return null;

  return new Promise((resolve) => {
    const transaction = db.transaction(RESPONSE_STORE, "readonly");
    const request = transaction.objectStore(RESPONSE_STORE).get(key);
    request.onsuccess = () => resolve((request.result as CachedHttpResponse | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
}

async function writeCachedResponse(entry: CachedHttpResponse): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(RESPONSE_STORE, "readwrite");
    transaction.objectStore(RESPONSE_STORE).put(entry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

async function clearCachedResponses(): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(RESPONSE_STORE, "readwrite");
    transaction.objectStore(RESPONSE_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

function jwtSubject(authorization: string): string {
  const token = authorization.replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (!payload) return "anonymous";

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)).sub || "anonymous";
  } catch {
    return "anonymous";
  }
}

async function stableHash(value: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function isCacheableRead(request: Request, supabaseOrigin: string): boolean {
  const url = new URL(request.url);
  if (url.origin !== supabaseOrigin) return false;

  if (request.method === "GET") {
    return (
      url.pathname.includes("/rest/v1/") ||
      url.pathname.includes("/auth/v1/user") ||
      url.pathname.includes("/storage/v1/object/")
    );
  }

  return request.method === "POST" && url.pathname.includes("/storage/v1/object/sign/");
}

async function responseCacheKey(request: Request): Promise<string> {
  const url = new URL(request.url);
  const subject = jwtSubject(request.headers.get("authorization") || "");
  const body = request.method === "GET" ? "" : await request.clone().text().catch(() => "");
  return stableHash(`${subject}|${request.method}|${url.toString()}|${body}`);
}

function restoreResponse(cached: CachedHttpResponse): Response {
  const headers = new Headers(cached.headers);
  headers.set("x-alsaif-offline-cache", "true");
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

function announceSuccessfulSync() {
  const timestamp = new Date().toISOString();
  localStorage.setItem("alsaif:last-online-sync", timestamp);
  window.dispatchEvent(new CustomEvent("alsaif:online-sync", { detail: timestamp }));
}

export function createOfflineFetch(
  baseFetch: typeof globalThis.fetch,
  supabaseUrl: string,
): typeof globalThis.fetch {
  const supabaseOrigin = new URL(supabaseUrl).origin;

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);

    if (!isCacheableRead(request, supabaseOrigin)) {
      return baseFetch(request);
    }

    const key = await responseCacheKey(request);

    if (!navigator.onLine) {
      const cached = await readCachedResponse(key);
      if (cached) return restoreResponse(cached);
    }

    try {
      const response = await baseFetch(request);

      if (response.ok) {
        announceSuccessfulSync();

        const clone = response.clone();
        const body = await clone.text();
        if (body.length <= MAX_RESPONSE_SIZE) {
          const headers: [string, string][] = [];
          clone.headers.forEach((value, name) => {
            if (name !== "content-length" && name !== "content-encoding") {
              headers.push([name, value]);
            }
          });

          await writeCachedResponse({
            key,
            body,
            status: clone.status,
            statusText: clone.statusText,
            headers,
            savedAt: Date.now(),
          });
        }
      }

      return response;
    } catch (error) {
      const cached = await readCachedResponse(key);
      if (cached) return restoreResponse(cached);
      throw error;
    }
  }) as typeof globalThis.fetch;
}

export async function clearOfflineData(): Promise<void> {
  await clearCachedResponses();
  localStorage.removeItem("alsaif:last-online-sync");
  localStorage.removeItem(ACTIVE_OFFLINE_USER_KEY);

  const worker =
    navigator.serviceWorker?.controller ??
    (await navigator.serviceWorker?.ready.catch(() => null))?.active;
  worker?.postMessage({ type: "CLEAR_OFFLINE_CACHES" });
}
