# Meme Gif Animations Design

**Date:** 2026-05-13

## Overview

Full-screen meme gif overlays that play on milestone and fun scoring events during a match. Gifs are bundled as static assets (sourced from Giphy and committed to the repo). A preference toggle lets users disable animations.

## Events

Events are detected by comparing the match state before and after each `POINT_TEAM` command. When multiple conditions are met simultaneously, the highest-priority event wins.

| Priority | Event type | Trigger condition |
|----------|------------|-------------------|
| 1 | `match_won` | `next.winnerTeamId` set, `prev.winnerTeamId` unset |
| 2 | `shutout` | Match won AND losing team score is 0 |
| 3 | `bagel` | Scoring team just reached 11, opponent still at 0 |
| 4 | `match_point` | Scoring team reaches 20, opponent ≤ 19 |
| 5 | `deuce` | Score just became 20-20 |
| 6 | `streak_9` | Same team scored 9 consecutive points (from history) |
| 7 | `streak_6` | Same team scored 6 consecutive (not already at 9) |
| 8 | `comeback` | Team was trailing by ≥5 points at any point in the match, and just tied the score |
| 9 | `streak_3` | Same team scored 3 consecutive (not already at 6) |
| 10 | `first_to_11` | Scoring team just reached 11, opponent > 0 |

`shutout` supersedes `match_won` — it is the more specific event. Streak is computed by walking back `next.history` until a different team scored. Streak thresholds are exclusive: a 9-streak fires `streak_9` only (not also `streak_6` or `streak_3`).

Each `AnimationEvent` carries `{ type: AnimationEventType; teamId: TeamId }` so the overlay can show which team triggered it.

## Architecture

### `src/animations/detectAnimationEvent.ts`

Pure function — no side effects, fully unit-testable:

```ts
export function detectAnimationEvent(
  prev: MatchState,
  next: MatchState
): AnimationEvent | null
```

Implements the priority table above. Returns `null` on undo, reset, or no qualifying event.

### `src/animations/animationAssets.ts`

Maps each event type to one or more bundled gif paths. On each trigger, one is selected at random for variety.

```ts
const GIF_MAP: Record<AnimationEventType, string[]> = {
  match_won: ['/animations/match_won_1.gif', '/animations/match_won_2.gif'],
  shutout:   ['/animations/shutout_1.gif'],
  // ...
};

export function getGifUrl(type: AnimationEventType): string
```

Gifs live in `public/animations/` as committed static assets. Sourced from Giphy; each file should be under 2 MB. `.gif` or `.webp` format.

### Gif curation

| Event | Vibe / Giphy search terms |
|-------|--------------------------|
| `match_won` | "celebration confetti" |
| `shutout` | "flawless victory mortal kombat" |
| `bagel` | "sad trombone" |
| `match_point` | "dramatic chipmunk" |
| `deuce` | "back and forth tug of war" |
| `streak_9` | "he's on fire nba jam" |
| `streak_6` | "on fire" |
| `comeback` | "rocky balboa training" |
| `streak_3` | "lets go fist pump" |
| `first_to_11` | "halfway there bon jovi" |

### `src/components/AnimationOverlay.tsx`

Full-screen overlay component:

```ts
interface Props {
  event: AnimationEvent | null;
  onDismiss: () => void;
}
```

- **Size:** 100vw × 100vh, fixed position, z-index above all other UI
- **Backdrop:** `rgba(0, 0, 0, 0.85)`
- **Gif:** `<img>` with `object-fit: cover`, fills the full overlay
- **Label:** short text centered on top of gif in large bold white text (e.g. "ON FIRE 🔥"), derived from event type
- **Dismiss:** auto-dismisses after 2500ms via `setTimeout`; calls `onDismiss` which clears event state in parent
- **Animation:** CSS fade-in on mount; fade-out before dismiss

Event-to-label mapping (examples):

| Event | Label |
|-------|-------|
| `match_won` | "MATCH!" |
| `shutout` | "SHUTOUT!" |
| `bagel` | "BAGEL 🥯" |
| `match_point` | "MATCH POINT" |
| `deuce` | "DEUCE" |
| `streak_9` | "ON FIRE 🔥🔥🔥" |
| `streak_6` | "ON FIRE 🔥🔥" |
| `streak_3` | "ON FIRE 🔥" |
| `comeback` | "COMEBACK!" |
| `first_to_11` | "HALFWAY THERE" |

### Wiring in `App.tsx`

After each `applyCommand` call that produces a new `MatchState`:

```ts
const animEvent = animationsEnabled
  ? detectAnimationEvent(prevMatch, nextMatch)
  : null;
if (animEvent) setActiveAnimation(animEvent);
```

`activeAnimation: AnimationEvent | null` stored in component state. Passed to:

```tsx
<AnimationOverlay event={activeAnimation} onDismiss={() => setActiveAnimation(null)} />
```

Detection is skipped for `UNDO` and `RESET` commands. If an animation is already playing when a new event fires, the new event is dropped — the in-progress animation completes first.

### Preferences

Add `animationsEnabled: boolean` (default `true`) to `AppPreferences` in `preferences.ts`. Exposed as a toggle in the existing preferences UI.

## Files Changed / Added

| File | Change |
|------|--------|
| `src/animations/detectAnimationEvent.ts` | New — pure event detection |
| `src/animations/detectAnimationEvent.test.ts` | New — unit tests |
| `src/animations/animationAssets.ts` | New — gif registry |
| `src/components/AnimationOverlay.tsx` | New — overlay component |
| `src/components/AnimationOverlay.test.tsx` | New — component tests |
| `public/animations/*.gif` | New — bundled gif assets |
| `src/App.tsx` | Wire detection + overlay |
| `src/preferences.ts` | Add `animationsEnabled` |
| `src/styles.css` | Overlay CSS (fade-in/out keyframes) |

## Testing

- `detectAnimationEvent` unit tests cover every event type, priority conflicts, streak boundaries, and null cases (undo, reset, no event)
- `AnimationOverlay` tests verify render, label display, and dismiss callback firing
- No integration tests needed — the detection function is pure and independently verifiable
