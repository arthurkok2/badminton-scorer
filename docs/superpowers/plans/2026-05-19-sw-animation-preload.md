# SW Animation Preload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Precache all 18 animation `.webm` videos during SW install and serve them cache-first so animations play instantly with no network round-trip.

**Architecture:** `public/sw.js` gains an `ANIMATION_VIDEOS` constant (static list of all video paths), a `precacheAnimations()` helper called from `precacheAppShell()`, and a new cache-first branch in the fetch handler for `/animations/` paths. No other files change. Cache version bumps from `v1` → `v2` to force a fresh install on existing clients.

**Tech Stack:** Vanilla service worker JS, Cache API, `Promise.allSettled` for best-effort per-video caching.

---

### Task 1: Add ANIMATION_VIDEOS list and cache-first routing

**Files:**
- Modify: `public/sw.js`

This task adds the static video list and the fetch-handler branch. No install-time caching yet — that comes in Task 2. After this task, videos are served cache-first if already in cache (from a previous network-first hit), but not yet precached.

- [ ] **Step 1: Add `ANIMATION_VIDEOS` constant after the `ASSET_MANIFEST` line**

Open `public/sw.js`. After line 5 (`const ASSET_MANIFEST = ...`), insert:

```js
// Keep in sync with src/animations/animationAssets.ts VIDEO_MAP values.
const ANIMATION_VIDEOS = [
  'bagel_1', 'bagel_2',
  'comeback_1', 'comeback_2',
  'deuce_1',
  'first_to_11_1',
  'match_point_1', 'match_point_2',
  'match_won_1', 'match_won_2',
  'score_6_7_1',
  'shutout_1',
  'streak_3_1', 'streak_3_2',
  'streak_6_1', 'streak_6_2',
  'streak_9_1', 'streak_9_2',
].map((name) => withBase(`/animations/${name}.webm`));
```

- [ ] **Step 2: Add cache-first branch for `/animations/` in the fetch handler**

In the `fetch` event listener, insert a new branch between the `/assets/` branch and the final `networkFirst` fallback. The fetch handler should look like this after the change:

```js
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(fetch(event.request).catch(() => navigationFallback()));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith(withBase('/assets/'))) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith(withBase('/animations/'))) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});
```

- [ ] **Step 3: Syntax-check the file**

```bash
node --check public/sw.js
```

Expected: no output (clean parse).

- [ ] **Step 4: Commit**

```bash
git add public/sw.js
git commit -m "feat: serve animation videos cache-first in SW"
```

---

### Task 2: Precache animations during SW install + bump cache version

**Files:**
- Modify: `public/sw.js`

This task wires up install-time precaching and bumps the cache version so all existing clients get a fresh install that includes the videos.

- [ ] **Step 1: Bump `CACHE_NAME` to `v2`**

Change line 1 of `public/sw.js`:

```js
const CACHE_NAME = 'badminton-scorer-v2';
```

- [ ] **Step 2: Add `precacheAnimations()` helper**

Insert the following function anywhere after `precacheAppShell` (e.g. after the closing brace of `getBuildAssets`):

```js
async function precacheAnimations(cache) {
  await Promise.allSettled(
    ANIMATION_VIDEOS.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch {
        // Network failure for one video must not block others.
      }
    }),
  );
}
```

- [ ] **Step 3: Call `precacheAnimations` from `precacheAppShell`**

At the end of `precacheAppShell`, add the call so the function looks like this:

```js
async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
  const assets = await getBuildAssets();

  if (assets.length > 0) {
    await cache.addAll([ASSET_MANIFEST, ...assets]);
  }

  await precacheAnimations(cache);
}
```

- [ ] **Step 4: Syntax-check the file**

```bash
node --check public/sw.js
```

Expected: no output (clean parse).

- [ ] **Step 5: Commit**

```bash
git add public/sw.js
git commit -m "feat: precache animation videos during SW install"
```

---

### Task 3: Verify

**Files:** none changed — verification only.

- [ ] **Step 1: Run tests**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test
```

Expected: all tests pass (SW is not unit-tested; this guards against regressions elsewhere).

- [ ] **Step 2: Run lint**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Run build**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Final SW syntax check**

```bash
node --check public/sw.js
```

Expected: no output.
