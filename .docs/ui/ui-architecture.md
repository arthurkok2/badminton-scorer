---
title: UI — Components, Pages, Hooks, Styling, Preferences
last-updated: 2026-05-24
---

# UI Architecture

## Overview

The UI layer is a React 19 application using react-router-dom v7 for routing. Components are organized by role, with shared styles in a single CSS file. The app supports multiple display modes, session management flows, and an account system.

## Location

| Area | Path |
|------|------|
| App root | `src/App.tsx` |
| Components | `src/components/` |
| Pages | `src/pages/` |
| Hooks | `src/hooks/` |
| Styles | `src/styles.css` |
| Preferences | `src/preferences.ts` |

## Component Hierarchy

```
App
├── AuthGate (optional, wraps when auth enabled)
│   ├── SessionImportPrompt (legacy → global player mapping)
│   └── MatchSetup (mode selection, player names)
├── CourtView (display modes: court | little-fighters)
│   ├── CourtFullscreenButton (Fullscreen API wrapper)
│   ├── ScoreDisplay, ServiceIndicator, PlayerLabels
│   └── LittleFighters: arena SVG, health bars, HUD score buttons
├── Controls (score +1, undo, service swap, etc.)
├── AnimationOverlay (full-screen WebM video on events)
├── Menus & Modals
│   ├── AccountMenu (sign in/out, account settings)
│   ├── MatchSettingsMenu
│   ├── DisplayMenu (animations toggle, session history toggle)
│   ├── DiagnosticsLog
│   ├── MatchHistory
│   ├── AnimationsMenu
│   ├── AnnouncementsMenu
│   └── RemoteControlsMenu
└── Session components
    ├── SessionSetup (player search, global player picker, auth gate)
    ├── MatchSuggestion (team display, swap/change break buttons)
    ├── SessionMatchHistory (completed match list with scores & durations)
    └── SessionImportPrompt
```

## Routes

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `App` | Live scorer |
| `/controller` | `ControllerPage` | Wear OS / browser remote controller; renders a watch-optimized layout (via `useWatchLayout()` hook + `.watch-*` CSS classes) when a narrow, near-square viewport is detected — Galaxy Watch 8 / Samsung Internet Browser |

## Display Modes

The `CourtView` component supports two display modes, controlled by the `displayMode` preference:

| Mode | Description |
|------|-------------|
| `court` | Regulation top-down court SVG with player chips, score overlay over the net |
| `little-fighters` | Isometric side-view arena with fighter sprites, health bars, and HUD score buttons |

### Little Fighters Mode

An isometric court projection rendered as SVG. Features:
- Two fighters per team in doubles, current server advanced toward net
- Health bars derived from opposing score (HP = 21 - opponent score)
- HUD with large tappable score buttons per team, `Serve` badge on serving team
- Fighter nameplates: Team A labels left of sprite, Team B labels right
- Point feedback: scoring server animates with a lunge, opposing side flashes/bounces
- Sprite theme: little-fighters uses a badminton-themed pixel-art roster; visible players render deterministic per-player sprites instead of one shared sprite per team
- Sprite editing: clicking a fighter opens a sprite picker modal for that player
- Persistence: one-off matches use temporary per-slot overrides; session matches save sprite choice to the global player profile

### Fullscreen Button

A shared `CourtFullscreenButton` renders on both display modes. Uses the browser Fullscreen API targeting the Court section only (not the whole app). Listens for `fullscreenchange` to stay correct when the user exits via Esc or browser chrome.

## Preferences

`src/preferences.ts` manages app-wide settings persisted to `localStorage`:

- `autoAnnounce` / `announcementMode` — speech toggle
- `matchMode` — singles or doubles
- `displayMode` — `court` or `little-fighters`
- `animationsEnabled` — celebration effects toggle
- `showSessionHistoryDuringLiveMatches` — session history visibility during play
- `playerNames` — per-player name overrides
- `remoteMapping` — controller layout

All preferences are validated via `parsePreferences()` with fallback defaults on corrupt data.

## Session UI Flow

Session mode requires a signed-in (non-anonymous) Google account. Entry points:

1. **Auth gate** — `handleSwitchToSession` checks auth; if not signed in, shows "Sign in required" modal
2. **Session setup** — Global player search/creation, no plain-name entry; chips for saved players and search results
3. **Match suggestion** — Shows proposed teams, break players, Swap/Change break buttons
4. **Playing** — Live scorer with session-specific controls (no name editing, no mode switch, return-to-suggestion at 0-0)
5. **Match history** — Shown on suggestion screen and during play (toggleable); newest first, with final scores and duration

### Session Import Prompt

When a user signs in with existing legacy local sessions, a mapping dialog prompts them to associate each legacy player name with a global `GlobalPlayer` record before uploading to Firestore.

## Account Menu

Global account bar with auth-dependent rendering:
- Loading → nothing rendered
- Auth unavailable (offline) → muted "Unavailable offline" text
- Signed out / anonymous → "Sign in with Google" button
- Signed in → user display name/avatar + Sign out, account settings access

## Styling

Plain CSS in `src/styles.css`. No CSS-in-JS or CSS modules. Uses custom properties for theming.

## Related Docs

- [Scoring Engine](../game-engine/scoring-engine.md) — game logic consumed by components
- [Input Remotes](../input/input-remotes.md) — input sources wired in App.tsx
- [Speech & Animations](../media/speech-animations.md) — audio and visual features

