import {
  awardPointToReceivingTeam,
  awardPointToServingTeam,
  createMatch,
  setInitialServer,
  undoLastPoint,
} from './matchEngine';

describe('match engine', () => {
  it('creates a doubles match with placeholder teams and players', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });

    expect(match.score).toEqual({ teamA: 0, teamB: 0 });
    expect(match.teams.teamA.name).toBe('Team A');
    expect(match.teams.teamB.players.map((player) => player.name)).toEqual(['Player 3', 'Player 4']);
    expect(match.servingTeamId).toBe('teamA');
    expect(match.serverId).toBe('A1');
    expect(match.receiverId).toBe('B1');
    expect(match.courtPositions.A1).toBe('right');
  });

  it('keeps service with the serving team and swaps that team sides after winning a rally', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToServingTeam(match);

    expect(next.score).toEqual({ teamA: 1, teamB: 0 });
    expect(next.servingTeamId).toBe('teamA');
    expect(next.serverId).toBe('A1');
    expect(next.receiverId).toBe('B2');
    expect(next.courtPositions.A1).toBe('left');
    expect(next.courtPositions.A2).toBe('right');
  });

  it('changes service to the receiving team without moving players after receiver wins a rally', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToReceivingTeam(match);

    expect(next.score).toEqual({ teamA: 0, teamB: 1 });
    expect(next.servingTeamId).toBe('teamB');
    expect(next.serverId).toBe('B1');
    expect(next.receiverId).toBe('A2');
    expect(next.courtPositions.B1).toBe('left');
    expect(next.courtPositions.B2).toBe('right');
  });

  it('detects win by two after 20-all and caps at 30', () => {
    let match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    match = { ...match, score: { teamA: 20, teamB: 20 }, servingTeamId: 'teamA', serverId: 'A1', receiverId: 'B1' };

    const twentyOne = awardPointToServingTeam(match);
    expect(twentyOne.winnerTeamId).toBeUndefined();

    const twentyTwo = awardPointToServingTeam(twentyOne);
    expect(twentyTwo.score.teamA).toBe(22);
    expect(twentyTwo.winnerTeamId).toBe('teamA');

    const capped = awardPointToServingTeam({
      ...match,
      score: { teamA: 29, teamB: 29 },
      winnerTeamId: undefined,
    });
    expect(capped.score.teamA).toBe(30);
    expect(capped.winnerTeamId).toBe('teamA');
  });

  it('restores the previous state with last-action undo', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToServingTeam(match);
    const undone = undoLastPoint(next);

    expect(undone.score).toEqual(match.score);
    expect(undone.serverId).toBe(match.serverId);
    expect(undone.previous).toBeUndefined();
  });

  it('allows changing the initial server before scoring starts', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const changed = setInitialServer(match, 'teamB', 'B2');

    expect(changed.servingTeamId).toBe('teamB');
    expect(changed.serverId).toBe('B2');
    expect(changed.receiverId).toBe('A1');
  });
});
