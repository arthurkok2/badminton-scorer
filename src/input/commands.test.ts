import { createMatch } from '../domain/matchEngine';
import { applyCommand } from './commands';

describe('command reducer', () => {
  it('increments the serving team for POINT_SERVING', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });

    const next = applyCommand(match, { type: 'POINT_SERVING' });

    expect(next.score).toEqual({ teamA: 1, teamB: 0 });
    expect(next.servingTeamId).toBe('teamA');
  });

  it('changes service for POINT_RECEIVING', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });

    const next = applyCommand(match, { type: 'POINT_RECEIVING' });

    expect(next.score).toEqual({ teamA: 0, teamB: 1 });
    expect(next.servingTeamId).toBe('teamB');
  });

  it('restores the last point for UNDO', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const scored = applyCommand(match, { type: 'POINT_SERVING' });

    const undone = applyCommand(scored, { type: 'UNDO' });

    expect(undone.score).toEqual(match.score);
    expect(undone.servingTeamId).toBe(match.servingTeamId);
    expect(undone.previous).toBeUndefined();
  });

  it('propagates domain errors for invalid SET_INITIAL_SERVER commands', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });

    expect(() => applyCommand(match, { type: 'SET_INITIAL_SERVER', teamId: 'teamA', playerId: 'B1' })).toThrow(
      'Player B1 does not belong to teamA',
    );
  });
});
