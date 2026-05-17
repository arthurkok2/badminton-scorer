import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MatchSuggestion } from './MatchSuggestion';
import type {
  MatchSuggestion as MatchSuggestionData,
  PairingMatrix,
} from '../session/sessionTypes';

const suggestion: MatchSuggestionData = {
  rankedSplits: [
    { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] },
    { teamA: ['Alice', 'Carol'], teamB: ['Bob', 'Dave'] },
    { teamA: ['Alice', 'Dave'], teamB: ['Bob', 'Carol'] },
  ],
  onBreak: ['Eve'],
};

const emptyMatrix: PairingMatrix = { together: {}, against: {} };

function renderSuggestion(overrides?: Partial<React.ComponentProps<typeof MatchSuggestion>>) {
  return render(
    <MatchSuggestion
      suggestion={suggestion}
      pairingMatrix={emptyMatrix}
      onStartMatch={vi.fn()}
      onEditPlayers={vi.fn()}
      onEndSession={vi.fn()}
      {...overrides}
    />,
  );
}

describe('MatchSuggestion', () => {
  it('shows all four playing players and the break player', () => {
    renderSuggestion();

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.getByText('Dave')).toBeInTheDocument();
    expect(screen.getByText('Eve')).toBeInTheDocument();
  });

  it('cycles to the next ranked split on Swap', async () => {
    renderSuggestion();

    await userEvent.click(screen.getByRole('button', { name: /swap teams/i }));

    // After one swap: Alice & Carol vs Bob & Dave (rankedSplits[1])
    const teamA = screen.getByRole('group', { name: /team a/i });
    expect(teamA).toHaveTextContent('Alice');
    expect(teamA).toHaveTextContent('Carol');
  });

  it('wraps back to the first split after three swaps', async () => {
    renderSuggestion();

    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: /swap teams/i }));
    }

    const teamA = screen.getByRole('group', { name: /team a/i });
    expect(teamA).toHaveTextContent('Alice');
    expect(teamA).toHaveTextContent('Bob');
  });

  it('calls onStartMatch with the current split', async () => {
    const onStartMatch = vi.fn();
    renderSuggestion({ onStartMatch });

    await userEvent.click(screen.getByRole('button', { name: /start match/i }));

    expect(onStartMatch).toHaveBeenCalledWith(suggestion.rankedSplits[0]);
  });

  it('calls onStartMatch with the swapped split after one swap', async () => {
    const onStartMatch = vi.fn();
    renderSuggestion({ onStartMatch });

    await userEvent.click(screen.getByRole('button', { name: /swap teams/i }));
    await userEvent.click(screen.getByRole('button', { name: /start match/i }));

    expect(onStartMatch).toHaveBeenCalledWith(suggestion.rankedSplits[1]);
  });

  it('calls onEditPlayers when Edit players is clicked', async () => {
    const onEditPlayers = vi.fn();
    renderSuggestion({ onEditPlayers });

    await userEvent.click(screen.getByRole('button', { name: /edit players/i }));

    expect(onEditPlayers).toHaveBeenCalled();
  });

  it('calls onEndSession when End session is clicked', async () => {
    const onEndSession = vi.fn();
    renderSuggestion({ onEndSession });

    await userEvent.click(screen.getByRole('button', { name: /end session/i }));

    expect(onEndSession).toHaveBeenCalled();
  });

  it('shows completed session match history', () => {
    renderSuggestion({
      completedMatches: [
        {
          teamA: ['Alice', 'Bob'],
          teamB: ['Carol', 'Dave'],
          winnerTeam: 'teamA',
          startedAt: '2026-05-17T10:00:00.000Z',
          endedAt: '2026-05-17T10:12:00.000Z',
        },
      ],
    });

    expect(screen.getByRole('region', { name: /session match history/i })).toBeInTheDocument();
    expect(screen.getByText(/alice & bob won/i)).toBeInTheDocument();
  });

  it('shows break-swap selects when Change break is clicked', async () => {
    renderSuggestion();

    await userEvent.click(screen.getByRole('button', { name: /change break/i }));

    expect(screen.getByRole('combobox', { name: /who sits out/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /who comes on/i })).toBeInTheDocument();
  });
});
