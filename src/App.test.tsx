import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { connectBluetoothRemote, getBluetoothSupportStatus } from './input/bluetoothRemote';
import { connectGamepadRemote } from './input/gamepadRemote';
import { connectKeyboardRemote } from './input/keyboardRemote';
import { speakAnnouncement } from './speech/announcer';
import * as useWatchRemoteHostModule from './hooks/useWatchRemoteHost';
import * as sessionStorageModule from './session/sessionStorage';
import type { BluetoothRemoteConnection } from './input/bluetoothRemote';
import type { GamepadRemoteConnection, GamepadRemoteDiagnosticEvent } from './input/gamepadRemote';
import type { KeyboardRemoteConnection, KeyboardRemoteDiagnosticEvent } from './input/keyboardRemote';
import type { CloudHistoryStats } from './session/cloudSessionService';
import type { GlobalPlayer } from './session/sessionTypes';

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

vi.mock('./auth', () => ({ useAuth: authMock.useAuth }));

vi.mock('./speech/announcer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./speech/announcer')>();

  return {
    ...actual,
    getSpeechStatus: vi.fn(() => 'available'),
    speakAnnouncement: vi.fn(() => true),
  };
});

vi.mock('./input/bluetoothRemote', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./input/bluetoothRemote')>();

  return {
    ...actual,
    getBluetoothSupportStatus: vi.fn(() => 'unsupported'),
    connectBluetoothRemote: vi.fn(),
  };
});

vi.mock('./input/keyboardRemote', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./input/keyboardRemote')>();

  return {
    ...actual,
    connectKeyboardRemote: vi.fn(),
  };
});

vi.mock('./input/gamepadRemote', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./input/gamepadRemote')>();

  return {
    ...actual,
    connectGamepadRemote: vi.fn(),
  };
});

vi.mock('./hooks/useWatchRemoteHost', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hooks/useWatchRemoteHost')>();

  return {
    ...actual,
    useWatchRemoteHost: vi.fn(),
  };
});

const testPlayers: GlobalPlayer[] = [
  { id: 'p1', displayName: 'Alice', searchName: 'alice', createdBy: 'uid-1', claimStatus: 'guest', globalIndividualElo: 1500, globalMatchCount: 0, statsVersion: 1 },
  { id: 'p2', displayName: 'Bob', searchName: 'bob', createdBy: 'uid-1', claimStatus: 'guest', globalIndividualElo: 1500, globalMatchCount: 0, statsVersion: 1 },
  { id: 'p3', displayName: 'Carol', searchName: 'carol', createdBy: 'uid-1', claimStatus: 'guest', globalIndividualElo: 1500, globalMatchCount: 0, statsVersion: 1 },
  { id: 'p4', displayName: 'Dave', searchName: 'dave', createdBy: 'uid-1', claimStatus: 'guest', globalIndividualElo: 1500, globalMatchCount: 0, statsVersion: 1 },
];

const cloudServiceMock = vi.hoisted(() => ({
  searchGlobalPlayers: vi.fn(() => Promise.resolve([
    { id: 'p1', displayName: 'Alice', searchName: 'alice', createdBy: 'uid-1', claimStatus: 'guest', globalIndividualElo: 1500, globalMatchCount: 0, statsVersion: 1 },
    { id: 'p2', displayName: 'Bob', searchName: 'bob', createdBy: 'uid-1', claimStatus: 'guest', globalIndividualElo: 1500, globalMatchCount: 0, statsVersion: 1 },
    { id: 'p3', displayName: 'Carol', searchName: 'carol', createdBy: 'uid-1', claimStatus: 'guest', globalIndividualElo: 1500, globalMatchCount: 0, statsVersion: 1 },
    { id: 'p4', displayName: 'Dave', searchName: 'dave', createdBy: 'uid-1', claimStatus: 'guest', globalIndividualElo: 1500, globalMatchCount: 0, statsVersion: 1 },
  ])),
  createGlobalPlayerDocument: vi.fn(() => Promise.resolve(
    { id: 'p1', displayName: 'Alice', searchName: 'alice', createdBy: 'uid-1', claimStatus: 'guest', globalIndividualElo: 1500, globalMatchCount: 0, statsVersion: 1 },
  )),
  completeCloudSessionMatch: vi.fn(() => Promise.resolve(undefined)),
  importMappedLegacySessions: vi.fn(() => Promise.resolve(undefined)),
  loadCloudHistoryStats: vi.fn<() => Promise<CloudHistoryStats>>(() => Promise.resolve({
    sessions: [],
    players: [],
    pairs: [],
    matchups: [],
  })),
  saveCloudSession: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('./session/cloudSessionService', () => ({
  searchGlobalPlayers: cloudServiceMock.searchGlobalPlayers,
  createGlobalPlayerDocument: cloudServiceMock.createGlobalPlayerDocument,
  completeCloudSessionMatch: cloudServiceMock.completeCloudSessionMatch,
  importMappedLegacySessions: cloudServiceMock.importMappedLegacySessions,
  loadCloudHistoryStats: cloudServiceMock.loadCloudHistoryStats,
  saveCloudSession: cloudServiceMock.saveCloudSession,
}));

const STORAGE_KEY = 'badminton-scorer-preferences';
const mockedSpeakAnnouncement = vi.mocked(speakAnnouncement);
const mockedGetBluetoothSupportStatus = vi.mocked(getBluetoothSupportStatus);
const mockedConnectBluetoothRemote = vi.mocked(connectBluetoothRemote);
const mockedConnectKeyboardRemote = vi.mocked(connectKeyboardRemote);
const mockedConnectGamepadRemote = vi.mocked(connectGamepadRemote);
const mockedUseWatchRemoteHost = vi.mocked(useWatchRemoteHostModule.useWatchRemoteHost);

const inactiveWatchRemoteResult = {
  status: 'inactive' as const,
  code: undefined,
  error: undefined,
  lastCommandLabel: undefined,
  start: vi.fn(),
  stop: vi.fn(),
};

async function openSettingsMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /settings menu/i }));
}

async function openMatchSettings(user: ReturnType<typeof userEvent.setup>) {
  await openSettingsMenu(user);
  await user.click(screen.getByRole('menuitem', { name: /match settings/i }));
}

async function chooseSettingsAction(user: ReturnType<typeof userEvent.setup>, actionName: RegExp) {
  await openSettingsMenu(user);
  await user.click(within(screen.getByLabelText(/settings menu tools/i)).getByRole('menuitem', { name: actionName }));
}

async function openAnnouncementSettings(user: ReturnType<typeof userEvent.setup>) {
  await openSettingsMenu(user);
  await user.click(screen.getByRole('menuitem', { name: /announcement settings/i }));
}

async function openDisplaySettings(user: ReturnType<typeof userEvent.setup>) {
  await openSettingsMenu(user);
  await user.click(screen.getByRole('menuitem', { name: /display settings/i }));
}

async function openRemoteControls(user: ReturnType<typeof userEvent.setup>) {
  await openSettingsMenu(user);
  await user.click(screen.getByRole('menuitem', { name: /remote controls/i }));
}

async function openDiagnostics(user: ReturnType<typeof userEvent.setup>) {
  await openSettingsMenu(user);
  await user.click(screen.getByRole('menuitem', { name: /diagnostics/i }));
}

async function startSessionMatch(user: ReturnType<typeof userEvent.setup>) {
  await chooseSettingsAction(user, /session mode/i);

  // Trigger search to load test players via the mock
  await user.type(screen.getByRole('textbox', { name: /player search/i }), 'a');

  // Add each player from search results chips
  for (const player of testPlayers) {
    await user.click(screen.getByRole('button', { name: new RegExp(`add ${player.displayName}`, 'i') }));
  }

  await user.click(screen.getByRole('button', { name: /start session/i }));
  await user.click(screen.getByRole('button', { name: /start match/i }));
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    authMock.useAuth.mockReturnValue({
      user: { uid: 'google-uid', isAnonymous: false },
      loading: false,
      isAnonymous: false,
      authUnavailable: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    mockedSpeakAnnouncement.mockClear();
    mockedGetBluetoothSupportStatus.mockReturnValue('unsupported');
    mockedConnectBluetoothRemote.mockReset();
    mockedConnectKeyboardRemote.mockReset();
    mockedConnectKeyboardRemote.mockReturnValue({ disconnect: vi.fn() });
    mockedConnectGamepadRemote.mockReturnValue({ disconnect: vi.fn() });
    mockedUseWatchRemoteHost.mockReturnValue({ ...inactiveWatchRemoteResult, start: vi.fn(), stop: vi.fn() });
    cloudServiceMock.searchGlobalPlayers.mockResolvedValue(testPlayers);
    cloudServiceMock.createGlobalPlayerDocument.mockResolvedValue(testPlayers[0]);
    cloudServiceMock.completeCloudSessionMatch.mockResolvedValue(undefined);
    cloudServiceMock.importMappedLegacySessions.mockResolvedValue(undefined);
    cloudServiceMock.loadCloudHistoryStats.mockResolvedValue({ sessions: [], players: [], pairs: [], matchups: [] });
    cloudServiceMock.saveCloudSession.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('awards a point to Team A from the court score', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /award point to team a, score 0/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('1');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
    expect(screen.queryByText(/serving: team a/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/server: player 1/i)).not.toBeInTheDocument();
    expect(screen.getByText('Player 1').closest('.player-chip')).toHaveClass('active-server');
  });

  it('keeps setup and session controls out of the main match controls', () => {
    render(<App />);

    const controls = screen.getByRole('region', { name: /match controls/i });
    expect(within(controls).getByRole('button', { name: /undo last point/i })).toBeInTheDocument();
    expect(within(controls).getByRole('button', { name: /announce score/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /team a player 1 name/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /match mode/i })).not.toBeInTheDocument();
    expect(within(controls).queryByRole('button', { name: /new match/i })).not.toBeInTheDocument();
    expect(within(controls).queryByRole('button', { name: /session mode/i })).not.toBeInTheDocument();
  });

  it('renders the account control in the global app chrome', () => {
    authMock.useAuth.mockReturnValue({
      user: null as unknown as { uid: string; isAnonymous: boolean },
      loading: false,
      isAnonymous: false,
      authUnavailable: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    render(<App />);

    expect(screen.getByRole('button', { name: /account menu, sign in with google/i })).toBeInTheDocument();
  });

  it('opens match settings from the app settings menu', async () => {
    const user = userEvent.setup();
    render(<App />);

    await openMatchSettings(user);

    expect(screen.getByRole('dialog', { name: /match settings/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /match mode/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /team a player 1 name/i })).toHaveValue('Player 1');
  });

  it('returns focus to the settings menu button after closing a settings modal', async () => {
    const user = userEvent.setup();
    render(<App />);

    const settingsButton = screen.getByRole('button', { name: /settings menu/i });
    await openMatchSettings(user);
    await user.click(screen.getByRole('button', { name: /close match settings/i }));

    expect(settingsButton).toHaveFocus();
  });

  it('starts session setup from the app settings menu', async () => {
    const user = userEvent.setup();
    render(<App />);

    await chooseSettingsAction(user, /session mode/i);

    expect(screen.getByRole('heading', { name: /session setup/i })).toBeInTheDocument();
  });

  it('clears player search results when cloud player search is denied', async () => {
    const user = userEvent.setup();
    cloudServiceMock.searchGlobalPlayers
      .mockResolvedValueOnce(testPlayers)
      .mockRejectedValueOnce(new Error('Missing or insufficient permissions.'));
    render(<App />);

    await chooseSettingsAction(user, /session mode/i);
    await user.type(screen.getByRole('textbox', { name: /player search/i }), 'a');
    expect(await screen.findByRole('button', { name: /add alice/i })).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /player search/i }), 'b');

    await waitFor(() => expect(screen.queryByRole('button', { name: /add alice/i })).not.toBeInTheDocument());
  });

  it('does not query cloud players from stale session setup when anonymous', async () => {
    const savedSession = {
      id: 'session-stale',
      startedAt: '2026-01-01T10:00:00.000Z',
      players: testPlayers.map((player) => ({
        id: player.id,
        displayName: player.displayName,
        gamesPlayed: 0,
        consecutiveStreak: 0,
        onBreak: false,
      })),
      matches: [],
      pairingMatrix: { together: {}, against: {} },
    };
    vi.spyOn(sessionStorageModule, 'loadActiveSession').mockReturnValue(savedSession);
    authMock.useAuth.mockReturnValue({
      user: { uid: 'anon-uid', isAnonymous: true },
      loading: false,
      isAnonymous: true,
      authUnavailable: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /edit players/i }));
    await user.type(screen.getByRole('textbox', { name: /player search/i }), 'a');

    expect(cloudServiceMock.searchGlobalPlayers).not.toHaveBeenCalled();
  });

  it('shows a sign-in prompt instead of session setup when not signed in', async () => {
    authMock.useAuth.mockReturnValue({
      user: null as unknown as { uid: string; isAnonymous: boolean },
      loading: false,
      isAnonymous: false,
      authUnavailable: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    const user = userEvent.setup();
    render(<App />);

    await chooseSettingsAction(user, /session mode/i);

    expect(screen.queryByRole('heading', { name: /session setup/i })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /sign in required/i })).toBeInTheDocument();
  });

  it('hides New match from the settings menu during a session match', async () => {
    const user = userEvent.setup();
    render(<App />);

    await startSessionMatch(user);
    await openSettingsMenu(user);

    expect(within(screen.getByLabelText(/settings menu tools/i)).queryByRole('menuitem', { name: /new match/i })).not.toBeInTheDocument();
  });

  it('awards a point to Team B from the court score and changes server', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /award point to team b, score 0/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('0');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('1');
    expect(screen.queryByText(/serving: team b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/server: player 4/i)).not.toBeInTheDocument();
    expect(screen.getByText('Player 4').closest('.player-chip')).toHaveClass('active-server');
  });

  it('undo can restore multiple previous scores', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));
    await user.click(screen.getByRole('button', { name: /award point to team b, score 0/i }));
    await user.click(screen.getByRole('button', { name: /undo last point/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('1');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');

    await user.click(screen.getByRole('button', { name: /undo last point/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('0');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
    expect(screen.getByText('Player 1').closest('.player-chip')).toHaveClass('active-server');
  });

  it('connects keyboard remote input on mount and disconnects on unmount', () => {
    const connection: KeyboardRemoteConnection = { disconnect: vi.fn() };
    mockedConnectKeyboardRemote.mockReturnValue(connection);

    const { unmount } = render(<App />);

    expect(mockedConnectKeyboardRemote).toHaveBeenCalledTimes(1);
    unmount();
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });

  it('shows the latest keyboard remote diagnostic events', async () => {
    const user = userEvent.setup();
    let emitDiagnosticEvent: (event: KeyboardRemoteDiagnosticEvent) => void = () => undefined;
    mockedConnectKeyboardRemote.mockImplementation((options) => {
      emitDiagnosticEvent = options.onDiagnosticEvent ?? (() => undefined);
      return { disconnect: vi.fn() };
    });

    render(<App />);
    await openDiagnostics(user);

    expect(screen.getByText(/no events seen yet/i)).toBeInTheDocument();

    act(() => {
      emitDiagnosticEvent({
        type: 'keydown',
        key: 'Camera',
        code: 'F24',
        keyCode: 135,
        which: 135,
        repeat: false,
      });
    });

    expect(screen.getByText(/keydown/i)).toBeInTheDocument();
    expect(screen.getByText(/key camera/i)).toBeInTheDocument();
    expect(screen.getByText(/code f24/i)).toBeInTheDocument();
    expect(screen.getByText(/keycode 135/i)).toBeInTheDocument();
  });

  it('shows Bluetooth unsupported fallback and disables connect', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openRemoteControls(user);

    expect(screen.getByText(/android chrome required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect bluetooth remote/i })).toBeDisabled();
  });

  it('speaks only after scoring when auto announce is enabled from saved preferences', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ autoAnnounce: true, matchMode: 'doubles' }));
    render(<App />);

    mockedSpeakAnnouncement.mockClear();

    await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));

    expect(mockedSpeakAnnouncement).toHaveBeenCalledTimes(1);
    expect(mockedSpeakAnnouncement.mock.calls[0][0].score).toEqual({ teamA: 1, teamB: 0 });
    expect(mockedSpeakAnnouncement.mock.calls[0][1]).toBe('full');
  });

  it('uses saved short announcement mode for manual and auto announcements', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ autoAnnounce: true, announcementMode: 'short', matchMode: 'doubles' }),
    );
    render(<App />);

    await user.click(screen.getByRole('button', { name: /announce score/i }));
    expect(mockedSpeakAnnouncement).toHaveBeenLastCalledWith(expect.anything(), 'short');

    await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));

    expect(mockedSpeakAnnouncement).toHaveBeenLastCalledWith(expect.objectContaining({ score: { teamA: 1, teamB: 0 } }), 'short');
  });

  it('auto announces once for one scoring action under StrictMode', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ autoAnnounce: true, matchMode: 'doubles' }));

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));

    await waitFor(() => expect(mockedSpeakAnnouncement).toHaveBeenCalledTimes(1));
    expect(mockedSpeakAnnouncement.mock.calls[0][0].score).toEqual({ teamA: 1, teamB: 0 });
  });

  it('connects a supported Bluetooth remote and shows connected status', async () => {
    const user = userEvent.setup();
    mockedGetBluetoothSupportStatus.mockReturnValue('disconnected');
    mockedConnectBluetoothRemote.mockImplementation(async ({ onStatusChange }) => {
      onStatusChange('connecting');
      onStatusChange('connected');
      return { disconnect: vi.fn() };
    });

    render(<App />);
    await openRemoteControls(user);

    await user.click(screen.getByRole('button', { name: /connect bluetooth remote/i }));

    expect(mockedConnectBluetoothRemote).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/bluetooth connected/i)).toBeInTheDocument();
  });

  it('disconnects a late Bluetooth connection when unmounted during pending connect', async () => {
    const user = userEvent.setup();
    const connection: BluetoothRemoteConnection = { disconnect: vi.fn() };
    let resolveConnection: (connection: BluetoothRemoteConnection) => void = () => undefined;
    mockedGetBluetoothSupportStatus.mockReturnValue('disconnected');
    mockedConnectBluetoothRemote.mockImplementation(
      () => new Promise((resolve) => {
        resolveConnection = resolve;
      }),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { unmount } = render(<App />);
    await openRemoteControls(user);
    await user.click(screen.getByRole('button', { name: /connect bluetooth remote/i }));
    unmount();
    resolveConnection(connection);

    await waitFor(() => expect(connection.disconnect).toHaveBeenCalledTimes(1));
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('disconnects an older late Bluetooth connection when a newer attempt supersedes it', async () => {
    const user = userEvent.setup();
    const oldConnection: BluetoothRemoteConnection = { disconnect: vi.fn() };
    const newConnection: BluetoothRemoteConnection = { disconnect: vi.fn() };
    const resolvers: Array<(connection: BluetoothRemoteConnection) => void> = [];
    mockedGetBluetoothSupportStatus.mockReturnValue('disconnected');
    mockedConnectBluetoothRemote.mockImplementation(
      () => new Promise((resolve) => {
        resolvers.push(resolve);
      }),
    );

    render(<App />);
    await openRemoteControls(user);
    const connectButton = screen.getByRole('button', { name: /connect bluetooth remote/i });

    await user.click(connectButton);
    await user.click(connectButton);
    resolvers[1](newConnection);
    resolvers[0](oldConnection);

    await waitFor(() => expect(oldConnection.disconnect).toHaveBeenCalledTimes(1));
    expect(newConnection.disconnect).not.toHaveBeenCalled();
  });

  it('marks the selected match mode for assistive technology in match settings', async () => {
    const user = userEvent.setup();
    render(<App />);

    await openMatchSettings(user);

    expect(screen.getByRole('button', { name: /doubles/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /doubles/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /singles/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not reset when the selected match mode is tapped again', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));
    await openMatchSettings(user);
    await user.click(screen.getByRole('button', { name: /doubles/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('1');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
  });

  it('requires confirmation before changing mode after scoring starts', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);

    await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));
    await openMatchSettings(user);
    await user.click(screen.getByRole('button', { name: /singles/i }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('score-teamA')).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /doubles/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('starts a new match from an explicit confirmed control', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));
    await chooseSettingsAction(user, /new match/i);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('score-teamA')).toHaveTextContent('0');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
  });

  it('hides one-off match setup controls while playing a session match', async () => {
    const user = userEvent.setup();
    render(<App />);

    await startSessionMatch(user);

    const controls = screen.getByRole('region', { name: /match controls/i });
    expect(within(controls).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(controls).queryByRole('group', { name: /match mode/i })).not.toBeInTheDocument();
    expect(within(controls).queryByRole('button', { name: /new match/i })).not.toBeInTheDocument();
    expect(within(controls).queryByRole('button', { name: /session mode/i })).not.toBeInTheDocument();
  });

  it('locks match settings controls while playing a session match', async () => {
    const user = userEvent.setup();
    render(<App />);

    await startSessionMatch(user);
    await openMatchSettings(user);

    expect(screen.getByText(/session match settings are locked/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /doubles/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /singles/i })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /team a player 1 name/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /reroll first server/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /team b .* serves/i })).toBeDisabled();
  });

  it('returns an unstarted session match to the suggestion screen', async () => {
    const user = userEvent.setup();
    render(<App />);

    await startSessionMatch(user);
    await user.click(screen.getByRole('button', { name: /back to suggestion/i }));

    expect(screen.getByRole('region', { name: /next match/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start match/i })).toBeInTheDocument();
  });

  it('keeps end session but hides back to suggestion after a session rally starts', async () => {
    const user = userEvent.setup();
    render(<App />);

    await startSessionMatch(user);
    await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));

    const controls = screen.getByRole('region', { name: /match controls/i });
    expect(within(controls).queryByRole('button', { name: /back to suggestion/i })).not.toBeInTheDocument();
    expect(within(controls).getByRole('button', { name: /end session/i })).toBeInTheDocument();
  });

  it('shows completed session match history on suggestion and live screens by default', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-05-17T10:00:00.000Z'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await startSessionMatch(user);
    vi.setSystemTime(new Date('2026-05-17T10:12:00.000Z'));
    for (let i = 0; i < 21; i++) {
      await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));
    }
    await user.click(screen.getByRole('button', { name: /next match/i }));

    const suggestionHistory = screen.getByRole('region', { name: /session match history/i });
    expect(suggestionHistory).toHaveTextContent('Match 1');
    expect(suggestionHistory).toHaveTextContent('21-0');
    expect(suggestionHistory).toHaveTextContent('12 min');

    await user.click(screen.getByRole('button', { name: /start match/i }));

    const liveHistory = screen.getByRole('region', { name: /session match history/i });
    expect(liveHistory).toHaveTextContent('Match 1');
    expect(liveHistory).toHaveTextContent(/won/i);
    expect(liveHistory).toHaveTextContent('21-0');
    expect(liveHistory).toHaveTextContent('12 min');
  });

  it('calls completeCloudSessionMatch with uid and matchRecord when a session match ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-05-17T10:00:00.000Z'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    authMock.useAuth.mockReturnValue({
      user: { uid: 'uid-1', isAnonymous: false },
      loading: false,
      isAnonymous: false,
      authUnavailable: false,
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
    });
    cloudServiceMock.completeCloudSessionMatch.mockClear();
    render(<App />);

    await startSessionMatch(user);
    for (let i = 0; i < 21; i++) {
      await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));
    }
    await user.click(screen.getByRole('button', { name: /next match/i }));

    await waitFor(() => expect(cloudServiceMock.completeCloudSessionMatch).toHaveBeenCalledTimes(1));
    expect(cloudServiceMock.completeCloudSessionMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'uid-1',
        matchRecord: expect.objectContaining({ winnerTeam: 'teamA' }),
      }),
    );
  });

  it('hides live session match history when disabled in display settings', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-05-17T10:00:00.000Z'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);

    await startSessionMatch(user);
    vi.setSystemTime(new Date('2026-05-17T10:12:00.000Z'));
    for (let i = 0; i < 21; i++) {
      await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));
    }
    await user.click(screen.getByRole('button', { name: /next match/i }));
    expect(screen.getByRole('region', { name: /session match history/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /start match/i }));
    expect(screen.getByRole('region', { name: /session match history/i })).toBeInTheDocument();

    await openDisplaySettings(user);
    await user.click(screen.getByRole('switch', { name: /show session match history/i }));

    expect(screen.queryByRole('region', { name: /session match history/i })).not.toBeInTheDocument();
  });

  it('stays in the session when ending a session is cancelled', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);

    await startSessionMatch(user);
    await user.click(screen.getByRole('button', { name: /end session/i }));

    expect(confirm).toHaveBeenCalledWith('End the current session?');
    expect(screen.getByRole('button', { name: /back to suggestion/i })).toBeInTheDocument();
    expect(screen.getByText('Alice').closest('.player-chip')).toBeInTheDocument();
  });

  it('confirms ending a session and resets to a fresh match', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    await startSessionMatch(user);
    await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));
    await user.click(screen.getByRole('button', { name: /end session/i }));

    expect(confirm).toHaveBeenCalledWith('End the current session?');
    expect(screen.getByTestId('score-teamA')).toHaveTextContent('0');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
    await openSettingsMenu(user);
    expect(within(screen.getByLabelText(/settings menu tools/i)).getByRole('menuitem', { name: /session mode/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /end session/i })).not.toBeInTheDocument();
    expect(screen.getByText('Player 1').closest('.player-chip')).toHaveClass('active-server');
  });

  it('allows first server adjustment before scoring starts', async () => {
    const user = userEvent.setup();
    render(<App />);

    await openMatchSettings(user);
    await user.click(screen.getByRole('button', { name: /team b player 3 serves/i }));

    expect(screen.getByText('Player 3').closest('.player-chip')).toHaveClass('active-server');
  });

  it('hides first server setup after scoring starts', async () => {
    const user = userEvent.setup();
    render(<App />);

    await openMatchSettings(user);
    expect(screen.getByRole('group', { name: /first server setup/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close match settings/i }));

    await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));
    await openMatchSettings(user);

    expect(screen.queryByRole('group', { name: /first server setup/i })).not.toBeInTheDocument();
  });

  it('disables scoring after a winner while leaving undo available', async () => {
    const user = userEvent.setup();
    render(<App />);

    for (let point = 0; point < 21; point += 1) {
      await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));
    }

    expect(screen.getByRole('button', { name: /award point to team a, score 21/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /award point to team b, score 0/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /undo last point/i })).toBeEnabled();
  });

  // Remote input log
  it('prefixes keyboard events with [key] in the remote input log', async () => {
    const user = userEvent.setup();
    let emitDiagnosticEvent: (event: KeyboardRemoteDiagnosticEvent) => void = () => undefined;
    mockedConnectKeyboardRemote.mockImplementation((options) => {
      emitDiagnosticEvent = options.onDiagnosticEvent ?? (() => undefined);
      return { disconnect: vi.fn() };
    });

    render(<App />);
    await openDiagnostics(user);

    act(() => {
      emitDiagnosticEvent({ type: 'keydown', key: 'VolumeUp', code: 'VolumeUp', keyCode: 175, which: 175, repeat: false });
    });

    expect(screen.getByText(/\[key\] keydown/i)).toBeInTheDocument();
  });

  it('connects gamepad remote on mount and disconnects on unmount', () => {
    const connection: GamepadRemoteConnection = { disconnect: vi.fn() };
    mockedConnectGamepadRemote.mockReturnValue(connection);

    const { unmount } = render(<App />);

    expect(mockedConnectGamepadRemote).toHaveBeenCalledTimes(1);
    unmount();
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });

  it('shows gamepad diagnostic events with [gamepad] prefix, pad index, and button index', async () => {
    const user = userEvent.setup();
    let emitDiagnosticEvent: (event: GamepadRemoteDiagnosticEvent) => void = () => undefined;
    mockedConnectGamepadRemote.mockImplementation((options) => {
      emitDiagnosticEvent = options.onDiagnosticEvent ?? (() => undefined);
      return { disconnect: vi.fn() };
    });

    render(<App />);
    await openDiagnostics(user);

    act(() => {
      emitDiagnosticEvent({ source: 'gamepad', type: 'press', gamepadIndex: 0, gamepadId: 'Generic Controller', buttonIndex: 2 });
    });

    expect(screen.getByText(/\[gamepad\] press/i)).toBeInTheDocument();
    expect(screen.getByText(/pad 0/i)).toBeInTheDocument();
    expect(screen.getByText(/btn 2/i)).toBeInTheDocument();
  });

  // Player names
  it('shows default player names in the match settings inputs before a match starts', async () => {
    const user = userEvent.setup();
    render(<App />);

    await openMatchSettings(user);

    expect(screen.getByRole('textbox', { name: /team a player 1 name/i })).toHaveValue('Player 1');
    expect(screen.getByRole('textbox', { name: /team b player 1 name/i })).toHaveValue('Player 3');
  });

  it('persists an edited player name to local storage from match settings', async () => {
    const user = userEvent.setup();
    render(<App />);

    await openMatchSettings(user);
    fireEvent.change(screen.getByRole('textbox', { name: /team a player 1 name/i }), {
      target: { value: 'Alice' },
    });

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      playerNames: { A1: 'Alice' },
    });
  });

  it('loads saved player names from storage and shows them in match settings on startup', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ playerNames: { A1: 'Alice', A2: 'Bob', B1: 'Carol', B2: 'Dave' } }),
    );

    render(<App />);

    await openMatchSettings(user);

    expect(screen.getByRole('textbox', { name: /team a player 1 name/i })).toHaveValue('Alice');
    expect(screen.getByRole('textbox', { name: /team a player 2 name/i })).toHaveValue('Bob');
    expect(screen.getByRole('textbox', { name: /team b player 1 name/i })).toHaveValue('Carol');
    expect(screen.getByRole('textbox', { name: /team b player 2 name/i })).toHaveValue('Dave');
  });

  it('reflects an edited player name in the court player chip immediately', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('Player 1').closest('.player-chip')).toHaveClass('active-server');

    await openMatchSettings(user);
    fireEvent.change(screen.getByRole('textbox', { name: /team a player 1 name/i }), {
      target: { value: 'Alice' },
    });

    expect(screen.getByText('Alice').closest('.player-chip')).toHaveClass('active-server');
  });

  it('uses player names from storage when starting a new match', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ playerNames: { A1: 'Alice', A2: 'Bob', B1: 'Carol', B2: 'Dave' } }));

    render(<App />);

    await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));
    await chooseSettingsAction(user, /new match/i);

    expect(confirm).toHaveBeenCalledTimes(1);
    await openMatchSettings(user);
    expect(screen.getByRole('textbox', { name: /team a player 1 name/i })).toHaveValue('Alice');
    expect(screen.getByText('Alice').closest('.player-chip')).toHaveClass('active-server');
  });

  // Watch remote hosting
  it('renders and scores normally without invoking Firebase (useWatchRemoteHost not started)', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('1');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
    // Hook was called but start() was never invoked — Firebase methods untouched
    expect(mockedUseWatchRemoteHost).toHaveBeenCalled();
    expect(inactiveWatchRemoteResult.start).not.toHaveBeenCalled();
  });

  it('does not call start on useWatchRemoteHost before the user triggers it', () => {
    render(<App />);

    // The hook is wired in but start() must not be called automatically
    const calls = mockedUseWatchRemoteHost.mock.results;
    for (const result of calls) {
      if (result.type === 'return') {
        expect(result.value.start).not.toHaveBeenCalled();
      }
    }
  });

  it('shows the watch remote panel with a room code when the hook reports active', async () => {
    const user = userEvent.setup();
    mockedUseWatchRemoteHost.mockReturnValue({
      status: 'active',
      code: 'ABC123',
      error: undefined,
      lastCommandLabel: undefined,
      start: vi.fn(),
      stop: vi.fn(),
    });

    render(<App />);
    await openRemoteControls(user);

    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  // Remote controls and diagnostics are modal-only
  it('does not show Bluetooth status or connect button on the main screen', () => {
    render(<App />);

    expect(screen.queryByRole('button', { name: /connect bluetooth remote/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/android chrome required/i)).not.toBeInTheDocument();
  });

  it('does not show the diagnostics log on the main screen', () => {
    render(<App />);

    expect(screen.queryByText(/no events seen yet/i)).not.toBeInTheDocument();
  });

  it('does not show the watch remote panel on the main screen', () => {
    mockedUseWatchRemoteHost.mockReturnValue({
      status: 'active',
      code: 'ABC123',
      error: undefined,
      lastCommandLabel: undefined,
      start: vi.fn(),
      stop: vi.fn(),
    });

    render(<App />);

    expect(screen.queryByText('ABC123')).not.toBeInTheDocument();
  });

  // Announcement settings modal
  it('does not show auto announce toggle on the main screen', () => {
    render(<App />);

    expect(screen.queryByRole('switch', { name: /auto announce/i })).not.toBeInTheDocument();
  });

  it('opens announcement settings modal from the app settings menu', async () => {
    const user = userEvent.setup();
    render(<App />);

    await openAnnouncementSettings(user);

    const dialog = screen.getByRole('dialog', { name: /announcement settings/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /auto announce/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /full announcement/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /short announcement/i })).toBeInTheDocument();
    expect(within(dialog).getByText(/speech ready/i)).toBeInTheDocument();
  });

  it('toggles auto announce from the announcement settings modal', async () => {
    const user = userEvent.setup();
    render(<App />);

    await openAnnouncementSettings(user);
    await user.click(screen.getByRole('switch', { name: /auto announce/i }));

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ autoAnnounce: true });
  });

  it('changes announcement mode to short from the announcement settings modal', async () => {
    const user = userEvent.setup();
    render(<App />);

    await openAnnouncementSettings(user);
    await user.click(screen.getByRole('button', { name: /short announcement/i }));

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ announcementMode: 'short' });
  });

  // Display settings modal
  it('does not show animations toggle on the main screen', () => {
    render(<App />);

    expect(screen.queryByRole('switch', { name: /animations/i })).not.toBeInTheDocument();
  });

  it('opens display settings modal from the app settings menu', async () => {
    const user = userEvent.setup();
    render(<App />);

    await openDisplaySettings(user);

    expect(screen.getByRole('dialog', { name: /display settings/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /animations/i })).toBeInTheDocument();
  });

  it('toggles animations from the display settings modal', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ animationsEnabled: true }));
    render(<App />);

    await openDisplaySettings(user);
    await user.click(screen.getByRole('switch', { name: /animations/i }));

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ animationsEnabled: false });
  });

  it('shows import prompt when there are unimported sessions for signed-in user', async () => {
    const archivedSession = {
      id: 'session-abc',
      startedAt: '2026-01-01T10:00:00.000Z',
      endedAt: '2026-01-01T12:00:00.000Z',
      players: [{ id: 'legacy-local-player-1', displayName: 'OldAlice', gamesPlayed: 3, breaksTaken: 0 }],
      matches: [],
    };
    vi.spyOn(sessionStorageModule, 'loadSessionArchive').mockReturnValue([archivedSession]);
    vi.spyOn(sessionStorageModule, 'isSessionImportedForUser').mockReturnValue(false);

    render(<App />);

    expect(await screen.findByText(/import your session history/i)).toBeInTheDocument();
  });

  it('shows import prompt for older name-only local session players', async () => {
    const archivedSession = {
      id: 'session-legacy',
      startedAt: '2026-01-01T10:00:00.000Z',
      endedAt: '2026-01-01T12:00:00.000Z',
      players: [{ name: 'OldAlice', gamesPlayed: 3, consecutiveStreak: 0, onBreak: false }],
      matches: [],
    };
    vi.spyOn(sessionStorageModule, 'loadSessionArchive').mockReturnValue([archivedSession as never]);
    vi.spyOn(sessionStorageModule, 'isSessionImportedForUser').mockReturnValue(false);

    render(<App />);

    expect(await screen.findByRole('button', { name: /map oldalice/i })).toBeInTheDocument();
  });

  it('uploads mapped legacy sessions before marking them imported', async () => {
    const user = userEvent.setup();
    const archivedSession = {
      id: 'session-abc',
      startedAt: '2026-01-01T10:00:00.000Z',
      endedAt: '2026-01-01T12:00:00.000Z',
      players: [{ id: 'legacy-local-player-1', displayName: 'OldAlice', gamesPlayed: 1, breaksTaken: 0 }],
      matches: [],
    };
    vi.spyOn(sessionStorageModule, 'loadSessionArchive').mockReturnValue([archivedSession]);
    vi.spyOn(sessionStorageModule, 'isSessionImportedForUser').mockReturnValue(false);
    const markImported = vi.spyOn(sessionStorageModule, 'markSessionImportedForUser');

    render(<App />);

    await user.click(await screen.findByRole('button', { name: /map oldalice/i }));
    await user.type(screen.getByRole('textbox', { name: /search for player/i }), 'Alice');
    await user.click(await screen.findByRole('button', { name: /select alice/i }));
    await user.click(screen.getByRole('button', { name: /import sessions/i }));

    await waitFor(() => expect(cloudServiceMock.importMappedLegacySessions).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'google-uid',
        sessions: [archivedSession],
        mapping: expect.any(Map),
      }),
    ));
    await waitFor(() => expect(markImported).toHaveBeenCalledWith('google-uid', 'session-abc'));
  });

  it('loads cloud-backed history stats from the service', async () => {
    const user = userEvent.setup();
    const stats: CloudHistoryStats = {
      sessions: [{ id: 'session-1', startedAt: '2026-01-01T10:00:00.000Z', matchCount: 3 }],
      players: [{ id: 'p1', displayName: 'Alice', elo: 1602, matchesPlayed: 3, winRate: 0.67, recentForm: ['W', 'L', 'W'] }],
      pairs: [{ id: 'p1__p2', displayNames: ['Alice', 'Bob'], elo: 1530, matchesPlayed: 2, winRate: 1 }],
      matchups: [{ id: 'p1__vs__p3', players: ['Alice', 'Carol'], matchesPlayed: 2, wins: 1, losses: 1 }],
    };
    cloudServiceMock.loadCloudHistoryStats.mockResolvedValue(stats);

    render(<App />);

    await chooseSettingsAction(user, /history & stats/i);
    await waitFor(() => expect(cloudServiceMock.loadCloudHistoryStats).toHaveBeenCalledWith({ uid: 'google-uid' }));
    await user.click(screen.getByRole('tab', { name: /players/i }));

    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('1602')).toBeInTheDocument();
  });
});
