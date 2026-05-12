# Wear OS Firebase Remote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the web-side Firebase/Firestore host for a future Wear OS remote, while preserving the current offline scorer behavior unless a watch room is explicitly started.

**Architecture:** The existing web app remains the scoring authority. Firestore stores one match document per short room code and a command subcollection; the web app publishes `MatchState`, listens for pending remote commands, applies them through the existing reducer/speech path, and marks commands applied or rejected. Firebase setup is lazy so normal scoring has no Firebase or internet requirement.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Firebase Web SDK Firestore, existing match engine and command reducer.

---

## File Structure

- Create `src/firebase.ts`: lazy Firebase app/Firestore initialization with the provided config and emulator support.
- Create `src/remote/firestoreRemoteTypes.ts`: Firestore match document, command document, host status, and command-result types.
- Create `src/remote/firestoreRemoteService.ts`: room code generation, room create/end, state publish, command subscribe, command mark applied/rejected, host heartbeat.
- Create `src/remote/firestoreRemoteService.test.ts`: unit tests for code generation and service behavior with mocked Firestore functions.
- Create `src/hooks/useWatchRemoteHost.ts`: React hook that starts/stops hosting, restores active rooms, publishes match state, consumes commands, and preserves offline behavior.
- Create `src/hooks/useWatchRemoteHost.test.tsx`: hook tests for no-op offline default, start/end hosting, command application, and Firebase failure isolation.
- Create `src/components/WatchRemotePanel.tsx`: UI panel for starting remote hosting, showing room code/status, ending hosting, and command errors.
- Create `src/components/WatchRemotePanel.test.tsx`: component tests for inactive, active, and error states.
- Modify `src/App.tsx`: wire the hook and panel into the app without changing normal scoring behavior.
- Modify `src/styles.css`: add compact styles for the watch remote panel.
- Modify `package.json` / lockfile: add `firebase`.
- Optionally create `firestore.rules`, `firebase.json`, and `firestore.indexes.json` for emulator/development parity with Wavelength.

## Task 1: Firebase Setup And Remote Types

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/firebase.ts`
- Create: `src/remote/firestoreRemoteTypes.ts`

- [ ] **Step 1: Install Firebase**

Run:

```bash
npm install firebase
```

Expected: `package.json` and `package-lock.json` include `firebase`.

- [ ] **Step 2: Create Firebase lazy initializer**

Add `src/firebase.ts`:

```ts
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD-Y-VmelbcTKMyTRrXfZ5fJEjVlRoatP4',
  authDomain: 'badminton-scorer-91f7d.firebaseapp.com',
  projectId: 'badminton-scorer-91f7d',
  storageBucket: 'badminton-scorer-91f7d.firebasestorage.app',
  messagingSenderId: '441715859789',
  appId: '1:441715859789:web:8d5fc38272d044f5971704',
  measurementId: 'G-KDNY0RS6JK',
};

let firestore: Firestore | undefined;
let emulatorConnected = false;

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
}

export function getFirebaseDb(): Firestore {
  if (firestore === undefined) {
    firestore = getFirestore(getFirebaseApp());
    connectEmulatorIfConfigured(firestore);
  }

  return firestore;
}

function connectEmulatorIfConfigured(db: Firestore): void {
  if (emulatorConnected || import.meta.env.VITE_USE_FIRESTORE_EMULATOR !== 'true') {
    return;
  }

  const host = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST ?? 'localhost';
  const port = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT ?? '8080');
  connectFirestoreEmulator(db, host, port);
  emulatorConnected = true;
}
```

- [ ] **Step 3: Create remote types**

Add `src/remote/firestoreRemoteTypes.ts`:

```ts
import type { MatchMode, MatchState, TeamId } from '../domain/matchTypes';

export type WatchRemoteHostStatus = 'inactive' | 'starting' | 'active' | 'stopping' | 'error';

export type WatchRemoteCommandType = 'POINT_TEAM' | 'UNDO' | 'ANNOUNCE';

export interface WatchRemoteMatchDocument {
  readonly code: string;
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
  readonly active: boolean;
  readonly hostId: string;
  readonly hostHeartbeatAt: unknown;
  readonly matchState: MatchState;
  readonly matchMode: MatchMode;
  readonly winnerTeamId?: TeamId;
  readonly lastAppliedCommandId?: string;
}

export interface WatchRemoteCommandDocument {
  readonly type: WatchRemoteCommandType;
  readonly teamId?: TeamId;
  readonly sourceId: string;
  readonly sourceKind: 'wear' | 'web';
  readonly createdAt: unknown;
  readonly appliedAt?: unknown;
  readonly rejectedAt?: unknown;
  readonly rejectionReason?: string;
}

export interface PendingWatchRemoteCommand {
  readonly id: string;
  readonly command: WatchRemoteCommandDocument;
}

export interface WatchRemoteSnapshot {
  readonly code: string;
  readonly active: boolean;
  readonly hostId: string;
  readonly matchState: MatchState;
}
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run lint
```

Expected: TypeScript exits 0.

## Task 2: Firestore Remote Service

**Files:**
- Create: `src/remote/firestoreRemoteService.ts`
- Create: `src/remote/firestoreRemoteService.test.ts`

- [ ] **Step 1: Write failing tests for room code generation and Firestore calls**

Add tests that verify:

- `createRoomCode()` returns a 4-character uppercase code without ambiguous characters.
- `createWatchRemoteRoom()` writes `matches/{code}` with active state and serialized match fields.
- `subscribeToPendingCommands()` filters out applied/rejected commands.

Run:

```bash
npm test -- src/remote/firestoreRemoteService.test.ts
```

Expected: FAIL because the service does not exist yet.

- [ ] **Step 2: Implement service**

Implement:

```ts
export function createRoomCode(): string
export async function createWatchRemoteRoom(options: { match: MatchState; hostId: string; db?: Firestore }): Promise<string>
export async function publishWatchRemoteState(options: { code: string; match: MatchState; hostId: string; db?: Firestore }): Promise<void>
export function subscribeToPendingCommands(options: { code: string; onCommands: (commands: PendingWatchRemoteCommand[]) => void; onError: (error: Error) => void; db?: Firestore }): () => void
export async function markCommandApplied(options: { code: string; commandId: string; match: MatchState; db?: Firestore }): Promise<void>
export async function markCommandRejected(options: { code: string; commandId: string; reason: string; db?: Firestore }): Promise<void>
export async function updateHostHeartbeat(options: { code: string; db?: Firestore }): Promise<void>
export async function endWatchRemoteRoom(options: { code: string; db?: Firestore }): Promise<void>
```

Use Firestore modular APIs: `collection`, `doc`, `query`, `where`, `orderBy`, `setDoc`, `updateDoc`, `onSnapshot`, `serverTimestamp`.

- [ ] **Step 3: Verify service tests**

Run:

```bash
npm test -- src/remote/firestoreRemoteService.test.ts
```

Expected: PASS.

## Task 3: Watch Remote Host Hook

**Files:**
- Create: `src/hooks/useWatchRemoteHost.ts`
- Create: `src/hooks/useWatchRemoteHost.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Add tests that verify:

- Initial hook state is inactive and does not call Firebase.
- `start()` creates a room and publishes active status.
- Incoming `POINT_TEAM` command calls `dispatch({ type: 'POINT_TEAM', teamId })`.
- Incoming `UNDO` command calls `dispatch({ type: 'UNDO' })`.
- Incoming `ANNOUNCE` command calls the provided announce callback.
- A failed `start()` surfaces an error but does not throw.

Run:

```bash
npm test -- src/hooks/useWatchRemoteHost.test.tsx
```

Expected: FAIL because the hook does not exist yet.

- [ ] **Step 2: Implement hook**

The hook signature should be:

```ts
export function useWatchRemoteHost(options: {
  readonly match: MatchState;
  readonly dispatch: (command: AppCommand) => void;
  readonly announce: () => void;
  readonly service?: WatchRemoteService;
}): {
  readonly status: WatchRemoteHostStatus;
  readonly code?: string;
  readonly error?: string;
  readonly lastCommandLabel?: string;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
}
```

Store the active code in `window.localStorage` under `badminton-scorer-watch-remote-room`. Do not call the service until `start()` or restore logic needs it.

- [ ] **Step 3: Verify hook tests**

Run:

```bash
npm test -- src/hooks/useWatchRemoteHost.test.tsx
```

Expected: PASS.

## Task 4: Watch Remote Panel UI

**Files:**
- Create: `src/components/WatchRemotePanel.tsx`
- Create: `src/components/WatchRemotePanel.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing component tests**

Verify:

- Inactive panel renders a `Start watch remote` button.
- Active panel shows the code and an `End remote` button.
- Error state displays the error text without hiding local controls.

Run:

```bash
npm test -- src/components/WatchRemotePanel.test.tsx
```

Expected: FAIL because the component does not exist yet.

- [ ] **Step 2: Implement component**

Use props:

```ts
interface WatchRemotePanelProps {
  readonly status: WatchRemoteHostStatus;
  readonly code?: string;
  readonly error?: string;
  readonly lastCommandLabel?: string;
  readonly onStart: () => void;
  readonly onStop: () => void;
}
```

Render a compact panel suitable for the existing app layout.

- [ ] **Step 3: Add CSS**

Add `.watch-remote-panel`, `.watch-remote-code`, and related classes without changing existing controls.

- [ ] **Step 4: Verify component tests**

Run:

```bash
npm test -- src/components/WatchRemotePanel.test.tsx
```

Expected: PASS.

## Task 5: App Integration And Offline Preservation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing integration tests**

Add tests that verify:

- The app renders and scores normally without starting watch remote hosting.
- Firebase service methods are not invoked before the user starts watch remote hosting.
- Starting watch remote hosting shows a room code when the hook reports active.

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL until integration is added.

- [ ] **Step 2: Wire hook and panel into `App.tsx`**

Import `WatchRemotePanel` and `useWatchRemoteHost`. Pass current `match`, existing `dispatch`, and `() => speakAnnouncement(match)`. Place the panel near the existing status/remote diagnostics area.

- [ ] **Step 3: Verify app tests**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS.

## Task 6: Firebase Emulator Config And Docs

**Files:**
- Create: `firebase.json`
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Modify: `README.md`

- [ ] **Step 1: Add emulator config**

Create Firestore emulator config similar to Wavelength. Development rules can be permissive with a comment that production rules must be tightened.

- [ ] **Step 2: Document Firebase behavior**

Update README with:

- Firebase is only required for watch remote hosting.
- Normal scoring remains offline-capable.
- Required env vars for emulator use.
- Commands to run emulator and app.

- [ ] **Step 3: Verify docs and config syntax**

Run:

```bash
node --check public/sw.js
npm run lint
```

Expected: both commands exit 0.

## Task 7: Full Verification

**Files:**
- No new files unless prior tasks require small fixes.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm test -- src/remote/firestoreRemoteService.test.ts src/hooks/useWatchRemoteHost.test.tsx src/components/WatchRemotePanel.test.tsx src/App.test.tsx
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
node --check public/sw.js
```

Expected: all commands exit 0.

- [ ] **Step 3: Review git diff**

Run:

```bash
git diff -- src package.json package-lock.json README.md firebase.json firestore.rules firestore.indexes.json docs/superpowers/specs docs/superpowers/plans
```

Expected: diff contains only Firebase remote host, docs, and plan/spec changes.
