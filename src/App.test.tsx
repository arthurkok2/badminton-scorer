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
import type { BluetoothRemoteConnection } from './input/bluetoothRemote';
import type { GamepadRemoteConnection, GamepadRemoteDiagnosticEvent } from './input/gamepadRemote';
import type { KeyboardRemoteConnection, KeyboardRemoteDiagnosticEvent } from './input/keyboardRemote';

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

async function startSessionMatch(user: ReturnType<typeof userEvent.setup>) {
  await chooseSettingsAction(user, /session mode/i);

  for (const name of ['Alice', 'Bob', 'Carol', 'Dave']) {
    await user.clear(screen.getByLabelText(/player name/i));
    await user.type(screen.getByLabelText(/player name/i), name);
    await user.click(screen.getByRole('button', { name: /^add$/i }));
  }

  await user.click(screen.getByRole('button', { name: /start session/i }));
  await user.click(screen.getByRole('button', { name: /start match/i }));
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    authMock.useAuth.mockReturnValue({
      user: { uid: 'anon', isAnonymous: true },
      loading: false,
      isAnonymous: true,
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('shows the latest keyboard remote diagnostic events', () => {
    let emitDiagnosticEvent: (event: KeyboardRemoteDiagnosticEvent) => void = () => undefined;
    mockedConnectKeyboardRemote.mockImplementation((options) => {
      emitDiagnosticEvent = options.onDiagnosticEvent ?? (() => undefined);
      return { disconnect: vi.fn() };
    });

    render(<App />);

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

  it('shows Bluetooth unsupported fallback and disables connect', () => {
    render(<App />);

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
  it('prefixes keyboard events with [key] in the remote input log', () => {
    let emitDiagnosticEvent: (event: KeyboardRemoteDiagnosticEvent) => void = () => undefined;
    mockedConnectKeyboardRemote.mockImplementation((options) => {
      emitDiagnosticEvent = options.onDiagnosticEvent ?? (() => undefined);
      return { disconnect: vi.fn() };
    });

    render(<App />);

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

  it('shows gamepad diagnostic events with [gamepad] prefix, pad index, and button index', () => {
    let emitDiagnosticEvent: (event: GamepadRemoteDiagnosticEvent) => void = () => undefined;
    mockedConnectGamepadRemote.mockImplementation((options) => {
      emitDiagnosticEvent = options.onDiagnosticEvent ?? (() => undefined);
      return { disconnect: vi.fn() };
    });

    render(<App />);

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

  it('shows the watch remote panel with a room code when the hook reports active', () => {
    mockedUseWatchRemoteHost.mockReturnValue({
      status: 'active',
      code: 'ABC123',
      error: undefined,
      lastCommandLabel: undefined,
      start: vi.fn(),
      stop: vi.fn(),
    });

    render(<App />);

    expect(screen.getByText('ABC123')).toBeInTheDocument();
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
});
