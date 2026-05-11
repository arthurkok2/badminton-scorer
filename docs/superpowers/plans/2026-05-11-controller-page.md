# Controller Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/controller` route to the web app that acts as a browser-based remote control — joins a Firestore room by code, displays live match state, and sends scoring commands.

**Architecture:** React Router handles routing in `main.tsx`. A new `firestoreControllerService.ts` handles Firestore reads/writes. A `useControllerClient` hook manages state. `ControllerPage.tsx` renders the three UI states (disconnected, active, error). All styling reuses existing CSS patterns.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, react-router-dom, Firebase Web SDK Firestore

**Branch:** `codex/explore-wear-os-support`

---

## File Structure

- Modify: `package.json` / lockfile — add `react-router-dom`
- Modify: `src/main.tsx` — wrap in `BrowserRouter`, add routes
- Create: `src/pages/ControllerPage.tsx` — page component (three states)
- Create: `src/pages/ControllerPage.test.tsx` — component tests
- Create: `src/remote/firestoreControllerService.ts` — `subscribeToRoomState`, `sendControllerCommand`
- Create: `src/remote/firestoreControllerService.test.ts` — service unit tests
- Create: `src/hooks/useControllerClient.ts` — state hook
- Create: `src/hooks/useControllerClient.test.tsx` — hook tests
- Modify: `src/styles.css` — append `.controller-*` classes

---

## Task 1: Install React Router And Set Up Routing

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `src/main.tsx`
- Create: `src/pages/ControllerPage.tsx` (stub)

- [ ] **Step 1: Install react-router-dom**

```bash
npm install react-router-dom
```

Expected: `package.json` gains `"react-router-dom"` dependency.

- [ ] **Step 2: Create stub ControllerPage**

Create `src/pages/ControllerPage.tsx`:

```tsx
export function ControllerPage() {
  return (
    <main>
      <h1>Controller</h1>
    </main>
  );
}
```

- [ ] **Step 3: Update main.tsx**

Replace the full contents of `src/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import { ControllerPage } from './pages/ControllerPage';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/controller" element={<ControllerPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
```

- [ ] **Step 4: Run lint and existing tests**

```bash
npm run lint
npm test -- src/App.test.tsx
```

Expected: lint exits 0, all App tests pass. (App renders directly without router — no change needed.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/main.tsx src/pages/ControllerPage.tsx
git commit -m "feat: add react-router-dom and /controller route stub"
```

---

## Task 2: Firestore Controller Service

**Files:**
- Create: `src/remote/firestoreControllerService.ts`
- Create: `src/remote/firestoreControllerService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/remote/firestoreControllerService.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((parent: unknown, path: string) => ({ kind: 'collection', parent, path })),
  doc: vi.fn((parent: unknown, id: string) => ({ kind: 'doc', parent, id })),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
}));

vi.mock('firebase/firestore', () => firestoreMocks);

describe('firestoreControllerService', () => {
  const db = { kind: 'firestore' } as unknown as Firestore;

  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.serverTimestamp.mockReturnValue({ kind: 'serverTimestamp' });
  });

  it('subscribeToRoomState subscribes to the matches/{code} document', async () => {
    const { subscribeToRoomState } = await import('./firestoreControllerService');
    const onState = vi.fn();
    const onError = vi.fn();
    firestoreMocks.onSnapshot.mockReturnValue(vi.fn());

    subscribeToRoomState({ code: 'ABCD', onState, onError, db });

    expect(firestoreMocks.collection).toHaveBeenCalledWith(db, 'matches');
    expect(firestoreMocks.doc).toHaveBeenCalledWith(
      { kind: 'collection', parent: db, path: 'matches' },
      'ABCD',
    );
    expect(firestoreMocks.onSnapshot).toHaveBeenCalledOnce();
  });

  it('subscribeToRoomState calls onError when document does not exist', async () => {
    const { subscribeToRoomState } = await import('./firestoreControllerService');
    const onState = vi.fn();
    const onError = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation((_ref, next) => {
      next({ exists: () => false, data: () => undefined });
      return vi.fn();
    });

    subscribeToRoomState({ code: 'ABCD', onState, onError, db });

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('Room not found');
    expect(onState).not.toHaveBeenCalled();
  });

  it('subscribeToRoomState calls onError when room is inactive', async () => {
    const { subscribeToRoomState } = await import('./firestoreControllerService');
    const onState = vi.fn();
    const onError = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation((_ref, next) => {
      next({ exists: () => true, data: () => ({ active: false, code: 'ABCD' }) });
      return vi.fn();
    });

    subscribeToRoomState({ code: 'ABCD', onState, onError, db });

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].message).toBe('Room is no longer active');
    expect(onState).not.toHaveBeenCalled();
  });

  it('subscribeToRoomState calls onState with document data when room is active', async () => {
    const { subscribeToRoomState } = await import('./firestoreControllerService');
    const onState = vi.fn();
    const onError = vi.fn();
    const roomData = { active: true, code: 'ABCD', matchState: {}, matchMode: 'doubles' };
    firestoreMocks.onSnapshot.mockImplementation((_ref, next) => {
      next({ exists: () => true, data: () => roomData });
      return vi.fn();
    });

    subscribeToRoomState({ code: 'ABCD', onState, onError, db });

    expect(onState).toHaveBeenCalledWith(roomData);
    expect(onError).not.toHaveBeenCalled();
  });

  it('subscribeToRoomState forwards Firestore errors to onError as Error instances', async () => {
    const { subscribeToRoomState } = await import('./firestoreControllerService');
    const onState = vi.fn();
    const onError = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation((_ref, _next, onSnapshotError) => {
      onSnapshotError('permission denied');
      return vi.fn();
    });

    subscribeToRoomState({ code: 'ABCD', onState, onError, db });

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('permission denied');
  });

  it('subscribeToRoomState returns the unsubscribe function', async () => {
    const { subscribeToRoomState } = await import('./firestoreControllerService');
    const unsubscribe = vi.fn();
    firestoreMocks.onSnapshot.mockReturnValue(unsubscribe);

    const stop = subscribeToRoomState({ code: 'ABCD', onState: vi.fn(), onError: vi.fn(), db });
    stop();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('sendControllerCommand writes a POINT_TEAM command with teamId', async () => {
    const { sendControllerCommand } = await import('./firestoreControllerService');
    firestoreMocks.setDoc.mockResolvedValue(undefined);

    await sendControllerCommand({ code: 'ABCD', type: 'POINT_TEAM', teamId: 'teamA', sourceId: 'src-1', db });

    expect(firestoreMocks.setDoc).toHaveBeenCalledOnce();
    const payload = firestoreMocks.setDoc.mock.calls[0][1];
    expect(payload).toMatchObject({
      type: 'POINT_TEAM',
      teamId: 'teamA',
      sourceId: 'src-1',
      sourceKind: 'web',
      createdAt: { kind: 'serverTimestamp' },
    });
  });

  it('sendControllerCommand writes an UNDO command without teamId', async () => {
    const { sendControllerCommand } = await import('./firestoreControllerService');
    firestoreMocks.setDoc.mockResolvedValue(undefined);

    await sendControllerCommand({ code: 'ABCD', type: 'UNDO', sourceId: 'src-1', db });

    const payload = firestoreMocks.setDoc.mock.calls[0][1];
    expect(payload).toMatchObject({ type: 'UNDO', sourceKind: 'web' });
    expect(payload).not.toHaveProperty('teamId');
  });

  it('sendControllerCommand writes an ANNOUNCE command without teamId', async () => {
    const { sendControllerCommand } = await import('./firestoreControllerService');
    firestoreMocks.setDoc.mockResolvedValue(undefined);

    await sendControllerCommand({ code: 'ABCD', type: 'ANNOUNCE', sourceId: 'src-1', db });

    const payload = firestoreMocks.setDoc.mock.calls[0][1];
    expect(payload).toMatchObject({ type: 'ANNOUNCE', sourceKind: 'web' });
    expect(payload).not.toHaveProperty('teamId');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- src/remote/firestoreControllerService.test.ts
```

Expected: FAIL — `Cannot find module './firestoreControllerService'`

- [ ] **Step 3: Implement the service**

Create `src/remote/firestoreControllerService.ts`:

```ts
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseDb } from '../firebase';
import type { TeamId } from '../domain/matchTypes';
import type { WatchRemoteCommandType, WatchRemoteMatchDocument } from './firestoreRemoteTypes';

const ROOM_COLLECTION = 'matches';
const COMMAND_COLLECTION = 'commands';

export function subscribeToRoomState(options: {
  code: string;
  onState: (roomDoc: WatchRemoteMatchDocument) => void;
  onError: (error: Error) => void;
  db?: Firestore;
}): () => void {
  const db = options.db ?? getFirebaseDb();
  const roomRef = doc(collection(db, ROOM_COLLECTION), options.code);

  return onSnapshot(
    roomRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        options.onError(new Error('Room not found'));
        return;
      }
      const data = snapshot.data() as WatchRemoteMatchDocument;
      if (!data.active) {
        options.onError(new Error('Room is no longer active'));
        return;
      }
      options.onState(data);
    },
    (error) => {
      options.onError(error instanceof Error ? error : new Error(String(error)));
    },
  );
}

export async function sendControllerCommand(options: {
  code: string;
  type: WatchRemoteCommandType;
  teamId?: TeamId;
  sourceId: string;
  db?: Firestore;
}): Promise<void> {
  const db = options.db ?? getFirebaseDb();
  const roomRef = doc(collection(db, ROOM_COLLECTION), options.code);
  const commandRef = doc(collection(roomRef, COMMAND_COLLECTION), crypto.randomUUID());

  await setDoc(commandRef, {
    type: options.type,
    ...(options.type === 'POINT_TEAM' && options.teamId !== undefined
      ? { teamId: options.teamId }
      : {}),
    sourceId: options.sourceId,
    sourceKind: 'web',
    createdAt: serverTimestamp(),
  });
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- src/remote/firestoreControllerService.test.ts
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/remote/firestoreControllerService.ts src/remote/firestoreControllerService.test.ts
git commit -m "feat: add Firestore controller service"
```

---

## Task 3: Controller Client Hook

**Files:**
- Create: `src/hooks/useControllerClient.ts`
- Create: `src/hooks/useControllerClient.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/hooks/useControllerClient.test.tsx`:

```tsx
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useControllerClient, type ControllerService } from './useControllerClient';
import type { WatchRemoteMatchDocument } from '../remote/firestoreRemoteTypes';
import { createMatch } from '../domain/matchEngine';

function makeService(overrides: Partial<ControllerService> = {}): ControllerService {
  return {
    subscribeToRoomState: vi.fn().mockReturnValue(vi.fn()),
    sendCommand: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeMatchDoc(overrides: Partial<WatchRemoteMatchDocument> = {}): WatchRemoteMatchDocument {
  return {
    code: 'ABCD',
    active: true,
    hostId: 'host-1',
    createdAt: null,
    updatedAt: null,
    hostHeartbeatAt: null,
    matchState: createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    matchMode: 'doubles',
    ...overrides,
  };
}

describe('useControllerClient', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('initial state is disconnected and no Firebase calls are made', () => {
    const service = makeService();
    const { result } = renderHook(() => useControllerClient(service));

    expect(result.current.status).toBe('disconnected');
    expect(result.current.matchDoc).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    expect(result.current.commandError).toBeUndefined();
    expect(service.subscribeToRoomState).not.toHaveBeenCalled();
  });

  it('lastCode is pre-filled from localStorage', () => {
    localStorage.setItem('badminton-scorer-controller-code', 'WXYZ');
    const { result } = renderHook(() => useControllerClient(makeService()));

    expect(result.current.lastCode).toBe('WXYZ');
  });

  it('join() sets status to joining then active on valid snapshot', async () => {
    let capturedOnState: ((doc: WatchRemoteMatchDocument) => void) | undefined;
    const service = makeService({
      subscribeToRoomState: vi.fn().mockImplementation(({ onState }) => {
        capturedOnState = onState;
        return vi.fn();
      }),
    });
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });
    expect(result.current.status).toBe('joining');

    act(() => { capturedOnState!(makeMatchDoc()); });
    expect(result.current.status).toBe('active');
    expect(result.current.matchDoc).toBeDefined();
    expect(result.current.matchDoc!.code).toBe('ABCD');
  });

  it('join() stores the code in localStorage', async () => {
    const service = makeService();
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });

    expect(localStorage.getItem('badminton-scorer-controller-code')).toBe('ABCD');
    expect(result.current.lastCode).toBe('ABCD');
  });

  it('join() sets status to error when subscription calls onError', async () => {
    let capturedOnError: ((err: Error) => void) | undefined;
    const service = makeService({
      subscribeToRoomState: vi.fn().mockImplementation(({ onError }) => {
        capturedOnError = onError;
        return vi.fn();
      }),
    });
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });
    act(() => { capturedOnError!(new Error('Room not found')); });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Room not found');
  });

  it('leave() unsubscribes, clears state, and resets to disconnected', async () => {
    const unsubscribe = vi.fn();
    let capturedOnState: ((doc: WatchRemoteMatchDocument) => void) | undefined;
    const service = makeService({
      subscribeToRoomState: vi.fn().mockImplementation(({ onState }) => {
        capturedOnState = onState;
        return unsubscribe;
      }),
    });
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });
    act(() => { capturedOnState!(makeMatchDoc()); });
    expect(result.current.status).toBe('active');

    act(() => { result.current.leave(); });

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('disconnected');
    expect(result.current.matchDoc).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it('sendCommand calls the service with the current code and type', async () => {
    let capturedOnState: ((doc: WatchRemoteMatchDocument) => void) | undefined;
    const service = makeService({
      subscribeToRoomState: vi.fn().mockImplementation(({ onState }) => {
        capturedOnState = onState;
        return vi.fn();
      }),
    });
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });
    act(() => { capturedOnState!(makeMatchDoc()); });
    await act(async () => { await result.current.sendCommand('POINT_TEAM', 'teamA'); });

    expect(service.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ABCD', type: 'POINT_TEAM', teamId: 'teamA' }),
    );
  });

  it('sendCommand sets commandError when the service throws', async () => {
    let capturedOnState: ((doc: WatchRemoteMatchDocument) => void) | undefined;
    const service = makeService({
      subscribeToRoomState: vi.fn().mockImplementation(({ onState }) => {
        capturedOnState = onState;
        return vi.fn();
      }),
      sendCommand: vi.fn().mockRejectedValue(new Error('write failed')),
    });
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('ABCD'); });
    act(() => { capturedOnState!(makeMatchDoc()); });
    await act(async () => { await result.current.sendCommand('UNDO'); });

    expect(result.current.commandError).toBe('write failed');
    expect(result.current.status).toBe('active');
  });

  it('join() normalises code to uppercase', async () => {
    const service = makeService();
    const { result } = renderHook(() => useControllerClient(service));

    await act(async () => { result.current.join('abcd'); });

    expect(service.subscribeToRoomState).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ABCD' }),
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- src/hooks/useControllerClient.test.tsx
```

Expected: FAIL — `Cannot find module './useControllerClient'`

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useControllerClient.ts`:

```ts
import { useCallback, useRef, useState } from 'react';
import type { TeamId } from '../domain/matchTypes';
import type { WatchRemoteCommandType, WatchRemoteMatchDocument } from '../remote/firestoreRemoteTypes';
import { subscribeToRoomState, sendControllerCommand } from '../remote/firestoreControllerService';

const CODE_KEY = 'badminton-scorer-controller-code';
const SOURCE_ID_KEY = 'badminton-scorer-controller-id';

function getOrCreateSourceId(): string {
  const existing = localStorage.getItem(SOURCE_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(SOURCE_ID_KEY, id);
  return id;
}

export interface ControllerService {
  subscribeToRoomState: (options: {
    code: string;
    onState: (roomDoc: WatchRemoteMatchDocument) => void;
    onError: (error: Error) => void;
  }) => () => void;
  sendCommand: (options: {
    code: string;
    type: WatchRemoteCommandType;
    teamId?: TeamId;
    sourceId: string;
  }) => Promise<void>;
}

const defaultService: ControllerService = {
  subscribeToRoomState: ({ code, onState, onError }) =>
    subscribeToRoomState({ code, onState, onError }),
  sendCommand: ({ code, type, teamId, sourceId }) =>
    sendControllerCommand({ code, type, teamId, sourceId }),
};

type ControllerStatus = 'disconnected' | 'joining' | 'active' | 'error';

export function useControllerClient(service: ControllerService = defaultService): {
  readonly status: ControllerStatus;
  readonly matchDoc: WatchRemoteMatchDocument | undefined;
  readonly error: string | undefined;
  readonly commandError: string | undefined;
  readonly lastCode: string;
  readonly join: (code: string) => void;
  readonly leave: () => void;
  readonly sendCommand: (type: WatchRemoteCommandType, teamId?: TeamId) => Promise<void>;
} {
  const [status, setStatus] = useState<ControllerStatus>('disconnected');
  const [matchDoc, setMatchDoc] = useState<WatchRemoteMatchDocument | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [commandError, setCommandError] = useState<string | undefined>(undefined);
  const [lastCode, setLastCode] = useState<string>(() => localStorage.getItem(CODE_KEY) ?? '');

  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);
  const codeRef = useRef<string>('');
  const sourceIdRef = useRef<string>(getOrCreateSourceId());

  const join = useCallback(
    (code: string) => {
      const normalised = code.trim().toUpperCase();
      if (!normalised) return;

      setStatus('joining');
      setError(undefined);
      setCommandError(undefined);
      codeRef.current = normalised;
      localStorage.setItem(CODE_KEY, normalised);
      setLastCode(normalised);

      unsubscribeRef.current = service.subscribeToRoomState({
        code: normalised,
        onState: (doc) => {
          setMatchDoc(doc);
          setStatus('active');
        },
        onError: (err) => {
          setStatus('error');
          setError(err.message);
          unsubscribeRef.current?.();
          unsubscribeRef.current = undefined;
        },
      });
    },
    [service],
  );

  const leave = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = undefined;
    codeRef.current = '';
    setMatchDoc(undefined);
    setError(undefined);
    setCommandError(undefined);
    setStatus('disconnected');
  }, []);

  const sendCommand = useCallback(
    async (type: WatchRemoteCommandType, teamId?: TeamId) => {
      setCommandError(undefined);
      try {
        await service.sendCommand({
          code: codeRef.current,
          type,
          teamId,
          sourceId: sourceIdRef.current,
        });
      } catch (err) {
        setCommandError(err instanceof Error ? err.message : String(err));
      }
    },
    [service],
  );

  return { status, matchDoc, error, commandError, lastCode, join, leave, sendCommand };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- src/hooks/useControllerClient.test.tsx
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useControllerClient.ts src/hooks/useControllerClient.test.tsx
git commit -m "feat: add useControllerClient hook"
```

---

## Task 4: Controller Page Component And CSS

**Files:**
- Modify: `src/pages/ControllerPage.tsx` (replace stub)
- Create: `src/pages/ControllerPage.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing tests**

Create `src/pages/ControllerPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ControllerPage } from './ControllerPage';
import type { WatchRemoteMatchDocument } from '../remote/firestoreRemoteTypes';
import { createMatch } from '../domain/matchEngine';

const mockHookState = {
  status: 'disconnected' as const,
  matchDoc: undefined,
  error: undefined,
  commandError: undefined,
  lastCode: '',
  join: vi.fn(),
  leave: vi.fn(),
  sendCommand: vi.fn(),
};

vi.mock('../hooks/useControllerClient', () => ({
  useControllerClient: vi.fn(() => mockHookState),
}));

import { useControllerClient } from '../hooks/useControllerClient';
const mockedUseControllerClient = vi.mocked(useControllerClient);

function makeActiveState(overrides: Partial<WatchRemoteMatchDocument> = {}) {
  const matchState = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
  return {
    ...mockHookState,
    status: 'active' as const,
    matchDoc: {
      code: 'ABCD',
      active: true,
      hostId: 'host-1',
      createdAt: null,
      updatedAt: null,
      hostHeartbeatAt: null,
      matchState,
      matchMode: 'doubles' as const,
      ...overrides,
    } satisfies WatchRemoteMatchDocument,
  };
}

describe('ControllerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseControllerClient.mockReturnValue(mockHookState);
  });

  describe('disconnected state', () => {
    it('renders a room code input and a Join button', () => {
      render(<ControllerPage />);

      expect(screen.getByRole('textbox', { name: /room code/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
    });

    it('pre-fills the input with lastCode from the hook', () => {
      mockedUseControllerClient.mockReturnValue({ ...mockHookState, lastCode: 'WXYZ' });
      render(<ControllerPage />);

      expect(screen.getByRole('textbox', { name: /room code/i })).toHaveValue('WXYZ');
    });

    it('calls join with the input value when Join is clicked', async () => {
      const join = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...mockHookState, join });
      render(<ControllerPage />);

      await userEvent.clear(screen.getByRole('textbox', { name: /room code/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /room code/i }), 'ABCD');
      await userEvent.click(screen.getByRole('button', { name: /join/i }));

      expect(join).toHaveBeenCalledWith('ABCD');
    });

    it('shows a Back to scorer link', () => {
      render(<ControllerPage />);

      expect(screen.getByRole('link', { name: /back to scorer/i })).toHaveAttribute('href', '/');
    });
  });

  describe('joining state', () => {
    it('disables the Join button while joining', () => {
      mockedUseControllerClient.mockReturnValue({ ...mockHookState, status: 'joining' });
      render(<ControllerPage />);

      expect(screen.getByRole('button', { name: /joining/i })).toBeDisabled();
    });
  });

  describe('active state', () => {
    it('renders team names and scores', () => {
      mockedUseControllerClient.mockReturnValue(makeActiveState());
      render(<ControllerPage />);

      expect(screen.getByText('Team A')).toBeInTheDocument();
      expect(screen.getByText('Team B')).toBeInTheDocument();
      expect(screen.getAllByText('0')).toHaveLength(2);
    });

    it('renders all four command buttons', () => {
      mockedUseControllerClient.mockReturnValue(makeActiveState());
      render(<ControllerPage />);

      expect(screen.getByRole('button', { name: /point team a/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /point team b/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /announce/i })).toBeInTheDocument();
    });

    it('calls sendCommand with POINT_TEAM and teamA when the first button is clicked', async () => {
      const sendCommand = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...makeActiveState(), sendCommand });
      render(<ControllerPage />);

      await userEvent.click(screen.getByRole('button', { name: /point team a/i }));

      expect(sendCommand).toHaveBeenCalledWith('POINT_TEAM', 'teamA');
    });

    it('calls sendCommand with UNDO when Undo is clicked', async () => {
      const sendCommand = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...makeActiveState(), sendCommand });
      render(<ControllerPage />);

      await userEvent.click(screen.getByRole('button', { name: /undo/i }));

      expect(sendCommand).toHaveBeenCalledWith('UNDO', undefined);
    });

    it('calls sendCommand with ANNOUNCE when Announce is clicked', async () => {
      const sendCommand = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...makeActiveState(), sendCommand });
      render(<ControllerPage />);

      await userEvent.click(screen.getByRole('button', { name: /announce/i }));

      expect(sendCommand).toHaveBeenCalledWith('ANNOUNCE', undefined);
    });

    it('shows a commandError when one is set', () => {
      mockedUseControllerClient.mockReturnValue({ ...makeActiveState(), commandError: 'write failed' });
      render(<ControllerPage />);

      expect(screen.getByRole('alert')).toHaveTextContent('write failed');
    });

    it('calls leave when the Leave button is clicked', async () => {
      const leave = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...makeActiveState(), leave });
      render(<ControllerPage />);

      await userEvent.click(screen.getByRole('button', { name: /leave/i }));

      expect(leave).toHaveBeenCalledOnce();
    });

    it('shows the room code', () => {
      mockedUseControllerClient.mockReturnValue(makeActiveState());
      render(<ControllerPage />);

      expect(screen.getByText('ABCD')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows the error message', () => {
      mockedUseControllerClient.mockReturnValue({ ...mockHookState, status: 'error', error: 'Room not found' });
      render(<ControllerPage />);

      expect(screen.getByRole('alert')).toHaveTextContent('Room not found');
    });

    it('calls leave when Back is clicked', async () => {
      const leave = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...mockHookState, status: 'error', error: 'Room not found', leave });
      render(<ControllerPage />);

      await userEvent.click(screen.getByRole('button', { name: /back/i }));

      expect(leave).toHaveBeenCalledOnce();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- src/pages/ControllerPage.test.tsx
```

Expected: FAIL — the stub `ControllerPage` doesn't have the required elements.

- [ ] **Step 3: Implement ControllerPage**

Replace the full contents of `src/pages/ControllerPage.tsx`:

```tsx
import { useRef } from 'react';
import { useControllerClient } from '../hooks/useControllerClient';

export function ControllerPage() {
  const { status, matchDoc, error, commandError, lastCode, join, leave, sendCommand } =
    useControllerClient();
  const codeInputRef = useRef<HTMLInputElement>(null);

  if (status === 'disconnected' || status === 'joining') {
    return (
      <main className="app-shell">
        <div className="app-layout">
          <section className="controller-panel">
            <h1 className="controller-title">Controller</h1>
            <div className="controller-join-form">
              <label htmlFor="room-code-input">Room code</label>
              <input
                id="room-code-input"
                ref={codeInputRef}
                type="text"
                defaultValue={lastCode}
                maxLength={6}
                autoCapitalize="characters"
                placeholder="e.g. ABCD"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') join((e.target as HTMLInputElement).value);
                }}
              />
              <button
                className="connect-button"
                disabled={status === 'joining'}
                onClick={() => {
                  if (codeInputRef.current) join(codeInputRef.current.value);
                }}
              >
                {status === 'joining' ? 'Joining…' : 'Join'}
              </button>
            </div>
            <a href="/" className="controller-back-link">← Back to scorer</a>
          </section>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="app-shell">
        <div className="app-layout">
          <section className="controller-panel">
            <h1 className="controller-title">Controller</h1>
            <p className="controller-error-message" role="alert">{error ?? 'An error occurred'}</p>
            <button className="connect-button" onClick={leave}>Back</button>
          </section>
        </div>
      </main>
    );
  }

  const match = matchDoc!.matchState;
  const teamAName = match.teams.teamA.name;
  const teamBName = match.teams.teamB.name;
  const isServingA = match.servingTeamId === 'teamA';

  return (
    <main className="app-shell">
      <div className="app-layout">
        <section className="controller-panel">
          <div className="controller-header">
            <h1 className="controller-title">Controller</h1>
            <span className="controller-code">{matchDoc!.code}</span>
          </div>

          <div className="controller-score">
            <div className={`controller-team${isServingA ? ' controller-team--serving' : ''}`}>
              <span className="controller-team-name">{teamAName}</span>
              <span className="controller-team-score">{match.score.teamA}</span>
              {isServingA && <span className="controller-serving-dot" aria-label="Serving" />}
            </div>
            <span className="controller-vs">vs</span>
            <div className={`controller-team${!isServingA ? ' controller-team--serving' : ''}`}>
              <span className="controller-team-name">{teamBName}</span>
              <span className="controller-team-score">{match.score.teamB}</span>
              {!isServingA && <span className="controller-serving-dot" aria-label="Serving" />}
            </div>
          </div>

          {matchDoc!.winnerTeamId && (
            <p className="controller-winner">
              {match.teams[matchDoc!.winnerTeamId].name} wins!
            </p>
          )}

          {commandError && (
            <p className="controller-command-error" role="alert">{commandError}</p>
          )}

          <div className="controller-commands">
            <button
              className="controller-command-button controller-command-button--point"
              onClick={() => sendCommand('POINT_TEAM', 'teamA')}
            >
              Point {teamAName}
            </button>
            <button
              className="controller-command-button controller-command-button--point"
              onClick={() => sendCommand('POINT_TEAM', 'teamB')}
            >
              Point {teamBName}
            </button>
            <button
              className="controller-command-button"
              onClick={() => sendCommand('UNDO', undefined)}
            >
              Undo
            </button>
            <button
              className="controller-command-button"
              onClick={() => sendCommand('ANNOUNCE', undefined)}
            >
              Announce
            </button>
          </div>

          <button className="controller-leave-button" onClick={leave}>Leave</button>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Append CSS to `src/styles.css`**

Append to the end of `src/styles.css`:

```css
/* ── Controller Page ── */
.controller-panel {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: #172026;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
}

.controller-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #aabcc4;
  letter-spacing: 0.05em;
}

.controller-join-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.controller-join-form label {
  font-size: 0.8rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #aabcc4;
}

.controller-join-form input {
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  background: #101820;
  color: #f5f7fa;
  font-size: 1.2rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.controller-join-form input:focus {
  outline: none;
  border-color: #68d391;
}

.controller-back-link {
  font-size: 0.85rem;
  color: #aabcc4;
  text-decoration: none;
}

.controller-back-link:hover {
  color: #f5f7fa;
}

.controller-error-message,
.controller-command-error {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  font-size: 0.9rem;
}

.controller-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.controller-code {
  font-size: 0.85rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  color: #68d391;
  text-transform: uppercase;
}

.controller-score {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.controller-team {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.controller-team--serving {
  border-color: rgba(104, 211, 145, 0.4);
}

.controller-team-name {
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #aabcc4;
}

.controller-team-score {
  font-size: 2.5rem;
  font-weight: 900;
  color: #f5f7fa;
  line-height: 1;
}

.controller-serving-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #68d391;
}

.controller-vs {
  font-size: 0.85rem;
  font-weight: 900;
  color: #aabcc4;
}

.controller-winner {
  margin: 0;
  text-align: center;
  font-weight: 900;
  color: #68d391;
}

.controller-commands {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.controller-command-button {
  min-height: 48px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: #2b5d68;
  color: #f8fafc;
  cursor: pointer;
  font-weight: 800;
  font-size: 0.95rem;
}

.controller-command-button--point {
  background: #1f766a;
}

.controller-command-button:active {
  opacity: 0.8;
}

.controller-leave-button {
  align-self: flex-start;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  background: transparent;
  color: #aabcc4;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.85rem;
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- src/pages/ControllerPage.test.tsx
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ControllerPage.tsx src/pages/ControllerPage.test.tsx src/styles.css
git commit -m "feat: add ControllerPage component and CSS"
```

---

## Task 5: Full Verification

- [ ] **Step 1: Run all targeted tests**

```bash
npm test -- src/remote/firestoreControllerService.test.ts src/hooks/useControllerClient.test.tsx src/pages/ControllerPage.test.tsx
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass (no regressions).

- [ ] **Step 3: Lint and build**

```bash
npm run lint
npm run build
```

Expected: both exit 0.

- [ ] **Step 4: Commit .firebaserc if uncommitted**

```bash
git status
```

If `.firebaserc` is untracked, add it:

```bash
git add .firebaserc
git commit -m "chore: add .firebaserc to fix emulator project ID"
```
