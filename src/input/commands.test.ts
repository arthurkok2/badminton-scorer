import { createMatch } from '../domain/matchEngine';
import { applyCommand } from './commands';

describe('command reducer', () => {
  it('increments Team A for POINT_TEAM', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });

    const next = applyCommand(match, { type: 'POINT_TEAM', teamId: 'teamA' });

    expect(next.score).toEqual({ teamA: 1, teamB: 0 });
    expect(next.servingTeamId).toBe('teamA');
  });

  it('increments Team B and changes service for POINT_TEAM', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });

    const next = applyCommand(match, { type: 'POINT_TEAM', teamId: 'teamB' });

    expect(next.score).toEqual({ teamA: 0, teamB: 1 });
    expect(next.servingTeamId).toBe('teamB');
  });

  it('walks back multiple points for repeated UNDO commands', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const firstPoint = applyCommand(match, { type: 'POINT_TEAM', teamId: 'teamA' });
    const secondPoint = applyCommand(firstPoint, { type: 'POINT_TEAM', teamId: 'teamB' });

    const afterOneUndo = applyCommand(secondPoint, { type: 'UNDO' });
    const afterTwoUndos = applyCommand(afterOneUndo, { type: 'UNDO' });

    expect(afterOneUndo.score).toEqual(firstPoint.score);
    expect(afterOneUndo.servingTeamId).toBe(firstPoint.servingTeamId);
    expect(afterOneUndo.history).toHaveLength(1);
    expect(afterTwoUndos.score).toEqual(match.score);
    expect(afterTwoUndos.servingTeamId).toBe(match.servingTeamId);
    expect(afterTwoUndos.history).toHaveLength(0);
  });

  it('propagates domain errors for invalid SET_INITIAL_SERVER commands', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });

    expect(() => applyCommand(match, { type: 'SET_INITIAL_SERVER', teamId: 'teamA', playerId: 'B1' })).toThrow(
      'Player B1 does not belong to teamA',
    );
  });
});
