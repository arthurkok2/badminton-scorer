---
title: Hosting and CI/CD Design
author: arthur.kok
date: 2026-05-12
status: implemented
tags: [platform, infra]
domain: platform
---

# Hosting and CI/CD Design

**Status:** Implemented

## Overview

The app is deployed as a PWA to two independent hosting targets from the same repository:

| Target | URL | Trigger |
|--------|-----|---------|
| Firebase Hosting | https://badminton-scorer-91f7d.web.app | Push to `main` via GitHub Actions |
| GitHub Pages | https://arthurkok2.github.io/badminton-scorer/ | Push to `main` via GitHub Actions |

Both targets serve the same Vite build output from `dist/`. The difference is the `base` path.

---

## Build Configuration

Vite is configured with `base: '/badminton-scorer/'` in `vite.config.ts` to support the GitHub Pages subpath. Firebase Hosting serves the app from the root domain, so the build must override this:

- **GitHub Pages workflow** — uses `npm run build` (inherits `base: '/badminton-scorer/'`)
- **Firebase workflow** — uses `npm run build -- --base /` to override the base to `/`

This keeps both deployments working without changing `vite.config.ts`.

---

## Firebase Hosting

`firebase.json` includes a `hosting` block:

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

Firebase project: `badminton-scorer-91f7d`

---

## GitHub Actions Workflows

### Firebase deploy (`.github/workflows/firebase-hosting-deploy.yml`)

Triggers on push to `main`. Steps:

1. Checkout + setup Node 22 (from `.nvmrc`)
2. `npm ci`
3. `npm test` + `npm run lint` — blocks deploy on failure
4. `npm run build -- --base /`
5. `FirebaseExtended/action-hosting-deploy@v0` — deploys to the live channel

Requires the secret `FIREBASE_SERVICE_ACCOUNT_BADMINTON_SCORER_91F7D` in the repo's GitHub Actions secrets. This is a GCP service account key generated via `firebase init hosting:github`.

### GitHub Pages deploy (`.github/workflows/deploy-pages.yml`)

Triggers on push to `main`. Uses the standard `actions/deploy-pages@v4` flow. No base override needed.

---

## Out of Scope

- Preview channels per PR (not configured — could be added via `FirebaseExtended/action-hosting-deploy@v0` with `channelId: pr-${{ github.event.number }}`)
- Staging environment
- Custom domain

