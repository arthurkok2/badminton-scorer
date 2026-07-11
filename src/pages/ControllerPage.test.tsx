import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ControllerPage } from './ControllerPage';
import type { WatchRemoteMatchDocument } from '../remote/firestoreRemoteTypes';
import { createMatch } from '../domain/matchEngine';

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'google-uid', isAnonymous: false },
    loading: false,
    isAnonymous: false,
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

vi.mock('../hooks/useWatchLayout', () => ({
  useWatchLayout: vi.fn(() => false),
}));

import { useControllerClient } from '../hooks/useControllerClient';
const mockedUseControllerClient = vi.mocked(useControllerClient);
import { useWatchLayout } from '../hooks/useWatchLayout';
const mockedUseWatchLayout = vi.mocked(useWatchLayout);

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
    authMock.useAuth.mockReturnValue({
      user: { uid: 'google-uid', isAnonymous: false },
      loading: false,
      isAnonymous: false,
      authUnavailable: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    mockedUseControllerClient.mockReturnValue(mockHookState);
    mockedUseWatchLayout.mockReturnValue(false);
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
      authMock.useAuth.mockReturnValue({
        user: null as unknown as { uid: string; isAnonymous: boolean },
        loading: false,
        isAnonymous: false,
        authUnavailable: false,
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
      });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByRole('button', { name: /account menu, sign in with google/i })).toBeInTheDocument();
    });

    it('hides match and session actions from the controller settings menu', async () => {
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      await userEvent.click(screen.getByRole('button', { name: /settings menu/i }));

      expect(screen.queryByRole('menuitem', { name: /match settings/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /session mode/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /new match/i })).not.toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /announcement settings/i })).toBeInTheDocument();
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

  describe('watch layout', () => {
    let origMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      origMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn(() => ({
        matches: true,
        media: '(max-width: 480px) and (max-height: 480px)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      mockedUseWatchLayout.mockReturnValue(true);
    });

    afterEach(() => {
      window.matchMedia = origMatchMedia;
    });

    it('renders watch join layout when disconnected on small viewport', () => {
      mockedUseControllerClient.mockReturnValue(mockHookState);
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByLabelText(/room code/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /back to scorer/i })).not.toBeInTheDocument();
    });

    it('renders watch active layout with court and players when active on small viewport', () => {
      mockedUseControllerClient.mockReturnValue(makeActiveState());
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByText('Team A')).toBeInTheDocument();
      expect(screen.getByText('Team B')).toBeInTheDocument();
      expect(screen.getByText('Serving: Player 1')).toBeInTheDocument();

      expect(screen.getByText('Player 1')).toBeInTheDocument();
      expect(screen.getByText('Player 2')).toBeInTheDocument();
      expect(screen.getByText('Player 3')).toBeInTheDocument();
      expect(screen.getByText('Player 4')).toBeInTheDocument();

      expect(screen.getByRole('button', { name: /point\s+team a/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /point\s+team b/i })).toBeInTheDocument();

      expect(screen.getByRole('button', { name: /^undo$/i })).toBeInTheDocument();

      expect(screen.queryByRole('button', { name: /announce/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /leave/i })).not.toBeInTheDocument();
    });

    it('calls sendCommand when a watch point button is clicked', async () => {
      const sendCommand = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...makeActiveState(), sendCommand });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      await userEvent.click(screen.getByRole('button', { name: /point\s+team a/i }));
      expect(sendCommand).toHaveBeenCalledWith('POINT_TEAM', 'teamA');

      await userEvent.click(screen.getByRole('button', { name: /point\s+team b/i }));
      expect(sendCommand).toHaveBeenCalledWith('POINT_TEAM', 'teamB');
    });

    it('calls sendCommand with UNDO when watch undo is clicked', async () => {
      const sendCommand = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...makeActiveState(), sendCommand });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      await userEvent.click(screen.getByRole('button', { name: /^undo$/i }));
      expect(sendCommand).toHaveBeenCalledWith('UNDO', undefined);
    });

    it('shows commandError on watch layout', () => {
      mockedUseControllerClient.mockReturnValue({ ...makeActiveState(), commandError: 'write failed' });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByRole('alert')).toHaveTextContent('write failed');
    });

    it('renders watch joining state with disabled button', () => {
      mockedUseControllerClient.mockReturnValue({ ...mockHookState, status: 'joining' });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByRole('button', { name: /joining/i })).toBeDisabled();
    });

    it('shows error message with back button on watch error state', () => {
      const leave = vi.fn();
      mockedUseControllerClient.mockReturnValue({ ...mockHookState, status: 'error', error: 'Room not found', leave });
      render(<MemoryRouter><ControllerPage /></MemoryRouter>);

      expect(screen.getByRole('alert')).toHaveTextContent('Room not found');
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });
  });
});
