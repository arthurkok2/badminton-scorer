import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { User } from 'firebase/auth';

const authMocks = vi.hoisted(() => ({
  getFirebaseAuth: vi.fn(() => ({ kind: 'auth' })),
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(() => ({ kind: 'googleProvider' })),
}));

vi.mock('../firebase', () => ({ getFirebaseAuth: authMocks.getFirebaseAuth }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: authMocks.onAuthStateChanged,
  signInWithPopup: authMocks.signInWithPopup,
  signOut: authMocks.signOut,
  GoogleAuthProvider: authMocks.GoogleAuthProvider,
}));

function makeAnonymousUser(uid = 'anon-uid'): User {
  return { uid, isAnonymous: true, displayName: null, photoURL: null } as unknown as User;
}

function makeGoogleUser(uid = 'google-uid'): User {
  return { uid, isAnonymous: false, displayName: 'Arthur', photoURL: null } as unknown as User;
}

async function renderProvider(
  triggerAuthState: (callback: (user: User | null) => Promise<void>) => Promise<void> | void,
) {
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

  await triggerAuthState(async (user) => {
    if (capturedCallback) {
      await act(async () => { capturedCallback!(user); });
    }
  });

  return result;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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

  it('exposes no user when onAuthStateChanged fires with null', async () => {
    await renderProvider((trigger) => trigger(null));
    expect(screen.getByText('no-user')).toBeInTheDocument();
  });

  it('does not create anonymous Firebase users when auth has no current user', async () => {
    await renderProvider((trigger) => trigger(null));
    expect(authMocks.signInWithPopup).not.toHaveBeenCalled();
  });

  it('does not sign out when a named user is already present', async () => {
    await renderProvider((trigger) => trigger(makeGoogleUser()));
    expect(authMocks.signOut).not.toHaveBeenCalled();
  });

  it('clears persisted anonymous users instead of exposing them as signed in', async () => {
    await renderProvider((trigger) => trigger(makeAnonymousUser()));
    expect(await screen.findByText('no-user')).toBeInTheDocument();
    expect(authMocks.signOut).toHaveBeenCalledWith({ kind: 'auth' });
  });

  it('exposes isAnonymous=false for a Google user', async () => {
    await renderProvider((trigger) => trigger(makeGoogleUser()));
    expect(screen.getByText('Arthur')).toBeInTheDocument();
  });

  it('stays signed out after signOut triggers onAuthStateChanged with null', async () => {
    // First render with a Google user
    await renderProvider((trigger) => trigger(makeGoogleUser()));

    // Simulate sign-out: Firebase fires onAuthStateChanged(null)
    await renderProvider((trigger) => trigger(null));

    expect(screen.getAllByText('no-user')).toHaveLength(1);
  });

  it('signs in with Google directly', async () => {
    const { AuthProvider } = await import('./AuthProvider');
    const { useAuth } = await import('./authContext');
    authMocks.onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(null);
      return vi.fn();
    });

    function TestConsumer() {
      const { signInWithGoogle } = useAuth();
      return <button type="button" onClick={() => { void signInWithGoogle(); }}>Sign in</button>;
    }

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await act(async () => {
      screen.getByRole('button', { name: /sign in/i }).click();
    });

    expect(authMocks.signInWithPopup).toHaveBeenCalledWith({ kind: 'auth' }, { kind: 'googleProvider' });
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
