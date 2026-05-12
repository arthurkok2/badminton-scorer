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
