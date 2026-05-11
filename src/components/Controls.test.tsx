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
}) {
  const props = {
    match: overrides?.match ?? defaultMatch,
    autoAnnounce: false,
    matchMode: overrides?.matchMode ?? 'doubles',
    playerNames: overrides?.playerNames ?? { ...DEFAULT_PLAYER_NAMES },
    onUndo: vi.fn(),
    onAnnounce: vi.fn(),
    onAutoAnnounceChange: vi.fn(),
    onMatchModeChange: vi.fn(),
    onNewMatch: vi.fn(),
    onSetInitialServer: overrides?.onSetInitialServer ?? vi.fn(),
    onRerollFirstServer: vi.fn(),
    onPlayerNameChange: overrides?.onPlayerNameChange ?? vi.fn(),
  };

  return render(<Controls {...props} />);
}

describe('Controls > player name editor', () => {
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
});
