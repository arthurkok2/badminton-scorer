import type { MatchMode, MatchState, TeamId } from '../domain/matchTypes';

export type WatchRemoteHostStatus = 'inactive' | 'starting' | 'active' | 'stopping' | 'error';
export type WatchRemoteCommandType = 'POINT_TEAM' | 'UNDO' | 'ANNOUNCE';

interface WatchRemoteCommandMetadata {
  readonly sourceId: string;
  readonly sourceKind: 'wear' | 'web' | 'garmin';
  readonly createdAt: unknown;
  readonly appliedAt?: unknown;
  readonly rejectedAt?: unknown;
  readonly rejectionReason?: string;
}

export interface WatchRemoteMatchDocument {
  readonly code: string;
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
  readonly active: boolean;
  readonly hostId: string;
  readonly hostHeartbeatAt: unknown;
  readonly matchState: MatchState;
  readonly matchMode: MatchMode;
  readonly winnerTeamId?: TeamId;
  readonly lastAppliedCommandId?: string;
}

export type WatchRemoteCommandDocument =
  | (WatchRemoteCommandMetadata & { readonly type: 'POINT_TEAM'; readonly teamId: TeamId })
  | (WatchRemoteCommandMetadata & { readonly type: 'UNDO' })
  | (WatchRemoteCommandMetadata & { readonly type: 'ANNOUNCE' });

export interface PendingWatchRemoteCommand {
  readonly id: string;
  readonly command: WatchRemoteCommandDocument;
}

export interface WatchRemoteSnapshot {
  readonly code: string;
  readonly active: boolean;
  readonly hostId: string;
  readonly matchState: MatchState;
}
