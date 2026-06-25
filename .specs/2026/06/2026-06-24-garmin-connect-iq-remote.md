---
title: Garmin Connect IQ Remote Controller
author: arthur.kok
date: 2026-06-24
status: draft
tags: [input, remote, garmin]
domain: input
---

# Garmin Connect IQ Remote Controller

## Problem

The current physical remote is a Wiimote nunchuck, which is too bulky to hold comfortably during play. The user wears a Garmin Forerunner 265 on their wrist while playing and wants to use watch button presses to score points instead.

The existing Firestore remote system was designed for Wear OS using the Firebase Android SDK. The Garmin Forerunner 265 runs Connect IQ (Monkey C) and cannot use the Firebase SDK. It must communicate via HTTP.

## Goal

A Connect IQ watch app that sends `POINT_TEAM` and `UNDO` commands to the existing Firestore room, allowing the wearer to score rallies with wrist button presses while the tablet displays the scorer app.

## Constraints

- The tablet running the scorer must have internet access.
- The Garmin watch communicates via the paired phone (Garmin Connect app as relay); the phone stays in the player's bag — no interaction required during play.
- The watch app must use the Firestore REST API (not the Firebase SDK).
- The scorer app (`src/`) must not require any changes — it already handles Firestore commands.
- The Firestore security rules currently require `isNamedSignedIn()` (non-anonymous Firebase auth) to create commands. The watch cannot perform Firebase auth. Rules must be relaxed for command creation only.

## Non-Goals

- Displaying match state on the watch (score mirror).
- Entering player names or configuring a match from the watch.
- `ANNOUNCE` command support in v1.
- Offline queuing of commands when the watch has no relay.
- QR code or deep-link pairing (room code entered manually on watch).
- Production-hardened rate limiting or per-device abuse prevention.

## Acceptance Criteria

- Pressing the designated Team A button on the watch creates a valid `POINT_TEAM teamA` command document in Firestore within 3 seconds under normal network conditions.
- Pressing the designated Team B button creates a valid `POINT_TEAM teamB` command document.
- Pressing the Undo button creates a valid `UNDO` command document.
- The scorer app on the tablet applies each command exactly as it does for the existing web controller.
- The watch shows a confirmation (brief vibration or UI feedback) on successful HTTP response.
- The watch shows an error indication on HTTP failure.
- The scorer app continues to work fully offline (no regression) when the Garmin remote is not in use.
- The Firestore rules change does not allow unauthenticated clients to modify match state, apply/reject commands, or write to any other collection.

## Approach

### Authentication

Relax the command `create` rule in `firestore.rules` to allow unauthenticated writes. Command creation is low risk: commands are append-only, the host validates them before applying, and malicious commands can only affect a match if the attacker knows the 4-character room code. The existing field validation and `hasOnly` checks remain in place.

The `isNamedSignedIn()` guard is removed only from `matches/{code}/commands/{commandId}` `allow create`. All other rules are unchanged.

Add `'garmin'` to the `isValidSourceKind` allowlist alongside `'wear'` and `'web'`.

### Firestore REST API

The watch posts commands via the Firestore REST API:

```
POST https://firestore.googleapis.com/v1/projects/badminton-scorer-91f7d/databases/(default)/documents/matches/{code}/commands
```

Request body (Firestore REST document format):

```json
{
  "fields": {
    "type":       { "stringValue": "POINT_TEAM" },
    "teamId":     { "stringValue": "teamA" },
    "sourceId":   { "stringValue": "<uuid stored on watch>" },
    "sourceKind": { "stringValue": "garmin" },
    "createdAt":  { "timestampValue": "<RFC3339 timestamp>" }
  }
}
```

The `createdAt` field must be a real timestamp. The Firestore REST API accepts client-provided timestamps; it does not enforce `request.time` equality unless the rules do. The current rules require `request.resource.data.createdAt == request.time` — this must be relaxed to `request.resource.data.createdAt is timestamp` for unauthenticated creates only, since the watch cannot use `serverTimestamp()`.

> **Note:** Ordering of commands in `firestoreRemoteService.ts` uses `orderBy('createdAt', 'asc')`. Client-provided timestamps are accurate enough for this purpose given that commands arrive sequentially from a single watch.

### Watch UI and Button Mapping

The Forerunner 265 has a 5-button layout:
- **UP** (top-right) — Team A point
- **DOWN** (bottom-right) — Team B point
- **BACK** (top-left) — Undo (hold to confirm, to avoid accidental triggers)
- **START/STOP** (middle-right) — reserved / confirm on setup screens

Screens:

1. **Room Code Entry** — scroll wheel + confirm to enter a 4-character code. Last used code is pre-filled from device storage.
2. **Active Remote** — shows the room code and three action areas (Team A / Undo / Team B). Button labels match physical positions. Pending indicator while HTTP in flight.
3. **Error Screen** — HTTP failure message with retry option.

### Connect IQ App Structure

```
GarminRemote/
  manifest.xml          — app metadata, permissions (Communications, Vibration)
  source/
    GarminRemoteApp.mc  — app entry point
    RoomCodeView.mc     — code entry screen
    RemoteView.mc       — active remote screen
    FirestoreClient.mc  — Firestore REST POST logic
    Storage.mc          — persist room code and sourceId to device storage
```

The `sourceId` is a UUID generated once on first launch and stored permanently. It identifies the watch as a controller in command documents.

### Pairing Flow

1. User starts watch remote on the tablet (existing UI — generates a 4-char room code).
2. User opens the Garmin app on the watch, enters the room code.
3. Watch stores the code and enters the Active Remote screen.
4. Button presses fire HTTP POSTs through Garmin Connect on the paired phone.

## What Changes

| File | Change |
|---|---|
| `firestore.rules` | Remove `isNamedSignedIn()` from command `allow create`; relax `createdAt` check to `is timestamp`; add `'garmin'` to `isValidSourceKind` |
| `src/remote/firestoreRemoteTypes.ts` | Add `'garmin'` to `sourceKind` union type |
| `GarminRemote/` *(new directory)* | Connect IQ watch app (Monkey C source, manifest) |
| `.specs/SPEC-INDEX.md` | Add this spec |

## What Stays the Same

- `src/remote/firestoreRemoteService.ts` — no changes; command schema is compatible.
- `src/remote/firestoreControllerService.ts` — no changes.
- All scoring engine, session, auth, and UI code — untouched.
- Firestore rules for match create/update, command update, players, pairs, globalMatches, users — all unchanged.

## Architecture Impact

`.docs/input/input-remotes.md` — add Garmin Connect IQ as a third remote type alongside Wear OS and web controller. Document the REST-based command flow and the phone-as-relay topology.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| BLE direct (watch → tablet) | Garmin watches are BLE centrals only; cannot act as a peripheral for Web Bluetooth |
| BLE HID (watch as keyboard) | Not supported by Connect IQ |
| Thin proxy Cloud Function | Adds infrastructure; REST API with relaxed rules is simpler |
| Companion Android app on phone | Adds a second app to maintain; relay through Garmin Connect is sufficient |
| Offline-only / local WiFi | Requires tablet and watch on same network; not reliable in a gym |

## Testing Strategy

- **Rules unit tests** (Firebase emulator): unauthenticated POST to `commands` succeeds with valid `garmin` payload; fails with missing fields, invalid `sourceKind`, or `appliedAt` present.
- **Manual integration**: enter room code on watch emulator (Connect IQ simulator), fire a button, verify command appears in Firestore console and scorer applies it.
- **Regression**: run existing `npm test` suite — no scoring or remote service tests should change.

## Verification

1. Deploy updated `firestore.rules` to emulator.
2. `curl` a raw Firestore REST POST mimicking the watch payload — command appears in scorer.
3. Connect IQ simulator: fire all three button actions, confirm documents in Firestore emulator UI.
4. Tablet scorer + simulator end-to-end: score increments on tablet after button press on simulator.
5. `npm test && npm run lint && npm run build` — all pass.

## Security Considerations

**Relaxing command create auth:** any client that knows a 4-character room code can write commands. Mitigations already in place:
- Room codes are 32-character alphabet, 4 chars → ~1M combinations. Short-lived (match duration).
- Field validation (`hasOnly`, enum checks, no `appliedAt`/`rejectedAt`) prevents data injection.
- The host (signed-in user) applies/rejects every command — malicious commands are rejected if the match is over or the command is invalid.
- Room documents are still host-only writes.

**`createdAt` as client timestamp:** the watch provides its own timestamp. This does not affect security — it only affects ordering, which is benign.

## Risk Analysis

| Risk | Likelihood | Mitigation |
|---|---|---|
| Garmin Connect not running on phone | Low | User briefed; app shows error if HTTP fails |
| Phone out of range of watch | Low | User keeps phone in bag on court |
| Room code brute-force spam | Very low | Short match duration; host rejects invalid commands |
| Watch clock skew causes ordering issues | Low | Commands from one watch arrive sequentially; skew only matters across simultaneous controllers |

## Affected Components

- `firestore.rules` — command create rule
- `src/remote/firestoreRemoteTypes.ts` — `sourceKind` type
- New: `GarminRemote/` Connect IQ project

## Dependencies

- Existing watch remote host UI on the scorer must be active (user starts a room) before the watch can connect. No changes to that flow.

## Reviewer Context

Connect IQ (Monkey C) is Garmin's proprietary SDK. The language is Java-like. `Communications.makeWebRequest()` is the standard HTTP call; it routes through the Garmin Connect companion app on the paired phone when WiFi is unavailable. The Connect IQ simulator can be used for development without a physical watch.
