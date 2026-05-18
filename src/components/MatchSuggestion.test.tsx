import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MatchSuggestion } from './MatchSuggestion';
import type {
  GlobalPlayer,
  GlobalSessionPlayer,
  MatchSuggestion as MatchSuggestionData,
  PairingMatrix,
} from '../session/sessionTypes';

function makeGlobalPlayer(id: string, displayName: string): GlobalPlayer {
  return {
    id,
    displayName,
    searchName: displayName.toLowerCase(),
    createdBy: 'uid-1',
    claimStatus: 'guest' as const,
    globalIndividualElo: 1500,
    globalMatchCount: 0,
    statsVersion: 1,
  };
}

function sessionPlayer(player: GlobalPlayer): GlobalSessionPlayer {
  return {
    id: player.id,
    displayName: player.displayName,
    gamesPlayed: 0,
    consecutiveStreak: 0,
    onBreak: true,
  };
}

const alice = sessionPlayer(makeGlobalPlayer('player-alice', 'Alice'));
const bob = sessionPlayer(makeGlobalPlayer('player-bob', 'Bob'));
const carol = sessionPlayer(makeGlobalPlayer('player-carol', 'Carol'));
const dave = sessionPlayer(makeGlobalPlayer('player-dave', 'Dave'));
const eve = sessionPlayer(makeGlobalPlayer('player-eve', 'Eve'));

const suggestion: MatchSuggestionData = {
  rankedSplits: [
    { teamA: [alice, bob], teamB: [carol, dave] },
    { teamA: [alice, carol], teamB: [bob, dave] },
    { teamA: [alice, dave], teamB: [bob, carol] },
  ],
  onBreak: [eve],
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
  it('shows display names for all four playing players and the break player', () => {
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

  it('calls onStartMatch with the current global player split', async () => {
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
          id: 'match-1',
          sessionId: 'session-1',
          matchNumber: 1,
          teamAPlayerIds: ['player-alice', 'player-bob'],
          teamBPlayerIds: ['player-carol', 'player-dave'],
          teamADisplayNames: ['Alice', 'Bob'],
          teamBDisplayNames: ['Carol', 'Dave'],
          teamAPairId: 'player-alice__player-bob',
          teamBPairId: 'player-carol__player-dave',
          winnerTeam: 'teamA',
          startedAt: '2026-05-17T10:00:00.000Z',
          endedAt: '2026-05-17T10:12:00.000Z',
        },
      ],
    });

    expect(screen.getByRole('region', { name: /session match history/i })).toBeInTheDocument();
    expect(screen.getByText(/alice & bob won/i)).toBeInTheDocument();
  });

  it('swaps global player objects when changing the break player', async () => {
    const onStartMatch = vi.fn();
    renderSuggestion({ onStartMatch });

    await userEvent.click(screen.getByRole('button', { name: /change break/i }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /who sits out/i }), 'player-alice');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /who comes on/i }), 'player-eve');
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await userEvent.click(screen.getByRole('button', { name: /start match/i }));

    const split = onStartMatch.mock.calls[0][0];
    expect([...split.teamA, ...split.teamB].map((player: GlobalSessionPlayer) => player.id)).toContain('player-eve');
    expect([...split.teamA, ...split.teamB].map((player: GlobalSessionPlayer) => player.id)).not.toContain('player-alice');
  });

  it('shows break-swap selects when Change break is clicked', async () => {
    renderSuggestion();

    await userEvent.click(screen.getByRole('button', { name: /change break/i }));

    expect(screen.getByRole('combobox', { name: /who sits out/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /who comes on/i })).toBeInTheDocument();
  });
});
