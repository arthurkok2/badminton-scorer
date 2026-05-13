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

  it('renders an avatar button for a named user', async () => {
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({
        isAnonymous: false,
        user: { uid: 'g-uid', isAnonymous: false, displayName: 'Arthur Dent', email: 'arthur@example.com', photoURL: null },
      }),
    );
    const { SignInButton } = await import('./SignInButton');
    render(<SignInButton />);
    expect(screen.getByRole('button', { name: /account menu for arthur dent/i })).toHaveTextContent('AD');
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('uses the Google profile photo when available', async () => {
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({
        isAnonymous: false,
        user: {
          uid: 'g-uid',
          isAnonymous: false,
          displayName: 'Arthur Dent',
          email: 'arthur@example.com',
          photoURL: 'https://example.com/avatar.jpg',
        },
      }),
    );
    const { SignInButton } = await import('./SignInButton');
    render(<SignInButton />);
    expect(screen.getByRole('img', { name: /arthur dent/i })).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('opens an account menu with profile details and actions', async () => {
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({
        isAnonymous: false,
        user: { uid: 'g-uid', isAnonymous: false, displayName: 'Arthur Dent', email: 'arthur@example.com', photoURL: null },
      }),
    );
    const { SignInButton } = await import('./SignInButton');
    render(<SignInButton />);
    await userEvent.click(screen.getByRole('button', { name: /account menu for arthur dent/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Arthur Dent')).toBeInTheDocument();
    expect(screen.getByText('arthur@example.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
  });

  it('closes the account menu when Escape is pressed', async () => {
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({
        isAnonymous: false,
        user: { uid: 'g-uid', isAnonymous: false, displayName: 'Arthur Dent', photoURL: null },
      }),
    );
    const { SignInButton } = await import('./SignInButton');
    render(<SignInButton />);
    await userEvent.click(screen.getByRole('button', { name: /account menu for arthur dent/i }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes the account menu when clicking outside', async () => {
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({
        isAnonymous: false,
        user: { uid: 'g-uid', isAnonymous: false, displayName: 'Arthur Dent', photoURL: null },
      }),
    );
    const { SignInButton } = await import('./SignInButton');
    render(
      <>
        <SignInButton />
        <button type="button">Outside</button>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: /account menu for arthur dent/i }));
    await userEvent.click(screen.getByRole('button', { name: /outside/i }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('calls signOut and closes the menu when the sign-out item is clicked', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({
        isAnonymous: false,
        user: { uid: 'g-uid', isAnonymous: false, displayName: 'Arthur Dent', photoURL: null },
        signOut,
      }),
    );
    const { SignInButton } = await import('./SignInButton');
    render(<SignInButton />);
    await userEvent.click(screen.getByRole('button', { name: /account menu for arthur dent/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
