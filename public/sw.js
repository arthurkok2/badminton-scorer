const CACHE_NAME = 'badminton-score-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];
const ASSET_MANIFEST = '/asset-manifest.json';

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(fetch(event.request).catch(() => navigationFallback()));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  await cacheSuccessfulResponse(request, response);
  return response;
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
  const assets = await getBuildAssets();

  if (assets.length > 0) {
    await cache.addAll([ASSET_MANIFEST, ...assets]);
  }
}

async function getBuildAssets() {
  try {
    const response = await fetch(ASSET_MANIFEST, { cache: 'no-store' });

    if (!response.ok) {
      return [];
    }

    const manifest = await response.json();
    const assets = new Set();

    for (const entry of Object.values(manifest)) {
      addManifestAsset(assets, entry.file);

      for (const cssFile of entry.css ?? []) {
        addManifestAsset(assets, cssFile);
      }

      for (const importedFile of entry.imports ?? []) {
        const importedEntry = manifest[importedFile];

        if (importedEntry) {
          addManifestAsset(assets, importedEntry.file);
        }
      }
    }

    return [...assets];
  } catch {
    return [];
  }
}

function addManifestAsset(assets, file) {
  if (typeof file === 'string') {
    assets.add(`/${file}`);
  }
}

async function navigationFallback() {
  const cachedRoot = await caches.match('/');

  if (cachedRoot) {
    return cachedRoot;
  }

  return caches.match('/index.html');
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    await cacheSuccessfulResponse(request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request);

    if (cached) {
      return cached;
    }

    throw error;
  }
}

async function cacheSuccessfulResponse(request, response) {
  if (!response.ok || response.type === 'opaque') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}
