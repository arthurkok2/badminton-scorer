import { buildAnnouncement } from './announcer';
import { awardPointToServingTeam, createMatch } from '../domain/matchEngine';

describe('announcer', () => {
  it('announces serving team, serving player, and server score first', () => {
    const match = awardPointToServingTeam(
      createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    );

    expect(buildAnnouncement(match)).toBe('Team A serving, Player 1, 1-0.');
  });

  it('announces game point after a winner exists', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const winner = {
      ...match,
      score: { teamA: 21, teamB: 10 },
      winnerTeamId: 'teamA' as const,
    };

    expect(buildAnnouncement(winner)).toBe('Game. Team A wins, 21-10.');
  });
});
