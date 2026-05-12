# Badminton Scorer — AI Assistant Guide

## Project Overview

Phone-first badminton scorekeeper PWA. React 19 + TypeScript + Vite + Firebase/Firestore. Doubles-first rally scoring engine, BLE remote support, Wear OS / browser controller remotes, speech announcements, match persistence.

## Tech Stack

- **Framework:** React 19, react-router-dom v7
- **Language:** TypeScript 5.8
- **Build:** Vite 7
- **Tests:** Vitest 3 + Testing Library
- **Backend:** Firebase Firestore (remote rooms), Firestore emulator for dev
- **Styling:** Plain CSS (`src/styles.css`)
- **Icons:** lucide-react

## Node Version

Always run `source ~/.nvm/nvm.sh && nvm use 22` before any `npm` or Vite commands in this project.

## Verification Commands

Run all three before claiming work is done:

```bash
npm test
npm run lint
npm run build
node --check public/sw.js
```

## Design Specs

All feature design specs live in [`docs/superpowers/specs/`](docs/superpowers/specs/), dated by session (e.g. `2026-05-12-multi-point-undo-design.md`).

**Rule:** after any major change (new feature, UI overhaul, architecture shift), update or create the relevant spec file in `docs/superpowers/specs/` before or as part of the commit.

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add speech announcement toggle
fix: correct service rotation after deuce
refactor: extract scoring logic into gameLogic.ts
test: cover undo across multiple points
chore: bump vite to v7
```

Common types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`.

## Key Source Locations

| Area | Path |
|------|------|
| Scoring engine | `src/gameLogic.ts` |
| App root | `src/App.tsx` |
| Match state / persistence | `src/matchState.ts` |
| Firestore remote service | `src/remote/` |
| Controller page | `src/pages/ControllerPage.tsx` |
| Hooks | `src/hooks/` |
| Styles | `src/styles.css` |
| Service worker | `public/sw.js` |
| Specs | `docs/superpowers/specs/` |

## Routes

- `/` — live scorer (`<App>`)
- `/controller` — browser-based Wear OS remote simulator (`<ControllerPage>`)

## Testing Notes

- Tests use Vitest with jsdom and Testing Library.
- Firestore tests use the emulator (`VITE_USE_FIRESTORE_EMULATOR=true`) or mocked Firestore — do not mock the scoring engine itself.
- Run `npm test` (not `vitest` directly) so the project's Vite config is used.
