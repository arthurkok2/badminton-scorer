import type { PlayerId } from './domain/matchTypes';

export const DEFAULT_PLAYER_NAMES: Record<PlayerId, string> = {
  A1: 'Player 1',
  A2: 'Player 2',
  B1: 'Player 3',
  B2: 'Player 4',
};

export interface AppPreferences {
  autoAnnounce: boolean;
  matchMode: 'singles' | 'doubles';
  remoteMapping: 'server-receiver-default';
  playerNames: Record<PlayerId, string>;
}

const STORAGE_KEY = 'badminton-scorer-preferences';

export const DEFAULT_PREFERENCES: AppPreferences = {
  autoAnnounce: false,
  matchMode: 'doubles',
  remoteMapping: 'server-receiver-default',
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
    matchMode: isMatchMode(value.matchMode) ? value.matchMode : DEFAULT_PREFERENCES.matchMode,
    remoteMapping: value.remoteMapping === 'server-receiver-default'
      ? value.remoteMapping
      : DEFAULT_PREFERENCES.remoteMapping,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMatchMode(value: unknown): value is AppPreferences['matchMode'] {
  return value === 'singles' || value === 'doubles';
}
