---
title: Media — Speech Announcements & Animations
last-updated: 2026-05-23
---

# Speech & Animations

## Overview

Media output modules that enhance the match experience: speech announcements via the Web Speech API and celebration animation overlays triggered by scoring events.

## Location

| Area | Path |
|------|------|
| Speech | `src/speech/announcer.ts` |
| Animation detection | `src/animations/detectAnimationEvent.ts` |
| Animation assets | `src/animations/animationAssets.ts` |
| Animation overlay | `src/components/AnimationOverlay.tsx` |
| WebM assets | `public/animations/` |

## Speech Announcements

`src/speech/announcer.ts` wraps the Web Speech API (`window.speechSynthesis`):

- `getSpeechStatus()` — detects browser support ('available' | 'unsupported')
- `buildAnnouncement(match, mode)` — constructs a spoken phrase from the current `MatchState`
- `speakAnnouncement(match, mode)` — cancels any in-progress speech and enqueues the new announcement
- Two announcement modes: `'full'` (team name + server + score) and `'short'` (score + server)

The announcement is triggered after each point when `autoAnnounce` is enabled in preferences. Manual announce is always available. Typical phrase: "Team A serving, Player 1, 7-4."

## Animations

### Event Detection

`detectAnimationEvent(prev: MatchState, next: MatchState): AnimationEvent | null`

A pure function that compares match state before and after a `POINT_TEAM` command. Events are priority-ordered; when multiple conditions match, the highest priority wins:

| Priority | Event | Trigger |
|----------|-------|---------|
| 1 | `match_won` | `winnerTeamId` just set |
| 2 | `shutout` | Match won AND losing team score = 0 (supersedes `match_won`) |
| 3 | `bagel` | Scoring team reaches 11, opponent at 0 |
| 4 | `match_point` | Scoring team reaches 20, opponent ≤ 19 |
| 5 | `deuce` | Score becomes 20-20 |
| 6 | `streak_9` | Same team scored 9 consecutive points |
| 7 | `streak_6` | Same team scored 6 consecutive (not already 9) |
| 8 | `comeback` | Team trailed by ≥5 and just tied |
| 9 | `streak_3` | Same team scored 3 consecutive (not already 6) |
| 10 | `first_to_11` | Scoring team reaches 11, opponent > 0 |
| 11 | `score_6_7` | Score exactly 6-7 or 7-6 |

Streaks are computed by walking back `MatchState.history`. Streak thresholds are exclusive (9-streak fires `streak_9` only). Detection is skipped for `UNDO` and `RESET` commands.

### Animation Overlay

`AnimationOverlay.tsx` renders a full-screen overlay (100vw × 100vh, z-index above all UI) when an animation event fires:

- **Video:** `<video autoPlay loop muted playsInline>` with `object-fit: cover`, selected randomly from the event's video pool
- **Backdrop:** `rgba(0, 0, 0, 0.85)`
- **Label:** Bold white text over the video (e.g. "ON FIRE 🔥🔥🔥", "SHUTOUT!", "DEUCE")
- **Dismiss:** Auto-dismisses after 2500ms via `setTimeout`; CSS fade-in on mount, fade-out before dismiss
- If an animation is already playing, new events are dropped

### Animation Assets

`animationAssets.ts` maps each `AnimationEventType` to an array of WebM video paths. On trigger, one is selected at random:

```ts
const VIDEO_MAP: Record<AnimationEventType, string[]> = {
  match_won: ['/animations/match_won_1.webm', '/animations/match_won_2.webm'],
  shutout:   ['/animations/shutout_1.webm'],
  // ...
};
```

Videos are stored in `public/animations/` as WebM (VP9 codec, no audio), sourced from Giphy and converted from GIF via ffmpeg. Placeholder events use minimal valid 1×1 black WebM files.

### Service Worker Preloading

`public/sw.js` precaches all animation WebM files at install time. The video list is synced with `src/animations/animationAssets.ts`. See [Build & Deploy](../platform/build-deploy.md) for SW details.

## Related Docs

- [Build & Deploy](../platform/build-deploy.md) — service worker precaching of WebM files
- [UI Architecture](../ui/ui-architecture.md) — preferences control feature toggles, AnimationOverlay in component tree