import type { TeamId } from '../domain/matchTypes';

export type AnimationEventType =
  | 'match_won'
  | 'shutout'
  | 'bagel'
  | 'match_point'
  | 'deuce'
  | 'streak_9'
  | 'streak_6'
  | 'comeback'
  | 'streak_3'
  | 'first_to_11';

export interface AnimationEvent {
  readonly type: AnimationEventType;
  readonly teamId: TeamId;
}
