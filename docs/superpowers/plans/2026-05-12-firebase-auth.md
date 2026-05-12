# Firebase Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Firebase Anonymous Auth (with Google upgrade path) so the host's Firebase UID replaces the ephemeral `crypto.randomUUID()` `hostId`, and Firestore rules can cryptographically verify room ownership — while keeping all non-Firestore features working offline.

**Architecture:** A `src/auth/` module owns the Firebase Auth lifecycle. `AuthProvider` wraps the router in `main.tsx`, subscribes to `onAuthStateChanged`, and auto-signs-in anonymously. A `useAuth()` hook exposes `{ user, loading, isAnonymous, authUnavailable, signInWithGoogle, signOut }` to any component. `useWatchRemoteHost` reads `user.uid` instead of generating a UUID.

**Tech Stack:** Firebase 12 (`firebase/auth`), React 19 context, Vitest 3 + Testing Library, Firestore Security Rules v2.

---

## File Map

| File | Action |
|---|---|
| `src/firebase.ts` | Modify — add `getFirebaseAuth()`, connect auth emulator |
| `src/auth/authContext.ts` | Create — `AuthState` interface, React context, `useAuth()` hook |
| `src/auth/AuthProvider.tsx` | Create — provider with `onAuthStateChanged`, silent sign-in, error handling |
| `src/auth/AuthProvider.test.tsx` | Create — unit tests for provider |
| `src/auth/index.ts` | Create — barrel export |
| `src/main.tsx` | Modify — wrap router with `<AuthProvider>` |
| `src/hooks/useWatchRemoteHost.ts` | Modify — replace `crypto.randomUUID()` with `user.uid` from `useAuth()` |
| `src/hooks/useWatchRemoteHost.test.tsx` | Modify — mock `useAuth()`, update `hostId` assertions |
| `src/components/SignInButton.tsx` | Create — persistent sign-in UI using `useAuth()` |
| `src/components/SignInButton.test.tsx` | Create — unit tests |
| `src/components/RequiresAuth.tsx` | Create — gated feature wrapper |
| `src/components/RequiresAuth.test.tsx` | Create — unit tests |
| `src/components/WatchRemotePanel.tsx` | Modify — add `SignInButton`, accept `authUnavailable` prop |
| `src/components/WatchRemotePanel.test.tsx` | Modify — cover `authUnavailable` states |
| `firestore.rules` | Modify — tighten with `request.auth.uid` checks |

---

## Task 1: Add `getFirebaseAuth()` to `firebase.ts`

**Files:**
- Modify: `src/firebase.ts`

- [ ] **Step 1: Write the failing test**

Create `src/firebase.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: 'app' })),
  getApps: vi.fn(() => []),
  getFirestore: vi.fn(() => ({ kind: 'firestore' })),
  connectFirestoreEmulator: vi.fn(),
  getAuth: vi.fn(() => ({ kind: 'auth' })),
  connectAuthEmulator: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: firebaseMocks.initializeApp,
  getApps: firebaseMocks.getApps,
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: firebaseMocks.getFirestore,
  connectFirestoreEmulator: firebaseMocks.connectFirestoreEmulator,
}));
vi.mock('firebase/auth', () => ({
  getAuth: firebaseMocks.getAuth,
  connectAuthEmulator: firebaseMocks.connectAuthEmulator,
}));

describe('firebase.ts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    firebaseMocks.getApps.mockReturnValue([]);
  });

  it('getFirebaseAuth returns an auth instance', async () => {
    const { getFirebaseAuth } = await import('./firebase');
    const auth = getFirebaseAuth();
    expect(auth).toEqual({ kind: 'auth' });
    expect(firebaseMocks.getAuth).toHaveBeenCalledTimes(1);
  });

  it('getFirebaseAuth returns the same instance on repeated calls', async () => {
    const { getFirebaseAuth } = await import('./firebase');
    const a = getFirebaseAuth();
    const b = getFirebaseAuth();
    expect(a).toBe(b);
    expect(firebaseMocks.getAuth).toHaveBeenCalledTimes(1);
  });

  it('connects auth emulator when VITE_USE_FIRESTORE_EMULATOR is true', async () => {
    import.meta.env.VITE_USE_FIRESTORE_EMULATOR = 'true';
    const { getFirebaseAuth } = await import('./firebase');
    getFirebaseAuth();
    expect(firebaseMocks.connectAuthEmulator).toHaveBeenCalledWith(
      { kind: 'auth' },
      'http://localhost:9099',
      { disableWarnings: true },
    );
    import.meta.env.VITE_USE_FIRESTORE_EMULATOR = undefined;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- --reporter=verbose src/firebase.test.ts
```

Expected: FAIL — `getFirebaseAuth` is not exported from `./firebase`.

- [ ] **Step 3: Implement `getFirebaseAuth()` in `src/firebase.ts`**

Add these imports and the new function. The full updated file:

```ts
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';

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
let auth: Auth | undefined;
let emulatorConnected = false;
let authEmulatorConnected = false;

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

export function getFirebaseAuth(): Auth {
  if (auth === undefined) {
    auth = getAuth(getFirebaseApp());
    connectAuthEmulatorIfConfigured(auth);
  }

  return auth;
}

function connectEmulatorIfConfigured(db: Firestore): void {
  if (emulatorConnected || import.meta.env.VITE_USE_FIRESTORE_EMULATOR !== 'true') {
    return;
  }

  const host = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST ?? 'localhost';
  const rawPort = import.meta.env.VITE_FIRESTORE_EMULATOR_PORT ?? '8080';
  const port = Number(rawPort);

  if (!isValidEmulatorPort(rawPort, port)) {
    throw new Error(`Invalid VITE_FIRESTORE_EMULATOR_PORT: ${rawPort}`);
  }

  connectFirestoreEmulator(db, host, port);
  emulatorConnected = true;
}

function connectAuthEmulatorIfConfigured(authInstance: Auth): void {
  if (authEmulatorConnected || import.meta.env.VITE_USE_FIRESTORE_EMULATOR !== 'true') {
    return;
  }

  connectAuthEmulator(authInstance, 'http://localhost:9099', { disableWarnings: true });
  authEmulatorConnected = true;
}

function isValidEmulatorPort(rawPort: string, port: number): boolean {
  return /^\d+$/.test(rawPort) && Number.isInteger(port) && port >= 1 && port <= 65535;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- --reporter=verbose src/firebase.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/firebase.ts src/firebase.test.ts
git commit -m "feat: add getFirebaseAuth() with auth emulator support"
```

---

## Task 2: Create `src/auth/authContext.ts`

**Files:**
- Create: `src/auth/authContext.ts`

No test file for this task — it's a pure type + context definition with no logic. The `useAuth()` hook is tested via `AuthProvider` tests in Task 3.

- [ ] **Step 1: Create `src/auth/authContext.ts`**

```ts
import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthState {
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  authUnavailable: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isAnonymous: false,
  authUnavailable: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export { AuthContext };
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/authContext.ts
git commit -m "feat: add AuthContext and useAuth hook"
```

---

## Task 3: Create `src/auth/AuthProvider.tsx`

**Files:**
- Create: `src/auth/AuthProvider.tsx`
- Create: `src/auth/AuthProvider.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/auth/AuthProvider.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { User } from 'firebase/auth';

const authMocks = vi.hoisted(() => ({
  getFirebaseAuth: vi.fn(() => ({ kind: 'auth' })),
  onAuthStateChanged: vi.fn(),
  signInAnonymously: vi.fn(),
  signInWithPopup: vi.fn(),
  linkWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(() => ({ kind: 'googleProvider' })),
}));

vi.mock('../firebase', () => ({ getFirebaseAuth: authMocks.getFirebaseAuth }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: authMocks.onAuthStateChanged,
  signInAnonymously: authMocks.signInAnonymously,
  signInWithPopup: authMocks.signInWithPopup,
  linkWithPopup: authMocks.linkWithPopup,
  signOut: authMocks.signOut,
  GoogleAuthProvider: authMocks.GoogleAuthProvider,
}));

function makeAnonymousUser(uid = 'anon-uid'): User {
  return { uid, isAnonymous: true, displayName: null, photoURL: null } as unknown as User;
}

function makeGoogleUser(uid = 'google-uid'): User {
  return { uid, isAnonymous: false, displayName: 'Arthur', photoURL: null } as unknown as User;
}

async function renderProvider(triggerAuthState: (callback: (user: User | null) => void) => void) {
  const { AuthProvider } = await import('./AuthProvider');
  const { useAuth } = await import('./authContext');

  function TestConsumer() {
    const { user, loading, isAnonymous, authUnavailable } = useAuth();
    if (loading) return <div>loading</div>;
    if (authUnavailable) return <div>unavailable</div>;
    if (!user) return <div>no-user</div>;
    return <div>{isAnonymous ? 'anonymous' : user.displayName}</div>;
  }

  let capturedCallback: ((user: User | null) => void) | undefined;
  (authMocks.onAuthStateChanged as Mock).mockImplementation((_auth, cb) => {
    capturedCallback = cb;
    return vi.fn();
  });

  const result = render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );

  triggerAuthState((user) => {
    if (capturedCallback) act(() => { capturedCallback!(user); });
  });

  return result;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMocks.signInAnonymously.mockResolvedValue(undefined);
  });

  it('shows loading state before onAuthStateChanged fires', async () => {
    const { AuthProvider } = await import('./AuthProvider');
    const { useAuth } = await import('./authContext');
    authMocks.onAuthStateChanged.mockReturnValue(vi.fn());

    function TestConsumer() {
      const { loading } = useAuth();
      return <div>{loading ? 'loading' : 'ready'}</div>;
    }

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('calls signInAnonymously when onAuthStateChanged fires with null', async () => {
    await renderProvider((trigger) => trigger(null));
    expect(authMocks.signInAnonymously).toHaveBeenCalledWith({ kind: 'auth' });
  });

  it('does not call signInAnonymously when a user is already present', async () => {
    await renderProvider((trigger) => trigger(makeAnonymousUser()));
    expect(authMocks.signInAnonymously).not.toHaveBeenCalled();
  });

  it('exposes isAnonymous=true for an anonymous user', async () => {
    await renderProvider((trigger) => trigger(makeAnonymousUser()));
    expect(screen.getByText('anonymous')).toBeInTheDocument();
  });

  it('exposes isAnonymous=false for a Google user', async () => {
    await renderProvider((trigger) => trigger(makeGoogleUser()));
    expect(screen.getByText('Arthur')).toBeInTheDocument();
  });

  it('sets authUnavailable=true and loading=false when signInAnonymously throws', async () => {
    authMocks.signInAnonymously.mockRejectedValue(new Error('network error'));
    await renderProvider((trigger) => trigger(null));
    expect(await screen.findByText('unavailable')).toBeInTheDocument();
  });

  it('unsubscribes from onAuthStateChanged on unmount', async () => {
    const unsubscribe = vi.fn();
    authMocks.onAuthStateChanged.mockReturnValue(unsubscribe);
    const { AuthProvider } = await import('./AuthProvider');
    const { unmount } = render(<AuthProvider><div /></AuthProvider>);
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- --reporter=verbose src/auth/AuthProvider.test.tsx
```

Expected: FAIL — `AuthProvider` module not found.

- [ ] **Step 3: Create `src/auth/AuthProvider.tsx`**

```tsx
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from '../firebase';
import { AuthContext, type AuthState } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUnavailable, setAuthUnavailable] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else {
        try {
          await signInAnonymously(auth);
        } catch {
          setAuthUnavailable(true);
          setLoading(false);
        }
      }
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();

    if (user?.isAnonymous) {
      try {
        await linkWithPopup(user, provider);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
          await signInWithPopup(auth, provider);
        } else {
          throw err;
        }
      }
    } else {
      await signInWithPopup(auth, provider);
    }
  }, [user]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
  }, []);

  const value: AuthState = {
    user,
    loading,
    isAnonymous: user?.isAnonymous ?? false,
    authUnavailable,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- --reporter=verbose src/auth/AuthProvider.test.tsx
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/AuthProvider.tsx src/auth/AuthProvider.test.tsx
git commit -m "feat: add AuthProvider with anonymous sign-in and offline resilience"
```

---

## Task 4: Create `src/auth/index.ts` and wire `AuthProvider` into `main.tsx`

**Files:**
- Create: `src/auth/index.ts`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create `src/auth/index.ts`**

```ts
export { AuthProvider } from './AuthProvider';
export { useAuth, type AuthState } from './authContext';
```

- [ ] **Step 2: Update `src/main.tsx`**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { ControllerPage } from './pages/ControllerPage';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/controller" element={<ControllerPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
```

- [ ] **Step 3: Run full test suite and build**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test && npm run build
```

Expected: all tests PASS, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/auth/index.ts src/main.tsx
git commit -m "feat: wire AuthProvider into app root"
```

---

## Task 5: Update `useWatchRemoteHost` to use `user.uid`

**Files:**
- Modify: `src/hooks/useWatchRemoteHost.ts`
- Modify: `src/hooks/useWatchRemoteHost.test.tsx`

- [ ] **Step 1: Update tests first**

In `src/hooks/useWatchRemoteHost.test.tsx`, add the auth mock at the top (after the existing imports, before the `describe` block):

```ts
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWatchRemoteHost, STORAGE_KEY, type WatchRemoteService } from './useWatchRemoteHost';
import { createMatch } from '../domain/matchEngine';
import type { MatchState } from '../domain/matchTypes';
import type { PendingWatchRemoteCommand } from '../remote/firestoreRemoteTypes';

// Mock useAuth so the hook gets a deterministic uid
vi.mock('../auth', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'test-host-uid', isAnonymous: true },
    loading: false,
    isAnonymous: true,
    authUnavailable: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  })),
}));
```

Then find every assertion that previously checked `hostId: expect.any(String)` and tighten it to `hostId: 'test-host-uid'`. Find and update all `createRoom` and `publishState` call assertions.

The file currently has tests that call `service.createRoom` and `service.publishState` — update those `expect` calls:

```ts
// Before (old):
expect(service.createRoom).toHaveBeenCalledWith(
  expect.objectContaining({ match: expect.any(Object) }),
);

// After (new) — hostId is now the mocked uid:
expect(service.createRoom).toHaveBeenCalledWith(
  expect.objectContaining({ hostId: 'test-host-uid', match: expect.any(Object) }),
);
```

Also add a new test for the auth-unavailable guard:

```ts
it('does not start when authUnavailable is true', async () => {
  const { useAuth } = await import('../auth');
  (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
    user: null,
    loading: false,
    isAnonymous: false,
    authUnavailable: true,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  });

  const service = makeService();
  const dispatch = vi.fn();
  const announce = vi.fn();
  const match = createTestMatch();

  const { result } = renderHook(() =>
    useWatchRemoteHost({ match, dispatch, announce, service }),
  );

  await act(async () => { await result.current.start(); });

  expect(service.createRoom).not.toHaveBeenCalled();
  expect(result.current.status).toBe('inactive');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- --reporter=verbose src/hooks/useWatchRemoteHost.test.tsx
```

Expected: FAIL — `useAuth` not found / hostId assertions fail.

- [ ] **Step 3: Update `src/hooks/useWatchRemoteHost.ts`**

Replace the `hostIdRef` line and add auth usage. Find this section at the top of `useWatchRemoteHost`:

```ts
  const [status, setStatus] = useState<WatchRemoteHostStatus>('inactive');
  const [code, setCode] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [lastCommandLabel, setLastCommandLabel] = useState<string | undefined>(undefined);

  const hostIdRef = useRef<string>(crypto.randomUUID());
```

Replace with:

```ts
  const { user, loading, authUnavailable } = useAuth();

  const [status, setStatus] = useState<WatchRemoteHostStatus>('inactive');
  const [code, setCode] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [lastCommandLabel, setLastCommandLabel] = useState<string | undefined>(undefined);
```

Then find the `start` callback's first guard:

```ts
    // Guard against double-start
    if (statusRef.current !== 'inactive') return;
```

Replace with:

```ts
    // Guard against double-start or missing auth
    if (statusRef.current !== 'inactive') return;
    if (loading || authUnavailable || !user) return;
```

Then replace both usages of `hostIdRef.current` with `user.uid`:

```ts
      const roomCode = await service.createRoom({ match: matchRef.current, hostId: user.uid });
      // ...
      await service.publishState({ code: roomCode, match: matchRef.current, hostId: user.uid });
```

Add the import at the top of the file:

```ts
import { useAuth } from '../auth';
```

Remove the `useRef` import if it is now unused (check — `unsubscribeRef`, `codeRef`, `matchRef`, `statusRef`, `cancelledRef`, `processedCommandIds` all use `useRef`, so keep it).

- [ ] **Step 4: Run tests to verify they pass**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- --reporter=verbose src/hooks/useWatchRemoteHost.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useWatchRemoteHost.ts src/hooks/useWatchRemoteHost.test.tsx
git commit -m "feat: use Firebase auth uid as hostId in useWatchRemoteHost"
```

---

## Task 6: Create `SignInButton` component

**Files:**
- Create: `src/components/SignInButton.tsx`
- Create: `src/components/SignInButton.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/SignInButton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
vi.mock('../auth', () => ({ useAuth: authMock.useAuth }));

function makeAuthState(overrides = {}) {
  return {
    user: null,
    loading: false,
    isAnonymous: false,
    authUnavailable: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
}

describe('SignInButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing while loading', async () => {
    (authMock.useAuth as Mock).mockReturnValue(makeAuthState({ loading: true }));
    const { SignInButton } = await import('./SignInButton');
    const { container } = render(<SignInButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders unavailable message when auth is unavailable', async () => {
    (authMock.useAuth as Mock).mockReturnValue(makeAuthState({ authUnavailable: true }));
    const { SignInButton } = await import('./SignInButton');
    render(<SignInButton />);
    expect(screen.getByText(/unavailable offline/i)).toBeInTheDocument();
  });

  it('renders sign-in button for anonymous users', async () => {
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({ isAnonymous: true, user: { uid: 'anon', isAnonymous: true } }),
    );
    const { SignInButton } = await import('./SignInButton');
    render(<SignInButton />);
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  it('calls signInWithGoogle when the sign-in button is clicked', async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({ isAnonymous: true, user: { uid: 'anon', isAnonymous: true }, signInWithGoogle }),
    );
    const { SignInButton } = await import('./SignInButton');
    render(<SignInButton />);
    await userEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('renders display name and sign-out for a named user', async () => {
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({
        isAnonymous: false,
        user: { uid: 'g-uid', isAnonymous: false, displayName: 'Arthur', photoURL: null },
      }),
    );
    const { SignInButton } = await import('./SignInButton');
    render(<SignInButton />);
    expect(screen.getByText('Arthur')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('calls signOut when the sign-out button is clicked', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({
        isAnonymous: false,
        user: { uid: 'g-uid', isAnonymous: false, displayName: 'Arthur', photoURL: null },
        signOut,
      }),
    );
    const { SignInButton } = await import('./SignInButton');
    render(<SignInButton />);
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- --reporter=verbose src/components/SignInButton.test.tsx
```

Expected: FAIL — `SignInButton` module not found.

- [ ] **Step 3: Create `src/components/SignInButton.tsx`**

```tsx
import { useAuth } from '../auth';

export function SignInButton() {
  const { user, loading, isAnonymous, authUnavailable, signInWithGoogle, signOut } = useAuth();

  if (loading) return null;

  if (authUnavailable) {
    return <span className="sign-in-unavailable">Unavailable offline</span>;
  }

  if (isAnonymous || !user) {
    return (
      <button type="button" className="sign-in-button" onClick={() => void signInWithGoogle()}>
        Sign in with Google
      </button>
    );
  }

  return (
    <span className="sign-in-user">
      <span>{user.displayName}</span>
      <button type="button" className="sign-out-button" onClick={() => void signOut()}>
        Sign out
      </button>
    </span>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- --reporter=verbose src/components/SignInButton.test.tsx
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SignInButton.tsx src/components/SignInButton.test.tsx
git commit -m "feat: add SignInButton component"
```

---

## Task 7: Create `RequiresAuth` component

**Files:**
- Create: `src/components/RequiresAuth.tsx`
- Create: `src/components/RequiresAuth.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/RequiresAuth.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

const authMock = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../auth', () => ({ useAuth: authMock.useAuth }));

describe('RequiresAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders children when signed in with a named account', async () => {
    authMock.useAuth.mockReturnValue({ isAnonymous: false, loading: false });
    const { RequiresAuth } = await import('./RequiresAuth');
    render(<RequiresAuth><div>protected</div></RequiresAuth>);
    expect(screen.getByText('protected')).toBeInTheDocument();
  });

  it('renders sign-in nudge instead of children when anonymous', async () => {
    authMock.useAuth.mockReturnValue({ isAnonymous: true, loading: false });
    const { RequiresAuth } = await import('./RequiresAuth');
    render(<RequiresAuth><div>protected</div></RequiresAuth>);
    expect(screen.queryByText('protected')).not.toBeInTheDocument();
    expect(screen.getByText(/sign in to use this feature/i)).toBeInTheDocument();
  });

  it('renders nothing while loading', async () => {
    authMock.useAuth.mockReturnValue({ isAnonymous: false, loading: true });
    const { RequiresAuth } = await import('./RequiresAuth');
    const { container } = render(<RequiresAuth><div>protected</div></RequiresAuth>);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- --reporter=verbose src/components/RequiresAuth.test.tsx
```

Expected: FAIL — `RequiresAuth` module not found.

- [ ] **Step 3: Create `src/components/RequiresAuth.tsx`**

```tsx
import type { ReactNode } from 'react';
import { useAuth } from '../auth';

export function RequiresAuth({ children }: { children: ReactNode }) {
  const { isAnonymous, loading } = useAuth();

  if (loading) return null;

  if (isAnonymous) {
    return <p className="requires-auth-nudge">Sign in to use this feature</p>;
  }

  return <>{children}</>;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- --reporter=verbose src/components/RequiresAuth.test.tsx
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/RequiresAuth.tsx src/components/RequiresAuth.test.tsx
git commit -m "feat: add RequiresAuth gated feature wrapper"
```

---

## Task 8: Update `WatchRemotePanel` to include `SignInButton` and `authUnavailable`

**Files:**
- Modify: `src/components/WatchRemotePanel.tsx`
- Modify: `src/components/WatchRemotePanel.test.tsx`

- [ ] **Step 1: Update the tests first**

In `src/components/WatchRemotePanel.test.tsx`, add the auth mock and `authUnavailable` test cases.

Add at the top (after existing imports):

```ts
const authMock = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../auth', () => ({ useAuth: authMock.useAuth }));
```

Add to the `renderPanel` defaults and add `authUnavailable` to props:

```ts
function renderPanel(overrides?: {
  status?: WatchRemoteHostStatus;
  code?: string;
  error?: string;
  lastCommandLabel?: string;
  authUnavailable?: boolean;
  onStart?: () => void;
  onStop?: () => void;
}) {
  // Default: signed-in anonymous user (sign-in button visible)
  authMock.useAuth.mockReturnValue({
    user: { uid: 'anon', isAnonymous: true },
    loading: false,
    isAnonymous: true,
    authUnavailable: overrides?.authUnavailable ?? false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  });

  const props = {
    status: overrides?.status ?? 'inactive',
    code: overrides?.code,
    error: overrides?.error,
    lastCommandLabel: overrides?.lastCommandLabel,
    authUnavailable: overrides?.authUnavailable ?? false,
    onStart: overrides?.onStart ?? vi.fn(),
    onStop: overrides?.onStop ?? vi.fn(),
  };
  return render(<WatchRemotePanel {...props} />);
}
```

Add these new test cases at the end of the test file:

```ts
describe('WatchRemotePanel > authUnavailable', () => {
  it('disables the Start watch remote button when auth is unavailable', () => {
    renderPanel({ status: 'inactive', authUnavailable: true });
    expect(screen.getByRole('button', { name: /start watch remote/i })).toBeDisabled();
  });

  it('renders the sign-in area', () => {
    renderPanel({ status: 'inactive' });
    // SignInButton renders "Sign in with Google" for anonymous users
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- --reporter=verbose src/components/WatchRemotePanel.test.tsx
```

Expected: FAIL — `authUnavailable` prop missing, `SignInButton` not rendered.

- [ ] **Step 3: Update `src/components/WatchRemotePanel.tsx`**

```tsx
import { SignInButton } from './SignInButton';
import type { WatchRemoteHostStatus } from '../remote/firestoreRemoteTypes';

interface WatchRemotePanelProps {
  readonly status: WatchRemoteHostStatus;
  readonly code?: string;
  readonly error?: string;
  readonly lastCommandLabel?: string;
  readonly authUnavailable?: boolean;
  readonly onStart: () => void;
  readonly onStop: () => void;
}

export function WatchRemotePanel({
  status,
  code,
  error,
  lastCommandLabel,
  authUnavailable = false,
  onStart,
  onStop,
}: WatchRemotePanelProps) {
  return (
    <div className="watch-remote-panel" aria-label="Watch remote">
      <div className="watch-remote-header">
        <SignInButton />
      </div>

      {status === 'inactive' && (
        <div className="watch-remote-actions">
          <button type="button" onClick={onStart} disabled={authUnavailable}>
            Start watch remote
          </button>
        </div>
      )}

      {status === 'starting' && (
        <div className="watch-remote-status">
          <span>Starting…</span>
        </div>
      )}

      {status === 'active' && (
        <>
          {code && <div className="watch-remote-code">{code}</div>}
          {lastCommandLabel && (
            <div className="watch-remote-status">Last: {lastCommandLabel}</div>
          )}
          <div className="watch-remote-actions">
            <button type="button" onClick={onStop}>
              End remote
            </button>
          </div>
        </>
      )}

      {status === 'stopping' && (
        <div className="watch-remote-status">
          <button type="button" disabled>
            Stopping…
          </button>
        </div>
      )}

      {status === 'error' && (
        <>
          {error && <div className="watch-remote-status" role="alert">{error}</div>}
          <div className="watch-remote-actions">
            <button type="button" onClick={onStart} disabled={authUnavailable}>
              Start watch remote
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Find where `WatchRemotePanel` is used in `App.tsx` and pass `authUnavailable`**

In `src/App.tsx`, find where `<WatchRemotePanel>` is rendered and the `useWatchRemoteHost` and `useAuth` calls. Add `useAuth` import and pass `authUnavailable`:

```ts
import { useAuth } from './auth';
```

Inside the component, add:

```ts
const { authUnavailable } = useAuth();
```

Then pass it to `<WatchRemotePanel>`:

```tsx
<WatchRemotePanel
  status={watchRemote.status}
  code={watchRemote.code}
  error={watchRemote.error}
  lastCommandLabel={watchRemote.lastCommandLabel}
  authUnavailable={authUnavailable}
  onStart={() => void watchRemote.start()}
  onStop={() => void watchRemote.stop()}
/>
```

- [ ] **Step 5: Run full test suite**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- --reporter=verbose src/components/WatchRemotePanel.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/WatchRemotePanel.tsx src/components/WatchRemotePanel.test.tsx src/App.tsx
git commit -m "feat: add SignInButton and authUnavailable to WatchRemotePanel"
```

---

## Task 9: Tighten Firestore rules with `request.auth.uid`

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Update `firestore.rules`**

Replace the current `matches/{code}` and `commands` allow rules. The full updated file, preserving all existing field validation:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isValidRoomCode(code) {
      return code is string
        && code.size() == 4
        && code.matches('^[A-HJ-NP-Z2-9]{4}$');
    }

    function isValidMatchMode(mode) {
      return mode is string && mode in ['singles', 'doubles'];
    }

    function isValidTeamId(v) {
      return v is string && v in ['teamA', 'teamB'];
    }

    function isValidCommandType(t) {
      return t is string && t in ['POINT_TEAM', 'UNDO', 'ANNOUNCE'];
    }

    function isValidSourceKind(k) {
      return k is string && k in ['wear', 'web'];
    }

    function matchDocKeys() {
      return ['active', 'code', 'createdAt', 'hostHeartbeatAt', 'hostId',
              'matchMode', 'matchState', 'updatedAt', 'winnerTeamId',
              'lastAppliedCommandId'];
    }

    match /matches/{code} {
      allow read: if true;

      allow create: if
        request.auth != null
        && request.auth.uid == request.resource.data.hostId
        && isValidRoomCode(code)
        && request.resource.data.code == code
        && request.resource.data.active == true
        && request.resource.data.hostId is string
        && request.resource.data.hostId.size() >= 1
        && request.resource.data.hostId.size() <= 128
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time
        && request.resource.data.hostHeartbeatAt == request.time
        && isValidMatchMode(request.resource.data.matchMode)
        && request.resource.data.matchState is map
        && (
          !('winnerTeamId' in request.resource.data)
          || isValidTeamId(request.resource.data.winnerTeamId)
        )
        && request.resource.data.keys().hasOnly(matchDocKeys());

      allow update: if
        request.auth != null
        && request.auth.uid == resource.data.hostId
        && request.resource.data.code == resource.data.code
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.hostId == resource.data.hostId
        && request.resource.data.active is bool
        && request.resource.data.updatedAt == request.time
        && request.resource.data.hostHeartbeatAt == request.time
        && isValidMatchMode(request.resource.data.matchMode)
        && request.resource.data.matchState is map
        && (
          !('winnerTeamId' in request.resource.data)
          || isValidTeamId(request.resource.data.winnerTeamId)
        )
        && request.resource.data.keys().hasOnly(matchDocKeys());

      allow delete: if false;

      match /commands/{commandId} {
        allow read: if true;

        allow create: if
          request.auth != null
          && isValidCommandType(request.resource.data.type)
          && isValidSourceKind(request.resource.data.sourceKind)
          && request.resource.data.sourceId is string
          && request.resource.data.sourceId.size() >= 1
          && request.resource.data.sourceId.size() <= 128
          && request.resource.data.createdAt == request.time
          && !('appliedAt' in request.resource.data)
          && !('rejectedAt' in request.resource.data)
          && !('rejectionReason' in request.resource.data)
          && (
            request.resource.data.type != 'POINT_TEAM'
            || isValidTeamId(request.resource.data.teamId)
          )
          && (
            request.resource.data.type == 'POINT_TEAM'
            || !('teamId' in request.resource.data)
          )
          && request.resource.data.keys().hasOnly(
            ['type', 'teamId', 'sourceId', 'sourceKind', 'createdAt']
          );

        allow update: if
          request.auth != null
          && request.auth.uid == get(/databases/$(database)/documents/matches/$(code)).data.hostId
          && resource.data.type == request.resource.data.type
          && resource.data.sourceId == request.resource.data.sourceId
          && resource.data.sourceKind == request.resource.data.sourceKind
          && resource.data.createdAt == request.resource.data.createdAt
          && (
            !('teamId' in resource.data)
            || resource.data.teamId == request.resource.data.teamId
          )
          && (
            !('rejectionReason' in request.resource.data)
            || (
              request.resource.data.rejectionReason is string
              && request.resource.data.rejectionReason.size() <= 256
            )
          )
          && request.resource.data.keys().hasOnly(
            ['type', 'teamId', 'sourceId', 'sourceKind', 'createdAt',
             'appliedAt', 'rejectedAt', 'rejectionReason']
          );

        allow delete: if false;
      }
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Deploy and verify rules compile**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npx -y firebase-tools@latest deploy --only firestore:rules
```

Expected output includes: `✔  cloud.firestore: rules file firestore.rules compiled successfully` and `✔  Deploy complete!`

- [ ] **Step 3: Run full verification suite**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test && npm run lint && npm run build && node --check public/sw.js
```

Expected: all tests pass, no lint errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat: enforce request.auth.uid ownership in Firestore rules"
```

---

## Task 10: Update design spec and push

- [ ] **Step 1: Update the Firestore security rules spec to reflect auth integration**

In `docs/superpowers/specs/2026-05-12-firestore-security-rules.md`, update the Known limitation section:

```markdown
### Auth integration

Rooms require `request.auth != null && request.auth.uid == hostId` on create and update.
Commands require `request.auth != null` on create (any signed-in user, including anonymous).
Command updates (mark applied/rejected) require the caller's uid to match the room's `hostId` via a `get()` lookup.

The app uses Firebase Anonymous Auth as a baseline — every client has a Firebase uid even without an explicit sign-in, so `request.auth` is always populated in practice.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-12-firestore-security-rules.md
git commit -m "docs: update Firestore rules spec to reflect auth integration"
```

- [ ] **Step 3: Push branch**

```bash
git push
```
