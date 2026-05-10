export type MatchMode = 'singles' | 'doubles';
export type TeamId = 'teamA' | 'teamB';
export type PlayerId = 'A1' | 'A2' | 'B1' | 'B2';
export type CourtSide = 'left' | 'right';

export interface Player {
  id: PlayerId;
  name: string;
  teamId: TeamId;
}

export interface Team {
  id: TeamId;
  name: string;
  players: Player[];
}

export interface Score {
  teamA: number;
  teamB: number;
}

export interface MatchState {
  mode: MatchMode;
  teams: Record<TeamId, Team>;
  score: Score;
  servingTeamId: TeamId;
  serverId: PlayerId;
  receiverId: PlayerId;
  courtPositions: Record<PlayerId, CourtSide>;
  winnerTeamId?: TeamId;
  previous?: MatchState;
}

export interface CreateMatchOptions {
  mode: MatchMode;
  initialServingTeamId: TeamId;
  initialServingPlayerId: PlayerId;
}
