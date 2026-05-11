# Badminton Scorer App Design

Date: 2026-05-09

## Goal

Build a phone-first installable web app for keeping score during a badminton game. The app should track the current score, serving team, serving player, receiver, and player court positions. It should announce the score, support standard badminton rules, and accept remote commands from a generic Bluetooth clicker on Android Chrome.

## Target Platform

The first version targets Android Chrome as a Progressive Web App. The app must remain fully usable through touch controls when Bluetooth is unavailable, unsupported, disconnected, or not yet configured.

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
- A court diagram with each player on the correct court side.
- Highlighting for the active server.
- Game-over state when a team wins.

The app supports last-action undo. Undo restores the state before the most recent point was awarded. Full match history and a visible match log are out of scope for version 1.

## Announcements

The app uses browser speech synthesis to announce the score. Manual announce is always available. Auto-announce can be toggled, and when enabled the app announces after each point.

Announcements should include the server score first, the receiver score second, and the serving player label. A typical announcement is: "Team A serving, Player 1, 7-4." The phrase should stay concise and suitable for courtside use.

## Bluetooth Remote

The first Bluetooth target is a generic BLE button or clicker on Android Chrome using Web Bluetooth. Generic remotes may expose button events differently, so Bluetooth must be implemented as an input adapter rather than embedded in scoring logic.

The default remote gesture mapping is:

- Single click: serving team wins the rally.
- Double click: receiving team wins the rally.
- Press and hold: undo last point.

The Bluetooth adapter translates discovered device events into these gestures. If the selected clicker exposes different events, support is added as device-specific adapter code without changing the scoring engine.

Bluetooth status should be visible but compact:

- Unsupported
- Disconnected
- Connecting
- Connected

When Web Bluetooth is unavailable, the app should explain that Android Chrome is required for remote support and leave the scoring UI usable.

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
- Keyboard shortcuts for development and testing.
- Future input sources.

This keeps remote-control details separate from scoring behavior.

### Speech Layer

The speech layer reads current match state and produces an announcement string. It owns interaction with browser speech synthesis and should fail silently or show a compact unavailable state if speech is not supported.

### Persistence

Version 1 only needs local browser storage for preferences:

- Auto-announce enabled or disabled.
- Last selected match mode.
- Remote mapping selected by the user.

The active match remains in memory. Reload recovery is out of scope for version 1.

## UI Direction

The interface should be dense, clear, and courtside-friendly. It should not have a landing page. The first viewport is the active scoreboard.

The visual hierarchy should prioritize:

1. Score.
2. Serving team and player.
3. Court positions.
4. Point controls.
5. Secondary actions.

The court diagram should make player positions and court sides clear at a glance. The active server should be highlighted in both the scoreboard and court view when space allows.

## Error Handling

The app should handle expected runtime limitations without blocking scoring:

- Bluetooth unsupported: show Android Chrome requirement and keep touch controls active.
- Bluetooth disconnected: show disconnected status and keep touch controls active.
- Bluetooth event not recognized: ignore the event or show a compact mapping warning.
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

Bluetooth tests should use simulated remote events through the input adapter. Real hardware testing is useful but should not be required for automated tests.

## Out Of Scope For Version 1

- User accounts.
- Online sync.
- Full match history.
- Visible match log.
- Tournament or multi-court management.
- Player statistics.
- iPhone Bluetooth support.
- Native mobile app packaging.
- Reload recovery for an active match.

## Implementation Notes

The implementation should choose a modern frontend stack suitable for a phone-first PWA. The exact framework can be selected during planning, but the scoring engine should remain framework-independent.

The Bluetooth integration is the riskiest area because generic BLE clickers vary. The app should be valuable before Bluetooth is fully tuned and should keep Bluetooth code isolated behind an adapter interface.
