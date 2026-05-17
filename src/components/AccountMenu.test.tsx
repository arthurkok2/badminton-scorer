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

describe('AccountMenu', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing while loading', async () => {
    (authMock.useAuth as Mock).mockReturnValue(makeAuthState({ loading: true }));
    const { AccountMenu } = await import('./AccountMenu');
    const { container } = render(<AccountMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens a neutral sign-in menu for anonymous users', async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({
        isAnonymous: true,
        user: { uid: 'anon', isAnonymous: true },
        signInWithGoogle,
      }),
    );
    const { AccountMenu } = await import('./AccountMenu');
    render(<AccountMenu />);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));

    expect(screen.getByText(/local scoring is available/i)).toBeInTheDocument();
    expect(screen.getByText(/not signed in/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^sign in with google$/i }));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/local scoring is available/i)).not.toBeInTheDocument();
  });

  it('opens a signed-in profile menu without Settings', async () => {
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({
        isAnonymous: false,
        user: {
          uid: 'g-uid',
          isAnonymous: false,
          displayName: 'Arthur Dent',
          email: 'arthur@example.com',
          photoURL: null,
        },
      }),
    );
    const { AccountMenu } = await import('./AccountMenu');
    render(<AccountMenu />);

    await userEvent.click(screen.getByRole('button', { name: /account menu for arthur dent/i }));

    expect(screen.getByText('Arthur Dent')).toBeInTheDocument();
    expect(screen.getByText('arthur@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
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
    const { AccountMenu } = await import('./AccountMenu');
    render(<AccountMenu />);
    expect(screen.getByRole('img', { name: /arthur dent/i })).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('opens an unavailable account menu without a sign-in item', async () => {
    (authMock.useAuth as Mock).mockReturnValue(makeAuthState({ authUnavailable: true }));
    const { AccountMenu } = await import('./AccountMenu');
    render(<AccountMenu />);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));

    expect(screen.getByText(/sign-in is unavailable offline/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument();
  });

  it('closes the account menu when Escape is pressed', async () => {
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({
        isAnonymous: false,
        user: { uid: 'g-uid', isAnonymous: false, displayName: 'Arthur Dent', photoURL: null },
      }),
    );
    const { AccountMenu } = await import('./AccountMenu');
    render(<AccountMenu />);
    await userEvent.click(screen.getByRole('button', { name: /account menu for arthur dent/i }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('closes the account menu when clicking outside', async () => {
    (authMock.useAuth as Mock).mockReturnValue(
      makeAuthState({
        isAnonymous: false,
        user: { uid: 'g-uid', isAnonymous: false, displayName: 'Arthur Dent', photoURL: null },
      }),
    );
    const { AccountMenu } = await import('./AccountMenu');
    render(
      <>
        <AccountMenu />
        <button type="button">Outside</button>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: /account menu for arthur dent/i }));
    await userEvent.click(screen.getByRole('button', { name: /outside/i }));
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
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
    const { AccountMenu } = await import('./AccountMenu');
    render(<AccountMenu />);
    await userEvent.click(screen.getByRole('button', { name: /account menu for arthur dent/i }));
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });
});
