# Wear OS Firebase Remote Design

Date: 2026-05-11

## Goal

Add a Firebase-backed remote control and display path so a Google Wear OS app can control and mirror the existing web scorer. The web app remains the scoring authority for v1; the watch sends commands and displays the latest state.

The existing scorer behavior must remain unchanged unless the user explicitly starts watch remote hosting. Without an active match room, the app must not require Firebase, internet connectivity, or any cloud service to score matches, persist local state, use local controls, or use existing local/browser remote input paths.

## Reference Pattern

Use the Firestore room-code pattern from `/Users/arthur/Documents/Projects/wavelength`:

- Central Firebase setup module.
- One public state document per room code.
- Realtime UI updates through document listeners.
- Service modules own all Firestore reads and writes.
- Firebase emulator support for local development.

## Firebase Project

Use this Firebase web configuration for the badminton scorer project:

```ts
const firebaseConfig = {
  apiKey: "AIzaSyD-Y-VmelbcTKMyTRrXfZ5fJEjVlRoatP4",
  authDomain: "badminton-scorer-91f7d.web.app",
  projectId: "badminton-scorer-91f7d",
  storageBucket: "badminton-scorer-91f7d.firebasestorage.app",
  messagingSenderId: "441715859789",
  appId: "1:441715859789:web:8d5fc38272d044f5971704",
  measurementId: "G-KDNY0RS6JK"
};
```

The Wear OS app should use the corresponding Android app configuration from the same Firebase project.

## Architecture

Firestore acts as the relay between the existing web app and a native Wear OS app.

```text
Web App
  create match room
  publish MatchState
  listen for commands
  apply command with existing reducer
  publish next MatchState

Firestore
  matches/{code}
  matches/{code}/commands/{commandId}

Wear OS App
  join by code
  display latest MatchState
  write command docs
```

The web app is the only client that applies badminton scoring rules in v1. The Wear OS app does not port or duplicate the scoring engine.

Firestore is only used while a watch remote match room is active. Normal match mode, session mode, browser persistence, speech announcements, Web Bluetooth, keyboard remote input, and gamepad remote input continue to work without network access.

## Pairing

The web app creates a short 4-6 character room code when the user starts watch remote hosting. The Wear OS app joins by entering that code with the watch keyboard or voice input.

QR pairing is out of scope for v1 because the watch does not have a camera. A future phone companion or deep link can help transfer the code to the watch, but the core v1 flow should work with manual code entry.

## Firestore Model

Use one match document plus a command subcollection.

```text
matches/{code}
  code: string
  createdAt: serverTimestamp
  updatedAt: serverTimestamp
  active: boolean
  hostId: string
  hostHeartbeatAt: serverTimestamp
  matchState: serialized MatchState
  matchMode: "singles" | "doubles"
  winnerTeamId?: "teamA" | "teamB"
  lastAppliedCommandId?: string
```

```text
matches/{code}/commands/{commandId}
  type: "POINT_TEAM" | "UNDO" | "ANNOUNCE"
  teamId?: "teamA" | "teamB"
  sourceId: string
  sourceKind: "wear" | "web"
  createdAt: serverTimestamp
  appliedAt?: serverTimestamp
  rejectedAt?: serverTimestamp
  rejectionReason?: string
```

The watch treats commands as append-only. The web host marks each command as applied or rejected.

## Command Processing

The web app listens for commands under the hosted match where `appliedAt` and `rejectedAt` are absent. It orders them by `createdAt` and processes them one at a time.

Supported v1 commands:

- `POINT_TEAM` with `teamId`.
- `UNDO`.
- `ANNOUNCE`.

`POINT_TEAM` and `UNDO` flow through the existing command/reducer path. `ANNOUNCE` triggers the existing web speech path on the host device. The watch should not speak scores in v1 unless a later design explicitly adds native watch text-to-speech.

The host serializes execution, writes the next `matchState`, and updates `lastAppliedCommandId`. If a command cannot be applied, the host writes `rejectedAt` and `rejectionReason`.

## Web App Changes

Add Firebase support and a watch remote host layer:

- `src/firebase.ts` initializes Firebase and supports the Firestore emulator.
- `package.json` exposes `npm run emulator` as a local shortcut for `npx -y firebase-tools@latest emulators:start --only firestore,auth`, so a global Firebase CLI install is not required.
- `src/remote/firestoreRemoteService.ts` creates rooms, publishes state, subscribes to commands, marks commands, and ends rooms.
- `src/hooks/useWatchRemoteHost.ts` or an equivalent app-level hook connects Firestore to the current match state and `dispatch`.

Add a small UI panel:

- Inactive state: "Start watch remote".
- Active state: show room code, host status, latest sync time, and "End remote".
- Optional diagnostics: latest command, connected source count, and command errors.

Behavior:

- Firebase initialization and Firestore listeners are only needed when the user starts or restores watch remote hosting.
- Starting remote hosting publishes the current match.
- Every local score change publishes the new match state.
- Remote commands use the same `dispatch({ type: ... })` path as local controls.
- Ending remote hosting sets `active: false`.
- A reload can restore the hosted room from browser storage and resume command processing if the room is still active.
- If Firebase is unavailable and no room is active, the app should not surface an error and should behave like the current offline-capable app.
- If Firebase is unavailable while starting or restoring a room, only the watch remote panel should show the connection error; scoring must continue locally.

## Wear OS App Scope

Build a native Wear OS app using Firebase Android SDK and Compose for Wear OS.

Screens:

- Join screen for entering the room code.
- Remote screen showing Team A score, Team B score, serving team, server, receiver, and match-over state.
- Large controls for Team A point and Team B point.
- Smaller controls for Undo and Announce.
- Connection state for joining, connected, host inactive/offline, match ended, command pending, and command failed.

Behavior:

- Subscribe to `matches/{code}`.
- Render the latest `matchState`.
- Create command docs in `matches/{code}/commands`.
- Disable score controls when `active === false` or `winnerTeamId` is set.
- Store the last joined code locally for quick reconnect.
- Do not edit player names, start sessions, configure first server, or run session scheduling in v1.

## Failure Handling

- If the watch is offline, it shows the last known score and disables command buttons.
- If Firestore accepts a command but the web host is inactive, the command remains pending until the host returns or rejects it.
- If the match has ended, the web host rejects new `POINT_TEAM` commands.
- If duplicate commands arrive, the web host ignores already applied command IDs.
- If command processing fails, the host writes `rejectedAt` and `rejectionReason`.
- If the host tab closes, `hostHeartbeatAt` stops updating and the watch shows "Host offline".
- Only the web host writes `matchState`; watches write only command documents.

## Security Rules

Development can start with permissive Firestore rules, matching the Wavelength development pattern.

Before deployment:

- Require named, non-anonymous Firebase clients.
- Allow clients to read active match documents by code.
- Allow clients to create command documents.
- Prevent watches from updating `matchState`, `active`, `appliedAt`, `rejectedAt`, and `rejectionReason`.
- Restrict host-only writes to the current host identity.

## Testing

- Keep existing scoring tests as the scoring rule contract.
- Unit-test Firestore service functions with mocked Firebase calls where practical.
- Integration-test web command processing against the Firebase emulator.
- Manually test the command queue before the Wear OS app exists by using one browser tab as host and another script/tab to write command docs.
- Verify reload recovery: the host resumes command processing after a page refresh.
- Verify stale-host behavior: the watch shows host offline after heartbeat updates stop.

## Out Of Scope For V1

- Kotlin port of the scoring engine.
- Watch-owned scoring.
- Native Android phone companion.
- QR pairing.
- Wear Data Layer sync.
- Player/session setup on watch.
- Production-grade security rules beyond the first deployable tightening pass.
