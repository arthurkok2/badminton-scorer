# Serve Spin Animation Design

**Date:** 2026-06-04
**Status:** Approved

## Overview

Replace the current random "Reroll first server" logic with a visual shuttle spin animation. When creating a new match or clicking "Reroll first server", a full-screen overlay shows a spinning shuttle that decelerates over ~3 seconds and stops pointing at Team A (left) or Team B (right), visually determining which team serves first.

## Triggers

1. Creating a new match via the app menu ("New Match")
2. Clicking "Reroll first server" in MatchSettingsModal
3. Starting a match from a session suggestion

In all cases, the overlay plays and the result sets the initial server.

## Component: `ServeSpinOverlay`

- **Backdrop:** Semi-transparent dark overlay, matching the existing `AnimationOverlay` style
- **Shuttle:** Inline SVG (simple cone + cork + skirt shape), centered in viewport
- **Animation:** CSS `@keyframes` — fast continuous spin → deceleration curve → stop at predetermined angle, total ~3s
- **Result:** After stopping, the shuttle tip points left (Team A) or right (Team B). Text appears: "Team [name] serves first!" for ~1s, then auto-dismiss
- **No skip:** Fixed duration, no user interaction to skip

## Data Flow

```
User action (New Match / Reroll)
  → dispatch({ type: 'SPIN_FOR_SERVE' })
  → matchView.showServeSpin = true
  → ServeSpinOverlay mounts
  → Picks random result (50/50 Team A / Team B), sets final CSS rotation angle
  → CSS animation plays for ~3s
  → animationend event fires
  → Result label shown for ~1s
  → Auto-dismiss
  → dispatch({ type: 'SET_INITIAL_SERVER', teamId, playerId })
```

The animation is purely visual — the random result is determined immediately when the overlay mounts. The CSS animation plays out the spin regardless.

## State Changes

- `MatchViewState` gains `showServeSpin: boolean` (default `false`)
- `AppCommand` gains `'SPIN_FOR_SERVE'` action type
- `applyMatchViewAction` handles `SPIN_FOR_SERVE` by setting `showServeSpin: true`

## Files

| File | Action | Changes |
|------|--------|---------|
| `src/components/ServeSpinOverlay.tsx` | **New** | Overlay component with SVG shuttle, CSS animation, result label |
| `src/App.tsx` | Modified | Add `showServeSpin` to state, handle `SPIN_FOR_SERVE` in dispatch, render overlay |
| `src/styles.css` | Modified | Add `@keyframes serve-spin` and overlay styles |
| `src/components/MatchSettingsModal.tsx` | Modified | "Reroll first server" dispatches `SPIN_FOR_SERVE` instead of calling `onRerollFirstServer` |
| `src/input/commands.ts` | Modified | Add `SPIN_FOR_SERVE` to `applyCommand` |

## Edge Cases

- **Animations disabled:** If `preferences.animationsEnabled` is `false`, skip the overlay entirely and resolve immediately via random `SET_INITIAL_SERVER` (preserving the existing `handleRerollFirstServer` logic as fallback)
- **Score not 0-0:** The `SET_INITIAL_SERVER` engine function already guards this (line 72-74 in matchEngine.ts), so a spin result dispatched after scoring has started will be a no-op
- **New match while overlay is visible:** Unlikely (overlay is fixed-duration, no skip), but if it happens, dismiss current overlay before showing new one
- **Session match start:** Currently hardcodes `teamA/A1`. The spin result should be passed through to `createMatch` options

## SVG Shuttle Design

The shuttle will be a simple inline SVG:
- Cork: small circle/ellipse at bottom
- Skirt: flared cone shape (polygon or path) above the cork
- Centered with `transform-origin: center center` for rotation
- Size: ~80px, styled with CSS fill/stroke
