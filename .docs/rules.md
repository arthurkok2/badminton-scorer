---
title: Documentation Rules
last-updated: 2026-05-21
---

# Documentation Rules

## File format

All `.docs/` files use markdown with YAML frontmatter:

```yaml
---
title: Document Title
last-updated: YYYY-MM-DD
---
```

## Content principles

- **Explain decisions, not code** — code explains itself; docs explain why
- **Keep current** — update in the same PR that changes behavior
- **Cross-reference** — link related docs with relative paths
- **Diagrams** — use Mermaid fenced blocks where visual aids help

## Structure

```
.docs/
├── index.md              # Master index
├── rules.md              # This file
├── game-engine/          # Scoring engine & game types
├── ui/                   # Components, pages, hooks, styling, preferences
├── input/                # All remote control surfaces (BLE, keyboard, gamepad, gesture, Firestore)
├── data/                 # Firebase init, auth, session, cloud sync
├── media/                # Speech announcements, animations
└── platform/             # Build, deploy, PWA, service worker, CI, emulators
```

## When to update

Match to area of code changed:

| Code area | Doc domain |
|-----------|-----------|
| `src/domain/` — scoring engine, game types, rules | `.docs/game-engine/scoring-engine.md` |
| `src/components/`, `src/pages/`, `src/hooks/` — UI, routing | `.docs/ui/ui-architecture.md` |
| `src/styles.css`, `src/preferences.ts` — theming, settings | `.docs/ui/ui-architecture.md` |
| `src/input/` — BLE, keyboard, gamepad, gesture | `.docs/input/input-remotes.md` |
| `src/remote/` — Firestore remote control | `.docs/input/input-remotes.md` |
| `src/auth/`, `src/session/`, `src/firebase.ts` — Firebase, sync | `.docs/data/firebase-services.md` |
| `src/speech/`, `src/animations/` — announcements, effects | `.docs/media/speech-animations.md` |
| `public/sw.js` — service worker, offline | `.docs/platform/build-deploy.md` |
| `vite.config.ts`, `tsconfig.json`, `firebase.json`, CI config | `.docs/platform/build-deploy.md` |

## Naming

- Kebab-case filenames: `push-data-cron.md`
- One topic per file — split if a file exceeds ~200 lines
- Subdirectories group by domain, not by date

