---
title: Badminton Scorer App Design
author: arthur.kok
date: 2026-05-09
status: implemented
tags: [feature, design]
domain: feature
---

# Badminton Scorer App Design

## Goal

Build a phone-first installable web app for keeping score during a badminton game. The app should track the current score, serving team, serving player, receiver, and player court positions. It should show a regulation-proportioned court diagram, announce the score, support standard badminton rules, and accept remote commands from compatible Bluetooth remotes.

## Target Platform

The first version targets Android Chrome as a Progressive Web App. The app must remain fully usable through touch controls when Bluetooth is unavailable, unsupported, disconnected, hidden by the operating system, or not yet configured.

The layout is responsive and adapts to wider screens (tablets, laptops) so the app is usable as a courtside display on any device.

## Match Scope

The first version supports both doubles and singles, with doubles as the priority. Doubles behavior must follow standard badminton rally scoring:

- Games are played to 21 points.
- A team must win by 2 points after 20-all.
- The game is capped at 30 points.
- The serving side is derived from the serving team's even or odd score.
- Service changes after the receiving team wins a rally.
- Doubles server, receiver, and player court positions update according to standard service rotation.

Singles should share the same scoring engine where possible, with a simpler two-player court layout.

## Setup Flow

Setup must be fast enough for courtside use. A new match starts with default labels:

- Team A
- Team B
- Player 1
- Player 2
- Player 3
- Player 4

The user does not need to enter names before playing. A coin-flip action chooses the initial serving team and player. Before the first point, the user can reroll or manually override the first server if the real match setup differs from the coin-flip result.

## Core Product Behavior

The live match screen is the first screen. It shows:

- Large current score for both teams.
- Current serving team.
- Current serving player.
- Current receiver.
- A regulation-proportioned court diagram with each player on the correct court side.
- Highlighting for the active server.
- Game-over state when a team wins.

The app supports last-action undo. Undo restores the state before the most recent point was awarded. Full match history and a visible match log are out of scope for version 1.

## Announcements

The app uses browser speech synthesis to announce the score. Manual announce is always available. Auto-announce can be toggled, and when enabled the app announces after each point.

Announcements should include the server score first, the receiver score second, and the serving player label. A typical announcement is: "Team A serving, Player 1, 7-4." The phrase should stay concise and suitable for courtside use.

## Remote Input

The app supports remote input through adapters rather than embedding hardware details in scoring logic.

The first BLE target is a generic button or clicker on Android Chrome using Web Bluetooth. Generic remotes may expose button events differently, so BLE support must stay isolated behind the Bluetooth input adapter.

The app also supports keyboard-style Bluetooth camera remotes that pair as HID keyboards and emit volume-up key presses. The keyboard adapter listens for `AudioVolumeUp`, legacy `VolumeUp`, and key code `175` when the browser exposes those events.

All remote paths use the same gesture mapping:

- Single click: serving team wins the rally.
- Double click: receiving team wins the rally.
- Press and hold: undo last point.

The BLE adapter translates discovered device events into these gestures. If the selected clicker exposes different events, support is added as device-specific adapter code without changing the scoring engine. The keyboard adapter translates keydown and keyup events into the same press/release gesture stream, ignoring key-repeat events.

Bluetooth connection status should be visible but compact:

- Unsupported
- Disconnected
- Connecting
- Connected

When Web Bluetooth is unavailable, the app should explain that Android Chrome is required for BLE remote support and leave the scoring UI usable. Keyboard-style camera remotes depend on browser and operating system behavior; if the OS reserves volume keys, the web app may not receive those events.

## Controls

On-screen controls remain complete even when a remote is connected:

- Award point to serving team.
- Award point to receiving team.
- Undo last point.
- Announce score.
- Toggle auto-announce.
- Reset or start new match.
- Reroll or adjust first server before scoring starts.

Controls should be large enough for one-handed use. Destructive or disruptive controls such as reset should require confirmation or a deliberate interaction to avoid accidental use.

## Architecture

The app should be structured around a pure scoring engine. UI, speech, Bluetooth, keyboard shortcuts, and touch controls should sit outside the engine and communicate through command objects.

### Scoring Engine

The scoring engine owns:

- Match state.
- Score transitions.
- Service changes.
- Doubles rotation.
- Server and receiver derivation.
- Court side derivation.
- Game-over detection.
- Last-action undo snapshot.

It should expose command-style operations such as:

- `awardPointToServingTeam()`
- `awardPointToReceivingTeam()`
- `undoLastPoint()`
- `resetMatch()`
- `setInitialServer()`
- `createMatch()`

The engine should be deterministic and testable without browser APIs.

### Input Layer

All input sources send commands into the same app command handler:

- Touch controls.
- Bluetooth remote gestures.
- Keyboard-style Bluetooth remote gestures.
- Keyboard shortcuts for development and testing if added later.
- Future input sources.

This keeps remote-control details separate from scoring behavior.

### Speech Layer

The speech layer reads current match state and produces an announcement string. It owns interaction with browser speech synthesis and should fail silently or show a compact unavailable state if speech is not supported.

### Persistence

The app uses `localStorage` for two independent storage keys.

**Preferences** (`badminton-scorer-preferences`) stores user settings:

- Auto-announce enabled or disabled.
- Last selected match mode.
- Remote mapping selected by the user.
- Player names.

**Match state** (`badminton-scorer-match`) stores the live `MatchState` as JSON, including score, serving team, serving player, receiver, court positions, and the single-level undo snapshot. This allows the active match to survive a page refresh.

On startup the app attempts to restore the saved match state. Restoration is accepted only if the saved mode matches the current preferences mode; otherwise a fresh match is created. When the user explicitly resets (new match or mode change), the saved match state is cleared so the next load starts fresh.

## UI Direction

The interface should be dense, clear, and courtside-friendly. It should not have a landing page. The first viewport is the active court display, with the score overlaid directly on the court.

The visual hierarchy should prioritize:

1. The regulation court display.
2. Score, joined in one center box over the net.
3. Player court positions and active server highlight.
4. Utility controls.
5. Secondary actions.

The court diagram should make player positions, score, and court sides clear at a glance. It should use a top-down SVG layout scaled to the real doubles court dimensions: `13.40m x 6.10m`, with 40mm lines represented proportionally enough for display, singles sidelines, short service lines, doubles long service lines, center service lines, and the net. The diagram should be rotated horizontally so the net runs vertically in the middle of the screen. Team A appears on the left and Team B on the right. Because the teams face each other, Team B's visual lanes must be mirrored: Team B's right service court appears in the upper-right box and Team B's left service court appears in the lower-right box.

Both teams' scores should be overlaid as one joined numeric score box centered over the net. Team A's score appears on the left side of the joined box and Team B's score appears on the right side. Each side remains a separate tap target for awarding that team a point. The score overlay should not show team names, serving details, server names, receiver names, or explanatory text. Mobile score numerals should be smaller than the wide-display treatment so they do not crowd the court. The active server should be highlighted through the player chip on the court. Player chips should show only large player names, without server, receiver, or court-side labels; on wide displays names can scale up to about `3rem`, while mobile names stay around `1rem`. A non-text serving-team treatment, such as a subtle glow around the relevant score backing, is acceptable if it does not clutter the display.

### Responsive Layout

The app uses a single large court display at the top of the match screen on all viewport widths. On narrow screens, the court fills the available width while preserving the regulation court aspect ratio. At wider viewport widths, the court expands across the layout width instead of sharing space with a separate scoreboard. Controls, status bar, and the remote diagnostics log remain below the court. The overall layout is capped and centered on very large screens.

## Error Handling

The app should handle expected runtime limitations without blocking scoring:

- Bluetooth unsupported: show Android Chrome requirement and keep touch controls active.
- Bluetooth disconnected: show disconnected status and keep touch controls active.
- Bluetooth event not recognized: ignore the event or show a compact mapping warning.
- Keyboard remote key not exposed by browser or OS: keep touch controls active; no blocking error is needed.
- Speech unsupported: disable or hide announcement controls gracefully.
- Game already over: prevent scoring past the completed game. The user can start a new match or undo the last point.

## Testing Strategy

Testing should focus on the scoring engine first. Required engine coverage:

- Standard rally scoring.
- Doubles service rotation.
- Court side changes based on score parity.
- Service changes after receiving team wins.
- Server and receiver derivation.
- Win by 2 after 20-all.
- Cap at 30.
- Game-over behavior.
- Last-action undo.

UI tests should cover:

- Awarding a point to the serving team.
- Awarding a point to the receiving team.
- Undo.
- Manual announce button state.
- Auto-announce toggle.
- Bluetooth unsupported fallback.
- Keyboard remote lifecycle wiring.
- Regulation court line rendering.
- Mirrored visual court lanes for the team on the right side of the net.

Bluetooth and keyboard remote tests should use simulated events through their input adapters. Real hardware testing is useful but should not be required for automated tests.

## Out Of Scope For Version 1

- User accounts.
- Online sync.
- Full match history.
- Visible match log.
- Tournament or multi-court management.
- Player statistics.
- iPhone Bluetooth support.
- Guaranteed volume-key capture when the mobile operating system reserves volume buttons.
- Native mobile app packaging.

## Implementation Notes

The implementation should choose a modern frontend stack suitable for a phone-first PWA. The exact framework can be selected during planning, but the scoring engine should remain framework-independent.

The remote integration is the riskiest area because generic BLE clickers vary and keyboard-style camera remotes depend on browser/OS key exposure. The app should be valuable before remote input is fully tuned and should keep remote code isolated behind adapter interfaces.

