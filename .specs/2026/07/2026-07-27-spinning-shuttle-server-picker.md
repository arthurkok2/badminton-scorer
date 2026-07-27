---
title: Spinning Shuttle Server Picker
author: arthur.kok
date: 2026-07-27
status: draft
tags: [ui, match-setup, animation]
domain: ui
supersedes: 2026-06-28-server-picker-design
---

# Spinning Shuttle Server Picker

## Problem

The current `ServerPickerOverlay` presents two manual buttons ("Team A serves" / "Team B serves"). This is functional but lacks the ritual and fairness of a physical shuttle toss — a common real-world practice where players toss the shuttle to decide who serves first.

## Goal

Replace the manual two-button `ServerPickerOverlay` with an interactive spinning shuttle animation. The user taps the shuttle to "spin" it, it decelerates over ~2.5s, and the direction the cork points determines which team serves first.

## Constraints

- Same overlay structure (dark backdrop, centered card) as the existing `ServerPickerOverlay`
- Single-tap interaction to start the spin
- Outcome is random, not skill-based
- Must work for both singles and doubles modes
- Must work in both regular match mode and session match mode
- Cannot be dismissed — user must spin to proceed
- The `createInitialMatch` default (teamA serving at 0-0) remains as before

## Non-Goals

- Multiple spin retries. One spin per new match; if user wants to change, they use MatchSettingsModal.
- Side/court selection. Out of scope.
- Two-step toss (winner of toss then chooses serve/receive/court). One step: shuttle picks who serves.
- Sound effects on spin (speech announcements already handle "Team A/B to serve").
- Persistent spin animation preference. Always shows; no toggle.

## Acceptance Criteria

1. `ServerPickerOverlay` component is removed.
2. `SpinningShuttle` component shows after "New match" with a clickable shuttle SVG.
3. Tapping the shuttle starts a rotation animation lasting ~2.5s with natural deceleration (CSS transition).
4. The shuttle settles at a random angle. The cork points toward the serving team (left = Team A, right = Team B).
5. After settling, a 0.5s pause shows which team won, then `onComplete('teamA')` or `onComplete('teamB')` fires.
6. The stub/handler dispatches `SET_INITIAL_SERVER` with the correct `teamId` and always `'A1'` or `'B1'` for player.
7. The overlay shows team names (from preferences/session) as labels on each side.
8. MatchSettingsModal manual "first server" buttons remain unchanged.
9. Existing tests pass, no regressions.
10. CSS classes use `.spinning-shuttle-*` naming.

## Approach

### SpinningShuttle component

**File:** `src/components/SpinningShuttle.tsx` (new)

```typescript
interface Props {
  readonly playerNames: Readonly<Record<PlayerId, string>>;
  readonly onComplete: (teamId: TeamId) => void;
}
```

State machine: `idle` → `spinning` → `settled` → dismissed.

- **idle:** Shuttle sits at center, subtle idle animation (gentle wiggle/pulse). Team labels shown left/right. Text prompt: "Tap the shuttle to toss".
- **spinning:** On click, compute random target rotation (large multiple of 360 + random offset). Apply via CSS `transform: rotate(Ndeg); transition: transform 2.5s cubic-bezier(0.2, 0.8, 0.3, 1)`. Shuttle spins rapidly, decelerates naturally.
- **settled:** After transition ends (`onTransitionEnd`), check effective angle: if 0°–180° → Team B serves; 180°–360° → Team A serves. Highlight winning team. Wait 500ms, call `onComplete(teamId)`.

SVG shuttle: simple vector — a semicircle (cork, top) + a fan of lines (feathers, bottom). Cork is at the top of the default orientation. At 0° rotation, cork points down/right. At 180°, cork points down/left.

### App.tsx integration

- Rename `showServerPicker` state to `showSpinningShuttle` (currently used for the `ServerPickerOverlay`)
- Rename `handleServerPickerComplete` to `handleShuttleComplete` — accepts `teamId` only, generates playerId (`'A1'`/`'B1'`) internally
- `handleNewMatch` and `handleStartMatch`: change `setShowServerPicker(true)` to `setShowSpinningShuttle(true)`
- JSX: render `<SpinningShuttle>` instead of `<ServerPickerOverlay>`
- Remove `ServerPickerOverlay` import

### Outcome logic

```
effectiveAngle = finalRotation % 360
if (effectiveAngle >= 180) → teamA (cork points left)
else → teamB (cork points right)
```

Random rotation: `baseSpins = (3 + Math.floor(Math.random() * 3)) * 360; offset = Math.random() < 0.5 ? angleToTeamA : angleToTeamB`. This guarantees random outcome while keeping animation consistent.

## What Changes

| File | Change |
|------|--------|
| `src/components/ServerPickerOverlay.tsx` | Remove |
| `src/components/SpinningShuttle.tsx` | New component |
| `src/components/SpinningShuttle.test.tsx` | New test file |
| `src/App.tsx` | Replace `showServerPicker` with `showSpinningShuttle`; replace `handleServerPickerComplete` with `handleShuttleComplete`; remove `ServerPickerOverlay` import |
| `src/App.test.tsx` | Update references from `showServerPicker` to `showSpinningShuttle` |
| `src/styles.css` | Replace `.server-picker-*` classes (lines 2222–2291) with `.spinning-shuttle-*` equivalents |

## What Stays the Same

- `SET_INITIAL_SERVER` command type and `setInitialServer()` engine function.
- `createInitialMatch` default (teamA serving at 0-0).
- MatchSettingsModal layout and manual first-server buttons.
- `handleNewMatch`, `handleStartMatch` callbacks — only the state variable name changes.
- Session flow and `InProgressMatchState` structure.

## Architecture Impact

### `.docs/ui/ui-architecture.md`

- Remove `ServerPickerOverlay` component reference
- Add `SpinningShuttle` component reference
- Update match initialization flow: server picker replaced by spinning shuttle

## Testing Strategy

- `SpinningShuttle.test.tsx`: Test state transitions (idle → spinning → settled → callback), verify `onComplete` fires with correct teamId, verify that outcome is random over many iterations.
- `App.test.tsx`: Update existing test assertions that reference `showServerPicker` to reference `showSpinningShuttle` instead.
- Remove `ServerPickerOverlay` references from `App.test.tsx`.
- Manual verification: start new matches, verify shuttle appears, spins, picks a team.
- Manual: verify via MatchSettingsModal the selected server is correct.

## Verification

```bash
npm test
npm run lint
npm run build
node --check public/sw.js
```

Manual checks:
1. Start new match (doubles) — shuttle overlay appears, tap it, it spins and picks a team.
2. Start new match (singles) — same.
3. Start session match — shuttle appears after "Start match".
4. MatchSettingsModal manual server buttons still work pre-scoring.
5. Scoring after shuttle selection works normally.

## Affected Components

- `src/components/ServerPickerOverlay.tsx` (removed)
- `src/components/SpinningShuttle.tsx` (new)
- `src/components/SpinningShuttle.test.tsx` (new)
- `src/App.tsx` (modified)
- `src/App.test.tsx` (modified)
- `src/styles.css` (modified)
- `.docs/ui/ui-architecture.md` (updated)
