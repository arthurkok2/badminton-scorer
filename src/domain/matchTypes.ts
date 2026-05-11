export type MatchMode = 'singles' | 'doubles';
export type TeamId = 'teamA' | 'teamB';
export type PlayerId = 'A1' | 'A2' | 'B1' | 'B2';
export type CourtSide = 'left' | 'right';

export interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly teamId: TeamId;
}

export interface Team {
  readonly id: TeamId;
  readonly name: string;
  readonly players: readonly Player[];
}

export interface Score {
  readonly teamA: number;
  readonly teamB: number;
}

export interface MatchSnapshot {
  readonly mode: MatchMode;
  readonly teams: Readonly<Record<TeamId, Team>>;
  readonly score: Score;
  readonly servingTeamId: TeamId;
  readonly serverId: PlayerId;
  readonly receiverId: PlayerId;
  readonly courtPositions: Readonly<Record<PlayerId, CourtSide>>;
  readonly winnerTeamId?: TeamId;
}

export interface MatchState extends MatchSnapshot {
  readonly previous?: MatchSnapshot;
}

export interface CreateMatchOptions {
  readonly mode: MatchMode;
  readonly initialServingTeamId: TeamId;
  readonly initialServingPlayerId: PlayerId;
  readonly playerNames?: Readonly<Record<PlayerId, string>>;
}
