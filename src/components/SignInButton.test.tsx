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
