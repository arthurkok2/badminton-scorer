# Wear OS Remote Control — Design Spec

**Date:** 2026-06-29
**Status:** Draft

---

## Overview

Add a Wear OS watch app that lets a user control the badminton scorer remotely. The watch shows live match state (score, serving side, player names) and sends scoring commands (Team A point, Team B point, Undo). Communication flows through a minimal Android phone companion app that bridges the Wearable Data Layer to Firestore.

Zero changes to the existing React host PWA — it already publishes match state and consumes commands via the Firestore remote protocol.

---

## Architecture

```
Watch (Kotlin, Jetpack Compose for Wear OS)
    ↕ Wearable Data Layer API
Phone Companion (Android, Kotlin/Compose)
    ↕ Firebase Firestore SDK
Firestore (matches/{code}, matches/{code}/commands)
    ↕ existing firestoreRemoteService.ts
Host PWA (React/TypeScript, unchanged)
```

- **Watch:** Single screen showing match state + scoring buttons. Uses Wearable Data Layer to send/receive messages with the phone.
- **Phone companion:** Minimal Android app with a room code entry screen and a foreground service. Owns the Firebase connection. Relays everything between Firestore and the watch.
- **Host:** No changes. Uses existing `useWatchRemoteHost` hook which creates rooms, publishes state, and subscribes to commands.

Both sides speak the existing `firestoreRemoteTypes.ts` protocol — `WatchRemoteCommandType = 'POINT_TEAM' | 'UNDO' | 'ANNOUNCE'`, with metadata `sourceId`, `sourceKind: 'wear'`, `createdAt`.

---

## Watch App

### Single Screen

The watch shows two states:

**"Waiting" state (no active room):**
- Centered text: "Waiting for connection"
- Subtitle: "Connect to a match from the companion app"

**"Active" state (room connected):**

```
  ● Connected
  Team A name
  [Team A score — large]
  ● Serving indicator (arrow/dot next to serving team)
  [Team B score — large]
  Team B name
  ────────────
  [     SCORE TEAM A      ]   green-tinted, full-width
  [     SCORE TEAM B      ]   blue-tinted, full-width
  [        UNDO           ]   smaller, centered below
```

- Tapping a score button sends `POINT_TEAM` with the appropriate `teamId`.
- Long-press on either score button sends `UNDO`.
- Haptic feedback on every command dispatch.
- Match-state changes from the host are reflected in real-time.
- When the match ends (`winnerTeamId` is non-null): scores freeze, buttons disabled, "Match Over" banner shown.

### State

- ViewModel holds: room code, connection status, current match snapshot, pending command queue.
- Match snapshot mirrors the existing `MatchSnapshot` type: score, teams, serving team/player, winner, mode.
- Data Layer payloads are JSON.
- Last room code is persisted in DataStore for reconnect after phone reboot (optional, P2).

### Implementation

- Jetpack Compose for Wear OS (`wear.compose`).
- `ScalingLazyColumn` for vertical scroll on round screens.
- `WearCurvedText` and `TimeText` optional (Wear OS navigation).
- No room code entry on the watch — the phone handles all setup.

---

## Phone Companion App

### Activity

A single activity with two visual states:

**Setup state (not connected):**
- Room code input: 4 characters, auto-advancing fields (like SMS verification code input).
- "Connect" button.
- "Watch status" indicator: shows whether Wearable Data Layer is connected to the watch.
- Last-used room code pre-filled from `SharedPreferences`.

**Connected state (in a room):**
- Green dot + "Connected to match".
- Score display (small, mirrors what the watch shows).
- "Disconnect" button.

### Foreground Service

- Named `RemoteForegroundService`.
- Persistent notification: "Badminton Remote Active".
- Survives activity destruction, screen off, battery optimization.
- Owns all Firestore listeners:
  - `matches/{code}` document listener → pushes match state to watch via Data Layer.
  - `matches/{code}/commands` collection listener (for command confirmations, optional).
- Owns all Data Layer listeners:
  - Receives commands from watch → writes to `matches/{code}/commands` collection using the same document schema.
- On service stop (disconnect or system kill): sends `INACTIVE` status to watch.

### Authentication

- Firebase Auth with Google Sign-In (same provider as the host PWA).
- Silent sign-in on first launch; fallback to sign-in button if unavailable.

### Implementation

- Jetpack Compose (phone side, not Wear-specific).
- Firebase Firestore + Auth Android SDKs.
- Wearable Data Layer (`DataClient`).
- AndroidX, Kotlin coroutines.

---

## Wearable Data Layer Protocol

All messages are JSON. Each message type uses a separate Data Layer path so `onDataChanged()` triggers only for relevant changes. Messages use `DataClient.putDataItem()` (guaranteed delivery, not `sendMessage`).

### Phone → Watch

**MATCH_STATE** — sent when the host publishes updated state:
```json
{
  "type": "MATCH_STATE",
  "match": {
    "teamA": { "name": "Arthur & Ben", "score": 11 },
    "teamB": { "name": "Chris & Dan", "score": 8 },
    "servingTeamId": "teamA",
    "servingPlayerId": "A1",
    "winnerTeamId": null,
    "matchMode": "doubles"
  }
}
```

**CONNECTION_STATUS** — sent on room join/leave:
```json
{ "type": "CONNECTION_STATUS", "status": "ACTIVE" }
```
`status`: `"ACTIVE"` | `"INACTIVE"`

### Watch → Phone

**COMMAND** — sent on score button tap or undo long-press:
```json
{
  "type": "COMMAND",
  "command": {
    "commandType": "POINT_TEAM",
    "teamId": "teamA"
  }
}
```
`commandType`: `"POINT_TEAM"` | `"UNDO"` | `"ANNOUNCE"`
`teamId`: `"teamA"` | `"teamB"` (only for POINT_TEAM)

### Error Handling

- Phone Firestore disconnects → sends `CONNECTION_STATUS: "INACTIVE"` → watch returns to "Waiting" screen.
- Watch Data Layer disconnects → watch shows warning icon + "Check phone" message.
- Commands from watch are fire-and-forget; haptic feedback confirms to the user. The host's existing `markCommandApplied`/`markCommandRejected` handles duplicates.

---

## Project Structure

```
wear-os/                                  (new root)
  build.gradle.kts                        — project-level
  settings.gradle.kts
  gradle.properties
  wear/
    build.gradle.kts                      — watch module
    src/main/
      AndroidManifest.xml
      java/com/badminton/scorer/watch/
        MainActivity.kt                   — single activity
        RemoteScreen.kt                   — composing waiting/active states
        RemoteViewModel.kt                — state, Data Layer handling
        WearDataLayerClient.kt            — wraps DataClient API
      res/values/
        strings.xml, colors.xml
      res/drawable/
  companion/
    build.gradle.kts                      — phone module
    src/main/
      AndroidManifest.xml
      java/com/badminton/scorer/companion/
        MainActivity.kt                   — setup & connected states
        RemoteForegroundService.kt        — Firestore ↔ Data Layer bridge
        FirebaseClient.kt                 — Firestore read/write
      res/values/
        strings.xml
```

---

## Dependencies

### Wear Module
- `androidx.wear.compose:compose-material3`
- `androidx.wear.compose:compose-foundation`
- `com.google.android.horologist:horologist-compose-layout` (optional, convenience)
- `com.google.android.gms:play-services-wearable`

### Companion Module
- `com.google.firebase:firebase-firestore-ktx`
- `com.google.firebase:firebase-auth-ktx`
- `com.google.android.gms:play-services-wearable`
- `androidx.core:core-ktx`, `androidx.lifecycle:lifecycle-runtime-ktx`

---

## Non-Goals

- No changes to the React host PWA.
- No changes to the Garmin remote (coexists independently).
- No changes to Firestore security rules (companion authenticates with existing Google Auth).
- No watch-side room code entry (phone handles setup).
- No Bluetooth Low Energy direct connection (uses Data Layer + Firestore path).
- No watch face complications or tiles in v1 (can be added later).

---

## Migration / No Impact

- The existing host `useWatchRemoteHost` hook publishes match state and reads commands via the same Firestore documents. The companion phone app writes commands in the identical format and reads state from the same path. Zero host changes.
- The existing `GarminRemote/` Monkey C app remains functional and independent. Both remotes can coexist — they write to the same commands subcollection.
- Existing preference/state/localStorage mechanisms in the React app are unaffected.

---

## Testing Strategy

- **Watch module:** Unit tests for ViewModel state transitions and Data Layer message serialization. UI tests with Compose testing APIs for Wear (screenshot/comparison).
- **Companion module:** Unit tests for FirebaseClient message mappers (ensure Firestore doc ↔ Data Layer JSON parity). Integration test with Firebase emulator for the full Firestore ↔ Data Layer pipeline.
- **End-to-end:** Manual test with host PWA + Firebase emulator + phone emulator (Data Layer doesn't work on emulator; test Data Layer serialization in isolation). Physical device testing for Data Layer.
