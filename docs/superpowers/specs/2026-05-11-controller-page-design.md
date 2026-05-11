# Controller Page Design

Date: 2026-05-11

## Goal

Add a `/controller` route to the existing web app that acts as a browser-based simulator for the future Wear OS remote. It joins a Firestore room by code, displays live match state, and sends scoring commands — replicating what the watch app will eventually do natively.

## Constraints

- No changes to `App.tsx` or the existing scorer behavior
- Must work with the Firestore emulator (`VITE_USE_FIRESTORE_EMULATOR=true`)
- Uses `sourceKind: 'web'` on all commands (not `'wear'`)
- Offline scorer at `/` must be unaffected by this addition

## Routing

Install `react-router-dom`. Modify `main.tsx` to wrap the app in `<BrowserRouter>` with two routes:

- `/` → `<App>` (existing scorer, unchanged)
- `/controller` → `<ControllerPage>`

## File Structure

**New files:**
- `src/remote/firestoreControllerService.ts` — Firestore reads and command writes for the controller client
- `src/remote/firestoreControllerService.test.ts` — unit tests with mocked Firestore
- `src/hooks/useControllerClient.ts` — React hook managing controller state
- `src/hooks/useControllerClient.test.tsx` — hook tests
- `src/pages/ControllerPage.tsx` — page component
- `src/pages/ControllerPage.test.tsx` — component tests

**Modified files:**
- `main.tsx` — add `BrowserRouter` and routes
- `src/styles.css` — append controller CSS classes
- `package.json` / lockfile — add `react-router-dom`

## Firestore Service (`firestoreControllerService.ts`)

Two exported functions:

```ts
export function subscribeToRoomState(options: {
  code: string;
  onState: (doc: WatchRemoteMatchDocument) => void;
  onError: (error: Error) => void;
  db?: Firestore;
}): () => void
```

- Calls `onSnapshot` on `matches/{code}`
- If the document does not exist or `active === false`, calls `onError` with a descriptive message
- Returns the unsubscribe function

```ts
export async function sendControllerCommand(options: {
  code: string;
  type: WatchRemoteCommandType;
  teamId?: TeamId;
  sourceId: string;
  db?: Firestore;
}): Promise<void>
```

- Writes to `matches/{code}/commands/{crypto.randomUUID()}`
- Fields: `type`, `teamId` (only for `POINT_TEAM`), `sourceId`, `sourceKind: 'web'`, `createdAt: serverTimestamp()`

Uses the same `db` injection pattern as `firestoreRemoteService.ts`.

## Hook (`useControllerClient.ts`)

```ts
export function useControllerClient(): {
  readonly status: 'disconnected' | 'joining' | 'active' | 'error';
  readonly matchDoc?: WatchRemoteMatchDocument;
  readonly error?: string;
  readonly commandError?: string;
  readonly lastCode: string;
  readonly join: (code: string) => Promise<void>;
  readonly leave: () => void;
  readonly sendCommand: (type: WatchRemoteCommandType, teamId?: TeamId) => Promise<void>;
}
```

- `lastCode` is read from and written to `localStorage` under key `'badminton-scorer-controller-code'` — pre-fills the input on revisit
- `join(code)` sets status to `'joining'`, subscribes to room state; on first valid snapshot sets status to `'active'`; on error sets status to `'error'`
- `leave()` unsubscribes, clears `matchDoc`, sets status to `'disconnected'`
- `sendCommand` calls `sendControllerCommand` with the current code and a stable `sourceId` (generated once via `crypto.randomUUID()` and persisted in `localStorage` under `'badminton-scorer-controller-id'`)
- No Firebase calls until `join()` is explicitly called

## Page Component (`ControllerPage.tsx`)

Three render states based on `status`:

**Disconnected:**
- Heading: "Controller"
- Text input labeled "Room code" (pre-filled with `lastCode`)
- Join button (disabled while input is empty)
- Link back to `/` scorer

**Active:**
- Room code shown as subtitle
- Score display: Team A name + score vs Team B name + score
- Serving indicator (which team / player is serving)
- Four command buttons: "Point [Team A name]", "Point [Team B name]", "Undo", "Announce"
- Leave button

**Error:**
- Error message
- Back button (calls `leave()`, returns to disconnected state)

Styles use the `.controller-*` CSS class namespace, appended to `styles.css`.

## Data Flow

```
ControllerPage
  → useControllerClient
    → firestoreControllerService.subscribeToRoomState   (reads matches/{code})
    → firestoreControllerService.sendControllerCommand  (writes matches/{code}/commands/{id})
  ← matchDoc (live WatchRemoteMatchDocument)

Firestore
  ← host (useWatchRemoteHost) publishes MatchState
  → controller reads and displays it
  ← controller writes commands
  → host applies commands and publishes next MatchState
```

## Error Handling

- Room not found → `onError` with "Room not found"
- Room inactive (host ended it) → `onError` with "Room is no longer active"
- Firestore connection error → `onError` with the error message
- `sendCommand` failures are exposed via `commandError` and shown as a transient message below the buttons (status stays `'active'`)

## Testing

- `firestoreControllerService.test.ts` — mock Firestore; verify `onSnapshot` call, `onError` on missing/inactive room, `setDoc` payload for each command type
- `useControllerClient.test.tsx` — mock service; verify: initial state disconnected, `join()` transitions to active, snapshot error transitions to error, `leave()` unsubscribes and resets, `sendCommand` delegates to service, `lastCode` persisted to localStorage
- `ControllerPage.test.tsx` — mock hook; verify: disconnected renders code input + join button, active renders score + 4 command buttons + leave, error renders message + back button

## Out of Scope

- QR code generation/scanning
- Watch-specific UI chrome (round screen, watch bezel)
- Authentication or access control on rooms
- Command history or acknowledgement display beyond current status
