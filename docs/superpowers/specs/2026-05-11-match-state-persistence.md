# Match State Persistence Design

Date: 2026-05-11

## Goal

Preserve the active match across page refreshes so the user never loses a score because the browser tab was closed or reloaded mid-game.

## Behavior

- After every score change or undo, the full `MatchState` is written to `localStorage`.
- On startup, the app restores the saved match if one exists and its `mode` matches the current preferences mode.
- If no saved match exists, or the saved mode differs from preferences, a fresh match is created as normal.
- When the user explicitly starts a new match or changes the match mode, the saved match is cleared from `localStorage` before the reset, so the next load does not restore the old score.
- Player names already persist independently via preferences and are not re-read from the saved match on restore.

## Storage

| Key | Content |
|-----|---------|
| `badminton-scorer-match` | Serialised `MatchState` JSON |

The saved value includes:
- `mode` — `'singles'` or `'doubles'`
- `teams` — team objects with player names baked in
- `score` — `{ teamA, teamB }`
- `servingTeamId`, `serverId`, `receiverId`
- `courtPositions` — `Record<PlayerId, CourtSide>`
- `winnerTeamId` — present when the match is complete
- `previous` — one-level undo snapshot (optional)

## Validation on load

Only two structural checks are performed:
1. The stored value parses as a JSON object.
2. The `mode` field is `'singles'` or `'doubles'`.

If either check fails the value is discarded and a fresh match is used. The app does not attempt deep validation of the match graph — corrupt or stale data from a future schema change will fall back to a fresh match gracefully.

## Data flow

```
[every matchView.match change]
    └─▶ saveMatchState(match)   →  localStorage['badminton-scorer-match']

[app startup]
    loadMatchState()            ←  localStorage['badminton-scorer-match']
    └─▶ if valid & mode matches → restore as initial MatchState
    └─▶ else                    → createInitialMatch(mode, playerNames)

[new match / mode change]
    clearMatchState()           →  removes localStorage['badminton-scorer-match']
    └─▶ setMatchView(fresh match)
```

## Implementation

- `loadMatchState()`, `saveMatchState()`, `clearMatchState()` live in `src/preferences.ts`.
- `App.tsx` calls `saveMatchState` in a `useEffect` on `matchView.match`.
- `App.tsx` calls `clearMatchState` in `handleNewMatch` and `handleMatchModeChange` before resetting state.
- The initial `useState` for `matchView` reads `loadMatchState()` before falling back to `createInitialMatch`.

## Testing

- Saving: `saveMatchState` writes JSON to `localStorage`.
- Loading: `loadMatchState` returns the parsed object when valid.
- Loading: `loadMatchState` returns `undefined` for missing, non-object, or wrong-mode values.
- Clearing: `clearMatchState` removes the key.
- App init: a saved match matching the current mode is restored.
- App init: a saved match with a mismatched mode is discarded and a fresh match is created.
- App reset: `handleNewMatch` clears the saved state before resetting.
- App mode change: `handleMatchModeChange` clears the saved state before resetting.
