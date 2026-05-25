---
title: Platform — Build, Deploy, PWA, CI
last-updated: 2026-05-23
---

# Build & Deploy

## Overview

The project uses Vite 7 for development and production builds, TypeScript 5.8 for type checking, a custom service worker for offline PWA support, and dual hosting (Firebase + GitHub Pages) deployed via GitHub Actions.

## Location

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build configuration |
| `tsconfig.json` | TypeScript configuration |
| `firebase.json` | Firebase project config (hosting, Firestore, emulators) |
| `firestore.rules` | Firestore security rules |
| `firestore.indexes.json` | Firestore composite indexes |
| `public/sw.js` | Service worker (PWA offline, animation precaching) |
| `.github/workflows/` | CI/CD pipelines |
| `package.json` | Dependencies, scripts |

## Deployment Targets

The same Vite build output deploys to two independent hosts:

| Target | URL | Trigger |
|--------|-----|---------|
| Firebase Hosting | `badminton-scorer-91f7d.web.app` | Push to `main` |
| GitHub Pages | `arthurkok2.github.io/badminton-scorer/` | Push to `main` |

**Base path handling:** `vite.config.ts` is configured with `base: '/badminton-scorer/'` for GitHub Pages. The Firebase workflow overrides with `npm run build -- --base /` so Firebase serves from root.

## Build Pipeline

```
TypeScript source → Vite build → dist/ → Firebase Hosting deploy (base /)
                                        → GitHub Pages deploy (base /badminton-scorer/)
                                        → Service worker (public/sw.js → dist/sw.js)
```

**Note:** the service worker at `public/sw.js` is checked with `node --check` (not compiled by Vite) to validate syntax.

## Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| dev | `vite` | Development server with HMR |
| build | `tsc -b && vite build` | Type-check then build for production |
| lint | `tsc -b` | TypeScript type checking |
| test | `vitest run` | Run unit tests |
| preview | `vite preview` | Preview production build locally |
| emulator | `firebase-tools emulators:start --only firestore,auth` | Local Firebase emulators |

## Verification

All four commands must pass before claiming work is done:
```
npm test         # Unit tests
npm run lint     # Type checking
npm run build    # Production build
node --check public/sw.js  # Service worker syntax check
```

## CI/CD

Two GitHub Actions workflows trigger on push to `main`:

### Firebase Deploy (`firebase-hosting-deploy.yml`)
1. Checkout + setup Node 22 (from `.nvmrc`)
2. `npm ci`
3. `npm test` + `npm run lint` — blocks deploy on failure
4. `npm run build -- --base /`
5. `FirebaseExtended/action-hosting-deploy@v0` — deploys to live channel

Requires `FIREBASE_SERVICE_ACCOUNT_BADMINTON_SCORER_91F7D` secret.

### GitHub Pages Deploy (`deploy-pages.yml`)
Standard `actions/deploy-pages@v4` flow with no base override (inherits `base: '/badminton-scorer/'`).

## Firebase Hosting

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

The catch-all rewrite is required so React Router handles all routes client-side (SPA behaviour). Without it, direct navigation to `/controller` would 404.

## Service Worker

`public/sw.js` provides offline support via cache-first precaching:

- **Cache name:** `badminton-scorer-v2` — incremented when the app shell changes
- **Install:** precaches app shell (HTML, manifest, icons) and animation WebM videos
- **Activate:** deletes stale caches not matching the current cache name
- **Fetch:** cache-first strategy for both app shell and animation assets
- Animation video list is kept in sync with `src/animations/animationAssets.ts`

## Emulator Suite

Local development uses the Firebase Emulator Suite:
- Firestore emulator (default port 8080)
- Auth emulator (port 9099)
- Configured via `VITE_USE_FIRESTORE_EMULATOR=true` env var

## Related Docs

- [Firebase & Data](../data/firebase-services.md) — runtime Firebase integration, Firestore rules
- [Speech & Animations](../media/speech-animations.md) — animation videos precached by the SW