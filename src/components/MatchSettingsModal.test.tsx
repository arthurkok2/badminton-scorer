import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { awardPointToServingTeam, createMatch } from '../domain/matchEngine';
import { DEFAULT_PLAYER_NAMES } from '../preferences';
import { MatchSettingsModal } from './MatchSettingsModal';

function renderModal(overrides = {}) {
  const props = {
    match: createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    matchMode: 'doubles' as const,
    playerNames: { ...DEFAULT_PLAYER_NAMES },
    onMatchModeChange: vi.fn(),
    onSetInitialServer: vi.fn(),
    onPlayerNameChange: vi.fn(),
    ...overrides,
  };
  render(<MatchSettingsModal {...props} />);
  return props;
}

describe('MatchSettingsModal', () => {
  it('renders match mode, player names, and first-server controls before the match starts', () => {
    renderModal();

    expect(screen.getByRole('group', { name: /match mode/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /team a player 1 name/i })).toHaveValue('Player 1');
    expect(screen.getByRole('button', { name: /team b player 3 serves/i })).toBeInTheDocument();
  });

  it('calls match settings callbacks', async () => {
    const user = userEvent.setup();
    const props = renderModal();

    await user.click(screen.getByRole('button', { name: /singles/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /team a player 1 name/i }), {
      target: { value: 'Alice' },
    });
    await user.click(screen.getByRole('button', { name: /team b player 3 serves/i }));

    expect(props.onMatchModeChange).toHaveBeenCalledWith('singles');
    expect(props.onPlayerNameChange).toHaveBeenCalledWith('A1', 'Alice');
    expect(props.onSetInitialServer).toHaveBeenCalledWith('teamB', 'B1');
  });

  it('locks setup controls after the first rally', () => {
    const startedMatch = awardPointToServingTeam(
      createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    );

    renderModal({ match: startedMatch });

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /first server setup/i })).not.toBeInTheDocument();
    expect(screen.getByText(/match setup is locked after the first rally/i)).toBeInTheDocument();
  });

  it('disables match setup controls when session context locks settings', () => {
    renderModal({ settingsLocked: true });

    expect(screen.getByRole('button', { name: /doubles/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /singles/i })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /team a player 1 name/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /team b player 3 serves/i })).toBeDisabled();
    expect(screen.getByText(/session match settings are locked/i)).toBeInTheDocument();
  });
});
