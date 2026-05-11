import {
  awardPointToTeam,
  createMatch,
  setInitialServer,
  undoLastPoint,
} from '../domain/matchEngine';
import type { MatchMode, MatchState, PlayerId, TeamId } from '../domain/matchTypes';

export type AppCommand =
  | { type: 'POINT_TEAM'; teamId: TeamId }
  | { type: 'UNDO' }
  | { type: 'RESET'; mode: MatchMode }
  | { type: 'SET_INITIAL_SERVER'; teamId: TeamId; playerId: PlayerId };

export function applyCommand(match: MatchState, command: AppCommand): MatchState {
  switch (command.type) {
    case 'POINT_TEAM':
      return awardPointToTeam(match, command.teamId);
    case 'UNDO':
      return undoLastPoint(match);
    case 'RESET':
      return createMatch({ mode: command.mode, initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    case 'SET_INITIAL_SERVER':
      return setInitialServer(match, command.teamId, command.playerId);
  }
}
