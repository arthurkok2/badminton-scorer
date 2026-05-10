import {
  awardPointToReceivingTeam,
  awardPointToServingTeam,
  createMatch,
  setInitialServer,
  undoLastPoint,
} from '../domain/matchEngine';
import type { MatchMode, MatchState, PlayerId, TeamId } from '../domain/matchTypes';

export type AppCommand =
  | { type: 'POINT_SERVING' }
  | { type: 'POINT_RECEIVING' }
  | { type: 'UNDO' }
  | { type: 'RESET'; mode: MatchMode }
  | { type: 'SET_INITIAL_SERVER'; teamId: TeamId; playerId: PlayerId };

export function applyCommand(match: MatchState, command: AppCommand): MatchState {
  switch (command.type) {
    case 'POINT_SERVING':
      return awardPointToServingTeam(match);
    case 'POINT_RECEIVING':
      return awardPointToReceivingTeam(match);
    case 'UNDO':
      return undoLastPoint(match);
    case 'RESET':
      return createMatch({ mode: command.mode, initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    case 'SET_INITIAL_SERVER':
      return setInitialServer(match, command.teamId, command.playerId);
  }
}
