---
title: Physical Toss Server Picker
author: arthur.kok
date: 2026-06-28
status: draft
tags: [ui, match-setup]
domain: ui
---

# Physical Toss Server Picker

## Problem

The current "New match" flow randomly picks the first server using a `ServeSpinOverlay` (spinning shuttle animation) or `pickRandomServer()` (no-animation fallback). The user wants to replace this with a manual flow: players physically toss the shuttle to decide who serves, then tap the app to record the result.

The ServeSpinOverlay and random server logic should be removed entirely.

## Goal

A simple overlay shown after creating a new match that lets the user manually pick which team serves first, replacing the ServeSpinOverlay and all random server logic.

## Constraints

- Same visual pattern as the existing overlay (dark backdrop, centered card)
- No animation, no randomness -- waits for user input
- Must work for both singles and doubles modes
- Must work in both regular match mode and session match mode
- The existing manual server buttons in MatchSettingsModal are preserved
- Cannot be dismissed -- user must pick a team to proceed

## Non-Goals

- Two-step toss flow (winner of toss then chooses serve/receive). Keeping it simple: pick who serves.
- Side/court selection. Out of scope.
- Random shuttle toss simulation in the app. Physical toss only.

## Acceptance Criteria

1. `ServeSpinOverlay` component and `pickRandomServer` export are removed.
2. `ServerPickerOverlay` component shows after "New match" with "Team A {name} serves" and "Team B {name} serves" buttons.
3. Tapping a button dispatches `SET_INITIAL_SERVER` and hides the overlay.
4. The overlay shows player names from preferences.
5. "Reroll first server" button is removed from MatchSettingsModal.
6. Manual "Team A {name} serves" / "Team B {name} serves" buttons in MatchSettingsModal remain.
7. `handleNewMatch` and `handleStartMatch` no longer depend on `animationsEnabled` for server selection.
8. `handleRerollFirstServer` and `handleRequestServeSpin` callbacks are removed.
9. Existing tests pass, no new regressions.
10. CSS classes renamed from `.serve-spin-*` to `.server-picker-*`.

## Approach

### ServerPickerOverlay component

**File:** `src/components/ServerPickerOverlay.tsx` (new)

```ts
interface Props {
  readonly mode: MatchMode;
  readonly playerNames: Record<PlayerId, string>;
  readonly onComplete: (teamId: TeamId, playerId: PlayerId) => void;
}
```

Fullscreen overlay with dark semi-transparent backdrop, centered card containing:
- Title: "Who serves first?"
- Two large stacked buttons with team-colored accents:
  - "Team A {name} serves" -- calls `onComplete('teamA', 'A1')`
  - "Team B {name} serves" -- calls `onComplete('teamB', 'B1')`

For singles, `A1`/`B1` are the only valid player IDs. For doubles, `A1`/`B1` are used as default initial servers (consistent with existing manual buttons in MatchSettingsModal).

CSS classes: `.server-picker-overlay`, `.server-picker-card`, `.server-picker-title`, `.server-picker-button`.

### App.tsx integration

- Rename `showServeSpin` state to `showServerPicker`.
- `handleServeSpinComplete` renamed to `handleServerPickerComplete`.
- `handleNewMatch` and `handleStartMatch`: remove `animationsEnabled` check, always call `setShowServerPicker(true)`.
- JSX: render `ServerPickerOverlay` instead of `ServeSpinOverlay`, passing `playerNames` prop.
- MatchSettingsModal: remove `onRequestServeSpin` prop.

### Fallback behavior

`createInitialMatch` still defaults to teamA serving. If the overlay is somehow bypassed, the match starts with teamA serving at 0-0. The manual buttons in MatchSettingsModal remain available to correct this.

## What Changes

| File | Change |
|------|--------|
| `src/components/ServeSpinOverlay.tsx` | Remove entirely |
| `src/components/ServerPickerOverlay.tsx` | New component |
| `src/components/MatchSettingsModal.tsx` | Remove `onRequestServeSpin` prop and "Reroll first server" button |
| `src/App.tsx` | Replace `ServeSpinOverlay` import/usage; remove `pickRandomServer`, `handleRerollFirstServer`, `handleRequestServeSpin`; rename `showServeSpin` to `showServerPicker`; pass `playerNames` to new overlay |
| `src/styles.css` | Replace `.serve-spin-*` classes with `.server-picker-*` equivalents |

## What Stays the Same

- `handleSetInitialServer` callback and its usage in MatchSettingsModal manual buttons.
- `SET_INITIAL_SERVER` command type and its handling in the engine.
- `createInitialMatch` default (teamA serving at 0-0).
- MatchSettingsModal layout and player name editing.

## Architecture Impact

### `.docs/ui/ui-architecture.md`

- Remove reference to ServeSpinOverlay component
- Add reference to ServerPickerOverlay component
- Update the match initialization flow description (random pick removed, manual picker added)

## Testing Strategy

- Remove `MatchSettingsModal.test.tsx` assertion that exercises the Reroll button (`expect(props.onRequestServeSpin).toHaveBeenCalledTimes(1)`).
- Existing tests for `handleSetInitialServer`, MatchSettingsModal, and the scoring engine remain unchanged and must pass.
- Manual verification: start a new match, confirm the picker appears, tap each button to verify correct server is set.

## Verification

```bash
npm test
npm run lint
npm run build
node --check public/sw.js
```

Manual checks:
1. Start new match (doubles) -- picker overlay appears, Team A serves button sets A1 as server.
2. Start new match (singles) -- picker overlay appears, Team B serves button sets B1 as server.
3. Start session match -- picker overlay appears after "Start match" in suggestion phase.
4. MatchSettingsModal -- no Reroll button, manual server buttons still work.
5. Scoring after server selection works normally (point, undo, etc.).

## Affected Components

- `src/components/ServeSpinOverlay.tsx` (removed)
- `src/components/ServerPickerOverlay.tsx` (new)
- `src/components/MatchSettingsModal.tsx` (modified)
- `src/components/MatchSettingsModal.test.tsx` (modified)
- `src/App.tsx` (modified)
- `src/styles.css` (modified)
- `.docs/ui/ui-architecture.md` (updated)
