import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { connectBluetoothRemote, getBluetoothSupportStatus } from './input/bluetoothRemote';
import { connectKeyboardRemote } from './input/keyboardRemote';
import { speakAnnouncement } from './speech/announcer';
import type { BluetoothRemoteConnection } from './input/bluetoothRemote';
import type { KeyboardRemoteConnection } from './input/keyboardRemote';

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

const STORAGE_KEY = 'badminton-scorer-preferences';
const mockedSpeakAnnouncement = vi.mocked(speakAnnouncement);
const mockedGetBluetoothSupportStatus = vi.mocked(getBluetoothSupportStatus);
const mockedConnectBluetoothRemote = vi.mocked(connectBluetoothRemote);
const mockedConnectKeyboardRemote = vi.mocked(connectKeyboardRemote);

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedSpeakAnnouncement.mockClear();
    mockedGetBluetoothSupportStatus.mockReturnValue('unsupported');
    mockedConnectBluetoothRemote.mockReset();
    mockedConnectKeyboardRemote.mockReset();
    mockedConnectKeyboardRemote.mockReturnValue({ disconnect: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('awards a point to Team A from the Team A score', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Team A score/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('1');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
    expect(screen.getByText(/serving: Team A/i)).toBeInTheDocument();
    expect(screen.getByText(/server: Player 1/i)).toBeInTheDocument();
  });

  it('awards a point to Team B from the Team B score and changes server', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Team B score/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('0');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('1');
    expect(screen.getByText(/serving: Team B/i)).toBeInTheDocument();
    expect(screen.getByText(/server: Player 4/i)).toBeInTheDocument();
  });

  it('undo restores the previous score', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Team A score/i }));
    await user.click(screen.getByRole('button', { name: /undo last point/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('0');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
    expect(screen.getByText(/serving: Team A/i)).toBeInTheDocument();
  });

  it('connects keyboard remote input on mount and disconnects on unmount', () => {
    const connection: KeyboardRemoteConnection = { disconnect: vi.fn() };
    mockedConnectKeyboardRemote.mockReturnValue(connection);

    const { unmount } = render(<App />);

    expect(mockedConnectKeyboardRemote).toHaveBeenCalledTimes(1);
    unmount();
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });

  it('shows Bluetooth unsupported fallback and disables connect', () => {
    render(<App />);

    expect(screen.getByText(/android chrome required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect bluetooth remote/i })).toBeDisabled();
  });

  it('persists auto announce and speaks only after scoring when enabled', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Team A score/i }));
    expect(mockedSpeakAnnouncement).not.toHaveBeenCalled();

    await user.click(screen.getByRole('switch', { name: /auto announce/i }));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ autoAnnounce: true });

    await user.click(screen.getByRole('button', { name: /Team A score/i }));

    expect(mockedSpeakAnnouncement).toHaveBeenCalledTimes(1);
    expect(mockedSpeakAnnouncement.mock.calls[0][0].score).toEqual({ teamA: 2, teamB: 0 });
  });

  it('auto announces once for one scoring action under StrictMode', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ autoAnnounce: true, matchMode: 'doubles' }));

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await user.click(screen.getByRole('button', { name: /Team A score/i }));

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

  it('marks the selected match mode for assistive technology', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /doubles/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /doubles/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /singles/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not reset when the selected match mode is tapped again', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Team A score/i }));
    await user.click(screen.getByRole('button', { name: /doubles/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('1');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
  });

  it('requires confirmation before changing mode after scoring starts', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Team A score/i }));
    await user.click(screen.getByRole('button', { name: /singles/i }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('score-teamA')).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /doubles/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('starts a new match from an explicit confirmed control', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Team A score/i }));
    await user.click(screen.getByRole('button', { name: /new match/i }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('score-teamA')).toHaveTextContent('0');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
  });

  it('allows first server adjustment before scoring starts', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /team b player 3 serves/i }));

    expect(screen.getByText(/serving: Team B/i)).toBeInTheDocument();
    expect(screen.getByText(/server: Player 3/i)).toBeInTheDocument();
  });

  it('hides first server setup after scoring starts', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('group', { name: /first server setup/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Team A score/i }));

    expect(screen.queryByRole('group', { name: /first server setup/i })).not.toBeInTheDocument();
  });

  it('disables scoring after a winner while leaving undo available', async () => {
    const user = userEvent.setup();
    render(<App />);

    for (let point = 0; point < 21; point += 1) {
      await user.click(screen.getByRole('button', { name: /Team A score/i }));
    }

    expect(screen.getByRole('button', { name: /Team A score/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Team B score/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /undo last point/i })).toBeEnabled();
  });
});
