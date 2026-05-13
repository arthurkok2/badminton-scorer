import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ControllerPage } from './ControllerPage';
import type { WatchRemoteMatchDocument } from '../remote/firestoreRemoteTypes';
import { createMatch } from '../domain/matchEngine';

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'anon', isAnonymous: true },
    loading: false,
    isAnonymous: true,
    authUnavailable: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  })),
}));
vi.mock('../auth', () => ({ useAuth: authMock.useAuth }));

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
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByRole('textbox', { name: /room code/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
    });

    it('pre-fills the input with lastCode from the hook', () => {
      mockedUseControllerClient.mockReturnValue({ ...mockHookState, lastCode: 'WXYZ' });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByRole('textbox', { name: /room code/i })).toHaveValue('WXYZ');
    });

    it('calls join with the input value when Join is clicked', async () => {
      const join = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...mockHookState, join });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      await userEvent.clear(screen.getByRole('textbox', { name: /room code/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /room code/i }), 'ABCD');
      await userEvent.click(screen.getByRole('button', { name: /join/i }));

      expect(join).toHaveBeenCalledWith('ABCD');
    });

    it('shows a Back to scorer link', () => {
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByRole('link', { name: /back to scorer/i })).toHaveAttribute('href', '/');
    });

    it('renders a sign-in button in the global account chrome', () => {
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByRole('banner', { name: /app account/i })).toContainElement(
        screen.getByRole('button', { name: /sign in with google/i }),
      );
    });

    it('disables the Join button when authUnavailable is true', () => {
      authMock.useAuth.mockReturnValueOnce({
        user: null as unknown as { uid: string; isAnonymous: boolean },
        loading: false, isAnonymous: false, authUnavailable: true,
        signInWithGoogle: vi.fn(), signOut: vi.fn(),
      });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByRole('button', { name: /join/i })).toBeDisabled();
      expect(screen.getByText(/unavailable offline/i)).toBeInTheDocument();
    });
  });

  describe('joining state', () => {
    it('disables the Join button while joining', () => {
      mockedUseControllerClient.mockReturnValue({ ...mockHookState, status: 'joining' });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByRole('button', { name: /joining/i })).toBeDisabled();
    });
  });

  describe('active state', () => {
    it('renders team names and scores', () => {
      mockedUseControllerClient.mockReturnValue(makeActiveState());
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByText('Team A')).toBeInTheDocument();
      expect(screen.getByText('Team B')).toBeInTheDocument();
      expect(screen.getAllByText('0')).toHaveLength(2);
    });

    it('renders all four command buttons', () => {
      mockedUseControllerClient.mockReturnValue(makeActiveState());
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByRole('button', { name: /point team a/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /point team b/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /announce/i })).toBeInTheDocument();
    });

    it('calls sendCommand with POINT_TEAM and teamA when the first button is clicked', async () => {
      const sendCommand = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...makeActiveState(), sendCommand });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      await userEvent.click(screen.getByRole('button', { name: /point team a/i }));

      expect(sendCommand).toHaveBeenCalledWith('POINT_TEAM', 'teamA');
    });

    it('calls sendCommand with UNDO when Undo is clicked', async () => {
      const sendCommand = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...makeActiveState(), sendCommand });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      await userEvent.click(screen.getByRole('button', { name: /undo/i }));

      expect(sendCommand).toHaveBeenCalledWith('UNDO', undefined);
    });

    it('calls sendCommand with ANNOUNCE when Announce is clicked', async () => {
      const sendCommand = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...makeActiveState(), sendCommand });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      await userEvent.click(screen.getByRole('button', { name: /announce/i }));

      expect(sendCommand).toHaveBeenCalledWith('ANNOUNCE', undefined);
    });

    it('shows a commandError when one is set', () => {
      mockedUseControllerClient.mockReturnValue({ ...makeActiveState(), commandError: 'write failed' });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByRole('alert')).toHaveTextContent('write failed');
    });

    it('calls leave when the Leave button is clicked', async () => {
      const leave = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...makeActiveState(), leave });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      await userEvent.click(screen.getByRole('button', { name: /leave/i }));

      expect(leave).toHaveBeenCalledOnce();
    });

    it('shows the room code', () => {
      mockedUseControllerClient.mockReturnValue(makeActiveState());
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByText('ABCD')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows the error message', () => {
      mockedUseControllerClient.mockReturnValue({ ...mockHookState, status: 'error', error: 'Room not found' });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByRole('alert')).toHaveTextContent('Room not found');
    });

    it('calls leave when Back is clicked', async () => {
      const leave = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...mockHookState, status: 'error', error: 'Room not found', leave });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      await userEvent.click(screen.getByRole('button', { name: /back/i }));

      expect(leave).toHaveBeenCalledOnce();
    });
  });
});
