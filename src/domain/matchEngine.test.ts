import {
  awardPointToTeam,
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

  it('places the requested initial server on the starting service side', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamB', initialServingPlayerId: 'B2' });

    expect(match.servingTeamId).toBe('teamB');
    expect(match.serverId).toBe('B2');
    expect(match.receiverId).toBe('A1');
    expect(match.courtPositions.B2).toBe('right');
    expect(match.courtPositions.B1).toBe('left');
  });

  it('rejects invalid initial serving team and player combinations', () => {
    expect(() =>
      createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'B1' }),
    ).toThrow('Player B1 does not belong to teamA');
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

  it('awards a point to Team A and keeps service when Team A is serving', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToTeam(match, 'teamA');

    expect(next.score).toEqual({ teamA: 1, teamB: 0 });
    expect(next.servingTeamId).toBe('teamA');
    expect(next.serverId).toBe('A1');
    expect(next.receiverId).toBe('B2');
    expect(next.courtPositions.A1).toBe('left');
    expect(next.courtPositions.A2).toBe('right');
  });

  it('awards a point to Team B and changes service when Team A is serving', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToTeam(match, 'teamB');

    expect(next.score).toEqual({ teamA: 0, teamB: 1 });
    expect(next.servingTeamId).toBe('teamB');
    expect(next.serverId).toBe('B2');
    expect(next.receiverId).toBe('A2');
    expect(next.courtPositions).toEqual(match.courtPositions);
    expect(next.courtPositions).not.toBe(match.courtPositions);
  });

  it('tracks a multi-rally doubles sequence with legal transitions', () => {
    const initial = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const teamAWinsOnServe = awardPointToServingTeam(initial);
    const teamBWinsService = awardPointToReceivingTeam(teamAWinsOnServe);
    const teamBWinsOnServe = awardPointToServingTeam(teamBWinsService);
    const teamAWinsServiceBack = awardPointToReceivingTeam(teamBWinsOnServe);

    expect(teamAWinsOnServe.score).toEqual({ teamA: 1, teamB: 0 });
    expect(teamAWinsOnServe.serverId).toBe('A1');
    expect(teamAWinsOnServe.receiverId).toBe('B2');
    expect(teamAWinsOnServe.courtPositions.A1).toBe('left');
    expect(teamAWinsOnServe.courtPositions.A2).toBe('right');

    expect(teamBWinsService.score).toEqual({ teamA: 1, teamB: 1 });
    expect(teamBWinsService.servingTeamId).toBe('teamB');
    expect(teamBWinsService.serverId).toBe('B2');
    expect(teamBWinsService.receiverId).toBe('A1');
    expect(teamBWinsService.courtPositions.B1).toBe('right');
    expect(teamBWinsService.courtPositions.B2).toBe('left');

    expect(teamBWinsOnServe.score).toEqual({ teamA: 1, teamB: 2 });
    expect(teamBWinsOnServe.serverId).toBe('B2');
    expect(teamBWinsOnServe.receiverId).toBe('A2');
    expect(teamBWinsOnServe.courtPositions.B1).toBe('left');
    expect(teamBWinsOnServe.courtPositions.B2).toBe('right');

    expect(teamAWinsServiceBack.score).toEqual({ teamA: 2, teamB: 2 });
    expect(teamAWinsServiceBack.servingTeamId).toBe('teamA');
    expect(teamAWinsServiceBack.serverId).toBe('A2');
    expect(teamAWinsServiceBack.receiverId).toBe('B2');
  });

  it('changes service to the receiving team without moving players after receiver wins a rally', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToReceivingTeam(match);

    expect(next.score).toEqual({ teamA: 0, teamB: 1 });
    expect(next.servingTeamId).toBe('teamB');
    expect(next.serverId).toBe('B2');
    expect(next.receiverId).toBe('A2');
    expect(next.courtPositions.B1).toBe('right');
    expect(next.courtPositions.B2).toBe('left');
  });

  it('clones doubles court positions when service turns over', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToReceivingTeam(match);

    expect(next.courtPositions).toEqual(match.courtPositions);
    expect(next.courtPositions).not.toBe(match.courtPositions);
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

  it('undoes only the last action after multiple points', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const firstPoint = awardPointToServingTeam(match);
    const secondPoint = awardPointToReceivingTeam(firstPoint);
    const undone = undoLastPoint(secondPoint);

    expect(undone.score).toEqual(firstPoint.score);
    expect(undone.servingTeamId).toBe(firstPoint.servingTeamId);
    expect(undone.serverId).toBe(firstPoint.serverId);
    expect(undone.receiverId).toBe(firstPoint.receiverId);
    expect(undone.previous).toBeUndefined();
  });

  it('keeps undo snapshots independent of caller mutations after scoring', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToServingTeam(match);
    const mutableScore = match.score as { teamA: number };
    const mutableCourtPositions = match.courtPositions as { A1: 'left' | 'right' };

    mutableScore.teamA = 99;
    mutableCourtPositions.A1 = 'left';

    const undone = undoLastPoint(next);

    expect(undone.score).toEqual({ teamA: 0, teamB: 0 });
    expect(undone.courtPositions.A1).toBe('right');
  });

  it('allows changing the initial server before scoring starts', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const changed = setInitialServer(match, 'teamB', 'B2');

    expect(changed.servingTeamId).toBe('teamB');
    expect(changed.serverId).toBe('B2');
    expect(changed.receiverId).toBe('A1');
  });

  it('rejects invalid initial server changes', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });

    expect(() => setInitialServer(match, 'teamA', 'B1')).toThrow('Player B1 does not belong to teamA');
  });

  it('leaves initial server unchanged after scoring starts', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToServingTeam(match);

    expect(setInitialServer(next, 'teamB', 'B2')).toBe(next);
  });

  it('creates a singles match with one player per team', () => {
    const match = createMatch({ mode: 'singles', initialServingTeamId: 'teamB', initialServingPlayerId: 'B1' });

    expect(match.teams.teamA.players.map((player) => player.id)).toEqual(['A1']);
    expect(match.teams.teamB.players.map((player) => player.id)).toEqual(['B1']);
    expect(match.serverId).toBe('B1');
    expect(match.receiverId).toBe('A1');
    expect(match.courtPositions.B1).toBe('right');
    expect(match.courtPositions.A1).toBe('right');
  });

  it('updates singles service sides when rallies are won', () => {
    const match = createMatch({ mode: 'singles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const serverWins = awardPointToServingTeam(match);
    const receiverWins = awardPointToReceivingTeam(match);

    expect(serverWins.score).toEqual({ teamA: 1, teamB: 0 });
    expect(serverWins.servingTeamId).toBe('teamA');
    expect(serverWins.serverId).toBe('A1');
    expect(serverWins.receiverId).toBe('B1');
    expect(serverWins.courtPositions.A1).toBe('left');
    expect(serverWins.courtPositions.B1).toBe('left');

    expect(receiverWins.score).toEqual({ teamA: 0, teamB: 1 });
    expect(receiverWins.servingTeamId).toBe('teamB');
    expect(receiverWins.serverId).toBe('B1');
    expect(receiverWins.receiverId).toBe('A1');
    expect(receiverWins.courtPositions.B1).toBe('left');
    expect(receiverWins.courtPositions.A1).toBe('left');
  });
});
