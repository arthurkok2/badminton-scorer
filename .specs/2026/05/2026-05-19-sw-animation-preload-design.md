---
title: Service Worker Animation Preloading
author: arthur.kok
date: 2026-05-19
status: implemented
tags: [media, effects]
domain: media
---

# Service Worker Animation Preloading

---
title: SW Animation Preload
date: 2026-05-19
status: approved
---



## Problem

Animation `.webm` videos are fetched on-demand when an animation event fires. The first time each video plays, it must complete a full network round-trip before the blob URL is ready, causing a visible delay before the video appears.

## Solution

Precache all 18 animation videos during the SW install event and serve them cache-first thereafter. `AnimationOverlay.tsx` is untouched — it continues to `fetch()` the URL and convert to a blob URL; the SW intercepts and returns the cached response instantly.

## Changes

### `public/sw.js`

**Cache version:** `CACHE_NAME` bumped from `'badminton-scorer-v1'` to `'badminton-scorer-v2'`. Forces a fresh install on all existing clients; activate event cleans up `v1`.

**Animation list:** New `ANIMATION_VIDEOS` constant — a static array of all 18 `.webm` paths, mirroring the list in `src/animations/animationAssets.ts`. A comment points to that file so devs know to keep them in sync when adding new animations.

**Install precaching:** `precacheAppShell()` calls a new `precacheAnimations()` helper that fetches each video individually with a per-video try/catch. One failed video does not block the install or prevent the others from caching.

**Fetch strategy:** The fetch handler gains a new branch before the generic `networkFirst` fallback: if the request URL pathname starts with `BASE_PATH + '/animations/'`, respond with `cacheFirst`. After install, every animation fetch is served from cache with no network round-trip.

### Nothing else changes

`src/animations/animationAssets.ts`, `src/components/AnimationOverlay.tsx`, and all other files are unchanged.

## Trade-offs

- **Duplication:** The video path list lives in both `sw.js` and `animationAssets.ts`. Acceptable — the list is small and rarely changes. A build-time manifest would eliminate duplication but adds tooling complexity that isn't warranted.
- **Install time:** ~18 video fetches during SW install. Done in the background; doesn't block the app from becoming interactive.
- **Stale videos:** Videos are immutable static assets — the only way they change is if we rename/replace files, which always requires a SW version bump anyway. Cache-first is safe.

