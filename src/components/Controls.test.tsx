import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Controls } from './Controls';
import { awardPointToServingTeam, createMatch } from '../domain/matchEngine';
import { DEFAULT_PLAYER_NAMES } from '../preferences';
import type { MatchState, PlayerId, TeamId } from '../domain/matchTypes';

const defaultMatch = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });

function renderControls(overrides?: {
  match?: MatchState;
  matchMode?: 'singles' | 'doubles';
  playerNames?: Record<PlayerId, string>;
  onPlayerNameChange?: (playerId: PlayerId, name: string) => void;
  onSetInitialServer?: (teamId: TeamId, playerId: PlayerId) => void;
  onStartSessionMode?: () => void;
  showMatchSetupControls?: boolean;
  showNewMatchControl?: boolean;
  showSessionModeControl?: boolean;
  showBackToSessionSuggestion?: boolean;
  onBackToSessionSuggestion?: () => void;
  onEndSession?: () => void;
  announcementMode?: 'full' | 'short';
  onAnnouncementModeChange?: (mode: 'full' | 'short') => void;
  animationsEnabled?: boolean;
  onAnimationsEnabledChange?: (enabled: boolean) => void;
}) {
  const props = {
    match: overrides?.match ?? defaultMatch,
    autoAnnounce: false,
    announcementMode: overrides?.announcementMode ?? 'full',
    matchMode: overrides?.matchMode ?? 'doubles',
    playerNames: overrides?.playerNames ?? { ...DEFAULT_PLAYER_NAMES },
    animationsEnabled: overrides?.animationsEnabled ?? true,
    onUndo: vi.fn(),
    onAnnounce: vi.fn(),
    onAutoAnnounceChange: vi.fn(),
    onAnimationsEnabledChange: overrides?.onAnimationsEnabledChange ?? vi.fn(),
    onAnnouncementModeChange: overrides?.onAnnouncementModeChange ?? vi.fn(),
    onMatchModeChange: vi.fn(),
    onNewMatch: vi.fn(),
    onSetInitialServer: overrides?.onSetInitialServer ?? vi.fn(),
    onRerollFirstServer: vi.fn(),
    onPlayerNameChange: overrides?.onPlayerNameChange ?? vi.fn(),
    onStartSessionMode: overrides?.onStartSessionMode ?? vi.fn(),
    showMatchSetupControls: overrides?.showMatchSetupControls,
    showNewMatchControl: overrides?.showNewMatchControl,
    showSessionModeControl: overrides?.showSessionModeControl,
    showBackToSessionSuggestion: overrides?.showBackToSessionSuggestion,
    onBackToSessionSuggestion: overrides?.onBackToSessionSuggestion,
    onEndSession: overrides?.onEndSession,
  };

  return render(<Controls {...props} />);
}

describe('Controls > player name editor', () => {
  it('calls onStartSessionMode from the Session mode control', async () => {
    const user = userEvent.setup();
    const onStartSessionMode = vi.fn();
    renderControls({ onStartSessionMode });

    await user.click(screen.getByRole('button', { name: /session mode/i }));

    expect(onStartSessionMode).toHaveBeenCalledTimes(1);
  });

  it('shows four name inputs in doubles mode before the match starts', () => {
    renderControls();

    expect(screen.getByRole('textbox', { name: /team a player 1 name/i })).toHaveValue('Player 1');
    expect(screen.getByRole('textbox', { name: /team a player 2 name/i })).toHaveValue('Player 2');
    expect(screen.getByRole('textbox', { name: /team b player 1 name/i })).toHaveValue('Player 3');
    expect(screen.getByRole('textbox', { name: /team b player 2 name/i })).toHaveValue('Player 4');
  });

  it('shows two name inputs in singles mode before the match starts', () => {
    const singlesMatch = createMatch({ mode: 'singles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    renderControls({ match: singlesMatch, matchMode: 'singles' });

    expect(screen.getByRole('textbox', { name: /team a player 1 name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /team b player 1 name/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /player 2 name/i })).not.toBeInTheDocument();
  });

  it('displays the current player names from preferences in the inputs', () => {
    const playerNames = { A1: 'Alice', A2: 'Bob', B1: 'Carol', B2: 'Dave' };
    renderControls({ playerNames });

    expect(screen.getByRole('textbox', { name: /team a player 1 name/i })).toHaveValue('Alice');
    expect(screen.getByRole('textbox', { name: /team a player 2 name/i })).toHaveValue('Bob');
    expect(screen.getByRole('textbox', { name: /team b player 1 name/i })).toHaveValue('Carol');
    expect(screen.getByRole('textbox', { name: /team b player 2 name/i })).toHaveValue('Dave');
  });

  it('calls onPlayerNameChange with the player id and new value when an input changes', () => {
    const onPlayerNameChange = vi.fn();
    renderControls({ onPlayerNameChange });

    fireEvent.change(screen.getByRole('textbox', { name: /team a player 1 name/i }), {
      target: { value: 'Alice' },
    });

    expect(onPlayerNameChange).toHaveBeenCalledWith('A1', 'Alice');
  });

  it('hides the name editor once the match has a point scored', () => {
    const startedMatch = awardPointToServingTeam(defaultMatch);
    renderControls({ match: startedMatch });

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('reflects custom names in the first-server setup buttons', () => {
    const playerNames = { ...DEFAULT_PLAYER_NAMES, A1: 'Alice', B1: 'Bob' };
    renderControls({ playerNames });

    expect(screen.getByRole('button', { name: /team a alice serves/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /team b bob serves/i })).toBeInTheDocument();
  });

  it('calls onAnnouncementModeChange when short announcement is selected', async () => {
    const user = userEvent.setup();
    const onAnnouncementModeChange = vi.fn();
    renderControls({ onAnnouncementModeChange });

    await user.click(screen.getByRole('button', { name: /short announcement/i }));

    expect(onAnnouncementModeChange).toHaveBeenCalledWith('short');
  });

  it('hides one-off match setup controls when disabled for a session match', () => {
    renderControls({
      showMatchSetupControls: false,
      showNewMatchControl: false,
      showSessionModeControl: false,
    });

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /first server setup/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /match mode/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new match/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /session mode/i })).not.toBeInTheDocument();
  });

  it('renders session match actions when requested', async () => {
    const user = userEvent.setup();
    const onBackToSessionSuggestion = vi.fn();
    const onEndSession = vi.fn();
    renderControls({
      showMatchSetupControls: false,
      showNewMatchControl: false,
      showSessionModeControl: false,
      showBackToSessionSuggestion: true,
      onBackToSessionSuggestion,
      onEndSession,
    });

    await user.click(screen.getByRole('button', { name: /back to suggestion/i }));
    await user.click(screen.getByRole('button', { name: /end session/i }));

    expect(onBackToSessionSuggestion).toHaveBeenCalledTimes(1);
    expect(onEndSession).toHaveBeenCalledTimes(1);
  });
});
