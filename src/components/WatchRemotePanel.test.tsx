import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { WatchRemotePanel } from './WatchRemotePanel';
import type { WatchRemoteHostStatus } from '../remote/firestoreRemoteTypes';

const authMock = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock('../auth', () => ({ useAuth: authMock.useAuth }));

function renderPanel(overrides?: {
  status?: WatchRemoteHostStatus;
  code?: string;
  error?: string;
  lastCommandLabel?: string;
  authUnavailable?: boolean;
  onStart?: () => void;
  onStop?: () => void;
}) {
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

describe('WatchRemotePanel > inactive', () => {
  it('renders a Start watch remote button', () => {
    renderPanel({ status: 'inactive' });
    expect(screen.getByRole('button', { name: /start watch remote/i })).toBeInTheDocument();
  });

  it('the start button is enabled', () => {
    renderPanel({ status: 'inactive' });
    expect(screen.getByRole('button', { name: /start watch remote/i })).not.toBeDisabled();
  });

  it('does not show End remote button', () => {
    renderPanel({ status: 'inactive' });
    expect(screen.queryByRole('button', { name: /end remote/i })).not.toBeInTheDocument();
  });

  it('calls onStart when Start watch remote is clicked', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    renderPanel({ status: 'inactive', onStart });
    await user.click(screen.getByRole('button', { name: /start watch remote/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe('WatchRemotePanel > starting', () => {
  it('shows a starting/loading indication', () => {
    renderPanel({ status: 'starting' });
    expect(screen.getByText(/starting/i)).toBeInTheDocument();
  });

  it('disables the start button while starting', () => {
    renderPanel({ status: 'starting' });
    // Either no button or a disabled button
    const btn = screen.queryByRole('button', { name: /start watch remote/i });
    if (btn) {
      expect(btn).toBeDisabled();
    }
  });
});

describe('WatchRemotePanel > active', () => {
  it('shows the room code prominently', () => {
    renderPanel({ status: 'active', code: 'ABC123' });
    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('shows an End remote button', () => {
    renderPanel({ status: 'active', code: 'ABC123' });
    expect(screen.getByRole('button', { name: /end remote/i })).toBeInTheDocument();
  });

  it('does not show the Start watch remote button', () => {
    renderPanel({ status: 'active', code: 'ABC123' });
    expect(screen.queryByRole('button', { name: /start watch remote/i })).not.toBeInTheDocument();
  });

  it('calls onStop when End remote is clicked', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    renderPanel({ status: 'active', code: 'ABC123', onStop });
    await user.click(screen.getByRole('button', { name: /end remote/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('shows lastCommandLabel when provided', () => {
    renderPanel({ status: 'active', code: 'ABC123', lastCommandLabel: 'POINT_TEAM teamA' });
    expect(screen.getByText(/POINT_TEAM teamA/)).toBeInTheDocument();
  });

  it('does not show lastCommandLabel section when not provided', () => {
    renderPanel({ status: 'active', code: 'ABC123' });
    expect(screen.queryByText(/last:/i)).not.toBeInTheDocument();
  });
});

describe('WatchRemotePanel > stopping', () => {
  it('shows a stopping indication', () => {
    renderPanel({ status: 'stopping' });
    expect(screen.getByText(/stopping/i)).toBeInTheDocument();
  });

  it('disables controls while stopping', () => {
    renderPanel({ status: 'stopping' });
    expect(screen.getByRole('button', { name: /stopping/i })).toBeDisabled();
  });
});

describe('WatchRemotePanel > error', () => {
  it('displays the error message', () => {
    renderPanel({ status: 'error', error: 'Connection failed' });
    expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
  });

  it('shows Start watch remote button so user can retry', () => {
    renderPanel({ status: 'error', error: 'Connection failed' });
    expect(screen.getByRole('button', { name: /start watch remote/i })).toBeInTheDocument();
  });

  it('calls onStart when Start watch remote is clicked in error state', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    renderPanel({ status: 'error', error: 'Connection failed', onStart });
    await user.click(screen.getByRole('button', { name: /start watch remote/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('does not hide other content (panel is still rendered)', () => {
    renderPanel({ status: 'error', error: 'Connection failed' });
    // The panel itself is still rendered (error message visible)
    expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
  });
});

describe('WatchRemotePanel > authUnavailable', () => {
  it('disables the Start watch remote button when auth is unavailable', () => {
    renderPanel({ status: 'inactive', authUnavailable: true });
    expect(screen.getByRole('button', { name: /start watch remote/i })).toBeDisabled();
  });
});

describe('WatchRemotePanel > auth UI', () => {
  it('does not render account controls inside the remote panel', () => {
    renderPanel({ status: 'inactive' });
    expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument();
  });
});
