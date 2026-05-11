# Player Name Editing Design

Date: 2026-05-11

## Goal

Allow the user to set player names before a match and have those names persist across sessions, reflect in the match display immediately, and carry into every subsequent new match.

## Default names

| Player ID | Default |
|-----------|---------|
| A1 | Player 1 |
| A2 | Player 2 |
| B1 | Player 3 |
| B2 | Player 4 |

## Behavior

- Name inputs appear in the setup area before any points are scored (`score 0-0`, no undo history).
- Inputs disappear after the first point is scored and do not reappear until a new match starts.
- Doubles shows four inputs (A1, A2, B1, B2); singles shows two (A1, B1).
- Inputs are grouped by team in a two-column layout.
- Each input has a maximum length of 20 characters.
- Editing a name before scoring immediately updates the current match (court view, serve summary).
- Names are persisted to `localStorage`. They are reloaded on app startup and applied to every new match.
- A blank or whitespace-only name falls back to the default on load.
- Missing `playerNames` in old stored preferences defaults the whole field to defaults.

## Data flow

- `AppPreferences.playerNames: Record<PlayerId, string>` is the persistent source of truth.
- `createMatch({ playerNames })` bakes names into `MatchState` at match creation.
- `handlePlayerNameChange(playerId, name)` in `App.tsx`:
  1. Computes `nextPlayerNames = { ...preferencesRef.current.playerNames, [playerId]: name }`.
  2. Saves to preferences (localStorage).
  3. If the match has not started, recreates the current match with the new names so all displays update instantly.

## Setup buttons

The first-server setup buttons ("Team A X serves", "Team B Y serves") use the live preference names, so they update as names are typed.

## Testing

- Four inputs visible in doubles mode before match starts; two in singles.
- Inputs show current preference values.
- `onChange` calls `onPlayerNameChange(playerId, newValue)`.
- Inputs hidden after a point is scored.
- Setup buttons reflect edited names.
- App level: default names shown on fresh load.
- App level: edited name persisted to localStorage.
- App level: saved names loaded from storage and shown in inputs on startup.
- App level: edited name reflected in serve summary immediately.
- App level: persisted names used in new match after current match ends.
