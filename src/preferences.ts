import type { MatchSnapshot, MatchState, PlayerId } from './domain/matchTypes';
import type { AnnouncementMode } from './speech/announcer';

export const DEFAULT_PLAYER_NAMES: Record<PlayerId, string> = {
  A1: 'Player 1',
  A2: 'Player 2',
  B1: 'Player 3',
  B2: 'Player 4',
};

export interface AppPreferences {
  autoAnnounce: boolean;
  announcementMode: AnnouncementMode;
  matchMode: 'singles' | 'doubles';
  remoteMapping: 'server-receiver-default';
  animationsEnabled: boolean;
  playerNames: Record<PlayerId, string>;
}

const STORAGE_KEY = 'badminton-scorer-preferences';

export const DEFAULT_PREFERENCES: AppPreferences = {
  autoAnnounce: false,
  announcementMode: 'full',
  matchMode: 'doubles',
  remoteMapping: 'server-receiver-default',
  animationsEnabled: true,
  playerNames: { ...DEFAULT_PLAYER_NAMES },
};

export function loadPreferences(): AppPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parsePreferences(JSON.parse(raw)) : { ...DEFAULT_PREFERENCES };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(preferences: AppPreferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences are non-critical; storage can fail in private mode or when full.
  }
}

function parsePreferences(value: unknown): AppPreferences {
  if (!isRecord(value)) {
    return { ...DEFAULT_PREFERENCES, playerNames: { ...DEFAULT_PLAYER_NAMES } };
  }

  return {
    autoAnnounce: typeof value.autoAnnounce === 'boolean' ? value.autoAnnounce : DEFAULT_PREFERENCES.autoAnnounce,
    announcementMode: isAnnouncementMode(value.announcementMode) ? value.announcementMode : DEFAULT_PREFERENCES.announcementMode,
    matchMode: isMatchMode(value.matchMode) ? value.matchMode : DEFAULT_PREFERENCES.matchMode,
    remoteMapping: value.remoteMapping === 'server-receiver-default'
      ? value.remoteMapping
      : DEFAULT_PREFERENCES.remoteMapping,
    animationsEnabled: typeof value.animationsEnabled === 'boolean'
      ? value.animationsEnabled
      : DEFAULT_PREFERENCES.animationsEnabled,
    playerNames: parsePlayerNames(value.playerNames),
  };
}

function parsePlayerNames(value: unknown): Record<PlayerId, string> {
  if (!isRecord(value)) {
    return { ...DEFAULT_PLAYER_NAMES };
  }

  return {
    A1: typeof value.A1 === 'string' && value.A1.trim() ? value.A1 : DEFAULT_PLAYER_NAMES.A1,
    A2: typeof value.A2 === 'string' && value.A2.trim() ? value.A2 : DEFAULT_PLAYER_NAMES.A2,
    B1: typeof value.B1 === 'string' && value.B1.trim() ? value.B1 : DEFAULT_PLAYER_NAMES.B1,
    B2: typeof value.B2 === 'string' && value.B2.trim() ? value.B2 : DEFAULT_PLAYER_NAMES.B2,
  };
}

const MATCH_STORAGE_KEY = 'badminton-scorer-match';

export function loadMatchState(): MatchState | undefined {
  try {
    const raw = window.localStorage.getItem(MATCH_STORAGE_KEY);
    if (!raw) return undefined;
    return parseMatchState(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function saveMatchState(match: MatchState): void {
  try {
    window.localStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(match));
  } catch {
    // Non-critical; can fail in private mode or when storage is full.
  }
}

export function clearMatchState(): void {
  try {
    window.localStorage.removeItem(MATCH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function parseMatchState(value: unknown): MatchState | undefined {
  if (!isMatchSnapshot(value)) {
    return undefined;
  }

  const { previous, history, ...rest } = value as MatchSnapshot & { previous?: unknown; history?: unknown };
  const normalizedHistory = Array.isArray(history)
    ? parseMatchHistory(history)
    : isMatchSnapshot(previous)
      ? [previous]
      : [];

  return {
    ...(rest as unknown as Omit<MatchState, 'history'>),
    mode: value.mode,
    history: normalizedHistory,
  };
}

function parseMatchHistory(value: unknown[]): MatchSnapshot[] {
  return value.every(isMatchSnapshot) ? value : [];
}

function isMatchSnapshot(value: unknown): value is MatchSnapshot {
  return (
    isRecord(value) &&
    isMatchMode(value.mode) &&
    isTeams(value.teams) &&
    isScore(value.score) &&
    isTeamId(value.servingTeamId) &&
    isPlayerId(value.serverId) &&
    isPlayerId(value.receiverId) &&
    isCourtPositions(value.courtPositions) &&
    (value.winnerTeamId === undefined || isTeamId(value.winnerTeamId))
  );
}

function isTeams(value: unknown): value is MatchSnapshot['teams'] {
  return isRecord(value) && isTeam(value.teamA, 'teamA') && isTeam(value.teamB, 'teamB');
}

function isTeam(value: unknown, teamId: 'teamA' | 'teamB'): boolean {
  return (
    isRecord(value) &&
    value.id === teamId &&
    typeof value.name === 'string' &&
    Array.isArray(value.players) &&
    value.players.every((player) => isPlayer(player, teamId))
  );
}

function isPlayer(value: unknown, teamId: 'teamA' | 'teamB'): boolean {
  return isRecord(value) && isPlayerId(value.id) && typeof value.name === 'string' && value.teamId === teamId;
}

function isScore(value: unknown): value is MatchSnapshot['score'] {
  return isRecord(value) && typeof value.teamA === 'number' && typeof value.teamB === 'number';
}

function isCourtPositions(value: unknown): value is MatchSnapshot['courtPositions'] {
  return (
    isRecord(value) &&
    isCourtSide(value.A1) &&
    isCourtSide(value.A2) &&
    isCourtSide(value.B1) &&
    isCourtSide(value.B2)
  );
}

function isTeamId(value: unknown): value is 'teamA' | 'teamB' {
  return value === 'teamA' || value === 'teamB';
}

function isPlayerId(value: unknown): value is PlayerId {
  return value === 'A1' || value === 'A2' || value === 'B1' || value === 'B2';
}

function isCourtSide(value: unknown): value is 'left' | 'right' {
  return value === 'left' || value === 'right';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMatchMode(value: unknown): value is AppPreferences['matchMode'] {
  return value === 'singles' || value === 'doubles';
}

function isAnnouncementMode(value: unknown): value is AnnouncementMode {
  return value === 'full' || value === 'short';
}
