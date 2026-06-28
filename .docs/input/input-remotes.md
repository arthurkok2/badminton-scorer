---
title: Input — All Remote Control Surfaces
last-updated: 2026-06-24
---

# Input Remotes

## Overview

The input layer provides multiple control surfaces for the scorer, all normalized into a shared `AppCommand` type before reaching the game engine. This includes local remotes (BLE, keyboard, gamepad, gesture) and the Firestore-based remote controller for companion devices. A diagnostics log aggregates events from all remotes.

## Location

| Area | Path |
|------|------|
| Commands & reducer | `src/input/commands.ts` |
| Bluetooth remote | `src/input/bluetoothRemote.ts` |
| Keyboard remote | `src/input/keyboardRemote.ts` |
| Gamepad remote | `src/input/gamepadRemote.ts` |
| Gesture remote | `src/input/gestureRemote.ts` |
| Firestore remote host | `src/remote/firestoreRemoteService.ts` |
| Firestore controller client | `src/remote/firestoreControllerService.ts` |
| Controller page | `src/pages/ControllerPage.tsx` |
| Remote diagnostics | `src/components/DiagnosticsLog.tsx` |

## Architecture

### Command Types

`src/input/commands.ts` defines the `AppCommand` discriminated union:

- `ScorePoint` — award point to serving/receiving team
- `UndoLastPoint` — revert most recent point
- `SwapService` — change server
- `NewMatch` — reset the match
- `NewGame` — start a new game within a session
- `UndoLastGame` — revert last completed game
- `FullscreenToggle` — toggle fullscreen display mode

### Gesture Mapping

All remote paths use a unified gesture mapping:

- **Single click** → serving team wins the rally
- **Double click** → receiving team wins the rally
- **Press and hold** → undo last point

### Local Input Sources

| Source | Path | Mechanism |
|--------|------|-----------|
| Bluetooth | `src/input/bluetoothRemote.ts` | Web Bluetooth API, pairs with BLE button remotes (generic clickers) |
| Keyboard | `src/input/keyboardRemote.ts` | Keydown event listeners for HID camera remotes (VolumeUp / key 175) |
| Gamepad | `src/input/gamepadRemote.ts` | Gamepad API, polls connected controllers at ~60fps |
| Gesture | `src/input/gestureRemote.ts` | Touch gesture recognition on the court display |

**BLE:** Targets Android Chrome (Web Bluetooth). Device-specific adapter code translates button events into the shared gesture mapping. Connection states: Unsupported → Disconnected → Connecting → Connected. When Web Bluetooth is unavailable, the app explains Android Chrome is required.

**Keyboard:** Listens for `AudioVolumeUp`, legacy `VolumeUp`, and key code `175`. Key-repeat events are ignored. Volume-key capture depends on browser/OS — when the OS reserves volume keys, the web app may not receive events.

**Gamepad:** Polls `navigator.getGamepads()` on each animation frame. Button-to-command mapping is configurable via preferences.

### Firestore Remote

`src/remote/` implements a Firestore-based relay for companion devices (Wear OS watches, Garmin watches, browser `/controller` page):

- **Host** (`firestoreRemoteService.ts`) — creates rooms, publishes `MatchState`, processes commands, marks applied/rejected
- **Controller client** (`firestoreControllerService.ts`) — subscribes to room state, writes commands
- **Controller page** (`/controller`) — browser-based Wear OS simulator using the controller client
- Commands flow through the same `applyCommand()` reducer as local input

#### Room Lifecycle

1. Host creates a match room in `matches/{code}` with a 4-6 char code
2. Controller joins by entering the code (manual keyboard/voice input; no QR in v1)
3. Controller subscribes to `matches/{code}` via `onSnapshot`
4. Controller writes commands to `matches/{code}/commands/{commandId}`
5. Host listens for unprocessed commands, applies them sequentially, publishes updated `MatchState`
6. Host heartbeat (`hostHeartbeatAt`) lets controllers detect host offline
7. Host ends room by setting `active: false`

#### Room Document Model

`matches/{code}`: `code`, `active`, `hostId`, `createdAt`, `updatedAt`, `hostHeartbeatAt`, `matchState`, `matchMode`, `winnerTeamId`, `lastAppliedCommandId`

`matches/{code}/commands/{commandId}`: `type` (POINT_TEAM | UNDO | ANNOUNCE), `teamId`, `sourceId`, `sourceKind` (wear | web | garmin), `createdAt`, `appliedAt?`, `rejectedAt?`, `rejectionReason?`

Commands are append-only from controllers; only the host marks them applied/rejected.

#### Garmin Connect IQ Remote

A separate Connect IQ watch app (`GarminRemote/`) targets the Garmin Forerunner 265. It posts commands to the same Firestore room via the **Firestore REST API** rather than the Firebase SDK, routing HTTP requests through the Garmin Connect app on the user's paired phone.

```
Watch button press
  → Garmin Connect app on phone (Bluetooth)
    → Firestore REST API (internet)
      → Scorer app (existing command processing)
```

Because the Garmin SDK cannot perform Firebase authentication, the Firestore `commands` `allow create` rule does not require auth. Field validation (`hasOnly`, enum checks, no outcome fields on create) remains in place. See the security rationale in `.specs/2026/06/2026-06-24-garmin-connect-iq-remote.md`.

Button mapping: UP → Team A point, DOWN → Team B point, hold BACK → Undo.

### Connection Pattern

Each remote source follows a consistent pattern:
1. `connect*Remote()` — returns a `Connection` object with a `disconnect()` method
2. Accepts a callback that receives the parsed `AppCommand`
3. Emits diagnostic events for the debug log

### Remote Diagnostics Log

`DiagnosticsLog` aggregates events from all remote sources, showing connection state changes, received commands, and errors. Each remote's `connect*()` function accepts a diagnostic callback. The log is visible in a collapsible panel below the court view.

### Shared Reducer

All commands are reduced through `applyCommand()` in `src/input/commands.ts`, which:
1. Maps the command to the appropriate engine function (`scorePoint`, `undoLastPoint`, etc.)
2. Persists the new state via `saveMatchState()`
3. Triggers speech announcements if enabled
4. Returns the new `MatchState`

## Data Flow

```
BLE button press   ─┐
Keyboard shortcut  ─┤
Gamepad button    ──┤──→ AppCommand ──→ applyCommand() ──→ new MatchState
Gesture swipe     ──┤
Firestore remote  ──┤  (Wear OS, browser controller, Garmin watch)
                   ─┘
```

## Related Docs

- [Scoring Engine](../game-engine/scoring-engine.md) — commands target engine functions
- [UI Architecture](../ui/ui-architecture.md) — App.tsx wires connections into the component tree
- [Firebase & Data](../data/firebase-services.md) — Firestore configuration, auth, cloud sync