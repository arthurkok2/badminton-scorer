---
title: Data — Firebase, Auth, Session, Cloud Sync
last-updated: 2026-05-23
---

# Firebase & Data Services

## Overview

Firebase provides authentication, cloud session storage, global player registry, player/pair Elo ratings, and match statistics. Local development uses the Firestore emulator suite. Firestore remote control is documented under [Input Remotes](../input/input-remotes.md).

## Location

| Area | Path |
|------|------|
| Firebase init | `src/firebase.ts` |
| Authentication | `src/auth/` |
| Session management | `src/session/` |
| Firestore rules | `firestore.rules` |
| Firestore indexes | `firestore.indexes.json` |

## Firebase Configuration

Project: `badminton-scorer-91f7d` (Firestore Native, STANDARD edition)

`src/firebase.ts` initializes the Firebase app singleton and provides:

- `getFirebaseApp()` — lazy-init the app
- `getFirebaseDb()` — Firestore instance (connects to emulator when `VITE_USE_FIRESTORE_EMULATOR=true`)
- `getFirebaseAuth()` — Auth instance (connects to emulator in dev)

Emulator connection is controlled via environment variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_USE_FIRESTORE_EMULATOR` | — | Enables emulator connections |
| `VITE_FIRESTORE_EMULATOR_HOST` | `localhost` | Emulator host |
| `VITE_FIRESTORE_EMULATOR_PORT` | `8080` | Emulator port |

Emulator startup: `npx firebase-tools@latest emulators:start --only firestore,auth` (available as `npm run emulator`).

## Authentication

`src/auth/` provides Firebase Auth integration:

- **Google sign-in only** — `signInWithRedirect(new GoogleAuthProvider())` to work in PWA/mobile contexts. No anonymous auth, no popup flow. Restored anonymous users from older versions are signed out and exposed as `user: null`.
- `AuthProvider` — React context provider wrapping `onAuthStateChanged`
- `useAuth()` / `AuthState` — `{ user, loading, isAnonymous, authUnavailable, signInWithGoogle, signOut }`
- `RequiresAuth` — wrapper component rendering inline sign-in prompt for gated features
- Auth domain: `badminton-scorer-91f7d.web.app` (must match hosting domain for redirect sign-in to restore state)

## Firestore Data Model

### Global Collections

**`players/{playerId}`** — Canonical global player registry:

| Field | Notes |
|-------|-------|
| `displayName` | Human-readable name |
| `searchName` | Normalized for search/duplicate warnings |
| `createdBy` | Creating user's uid |
| `claimStatus` | `guest` (v1); future: `claimed`, `verified` |
| `globalIndividualElo` | Starts at 1500 |
| `globalMatchCount` | Completed global session matches |
| `statsVersion` | Starts at 1 |
| `spriteId` | Optional little-fighters roster choice saved on the global player profile |

**`pairs/{pairId}`** — Global doubles pair records for pair Elo and matchup stats.

**`matches/{matchId}`** — Global match ledger storing completed session match records with final scores, player ids, and timestamps.

### User-Owned Collections

**`users/{uid}/sessions/{sessionId}`** — Per-user session archives uploaded from local storage. Each document contains full session data (player roster, match history, pairing matrix, timestamps).

### Security Rules Summary

`firestore.rules` enforces:
- Room codes must match `/^[A-HJ-NP-Z2-9]{4}$/` (no ambiguous chars)
- Named, non-anonymous Firebase accounts required for writes
- Immutable fields enforced on update (`code`, `createdAt`, `hostId`)
- Server timestamps required on create
- `hasOnly` field validation on all writes
- String length caps: `hostId`/`sourceId` ≤128, `rejectionReason` ≤256
- Command creates: no outcome fields allowed
- Command updates: only outcome fields (`appliedAt`, `rejectedAt`) may be added
- Room host identity checked: `request.auth.uid` must match `hostId` for room updates
- Command host check: caller uid must match room's `hostId` via `get()` lookup
- Explicit deny-all fallback for unmatched paths

## Session Management

`src/session/` handles match persistence, cloud sync, and player stats:

- **Session persistence** — localStorage keys: `badminton-scorer-active-session` (active), `badminton-scorer-session-archive` (completed), `badminton-scorer-saved-players` (roster). Active session restored on reload. Session mode requires auth; one-off match mode remains local-only.
- **Cloud sync** — `completeCloudSessionMatch` runs a Firestore transaction: updates global player Elo, pair Elo, matchup records, player match counts, and writes match to global ledger atomically. On failure, a retry banner appears with no blocking of local state.
- **Player identity** — Global player search via `searchGlobalPlayers(searchText)`. Duplicate detection by `searchName`. Player creation via `createGlobalPlayerDocument`.
- **Session import** — When a signed-in user has legacy local sessions, `SessionImportPrompt` maps each legacy name to a `GlobalPlayer`, then uploads all sessions to `users/{uid}/sessions/`.
- **Playing phase persistence** — In-progress session match state and phase are persisted so the session recovers to the correct screen on reload.
- **Player sprite selection** — session-mode little-fighters sprite changes update `players/{playerId}.spriteId` in Firestore so the chosen look follows that player across devices; one-off matches keep sprite changes in local UI state only.

## Match State Persistence

`localStorage` keys for one-off match mode:

| Key | Purpose |
|-----|---------|
| `badminton-scorer-preferences` | User settings (auto-announce, mode, player names, etc.) |
| `badminton-scorer-match` | Active `MatchState` as JSON (score, server, receiver, undo history) |

On startup: restore saved match if saved mode matches current preference mode; otherwise create fresh match. Explicit reset clears saved state.

## Related Docs

- [Input Remotes](../input/input-remotes.md) — Firestore remote control (uses the same Firestore infra)
- [Scoring Engine](../game-engine/scoring-engine.md) — Elo and stats engine details
- [UI Architecture](../ui/ui-architecture.md) — auth gate and session UI components
- [Build & Deploy](../platform/build-deploy.md) — Firebase config files, Firestore rules deployment