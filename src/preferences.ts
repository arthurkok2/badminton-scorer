export interface AppPreferences {
  autoAnnounce: boolean;
  matchMode: 'singles' | 'doubles';
  remoteMapping: 'server-receiver-default';
}

const STORAGE_KEY = 'badminton-score-preferences';

export const DEFAULT_PREFERENCES: AppPreferences = {
  autoAnnounce: false,
  matchMode: 'doubles',
  remoteMapping: 'server-receiver-default',
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
    return { ...DEFAULT_PREFERENCES };
  }

  return {
    autoAnnounce: typeof value.autoAnnounce === 'boolean' ? value.autoAnnounce : DEFAULT_PREFERENCES.autoAnnounce,
    matchMode: isMatchMode(value.matchMode) ? value.matchMode : DEFAULT_PREFERENCES.matchMode,
    remoteMapping: value.remoteMapping === 'server-receiver-default'
      ? value.remoteMapping
      : DEFAULT_PREFERENCES.remoteMapping,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMatchMode(value: unknown): value is AppPreferences['matchMode'] {
  return value === 'singles' || value === 'doubles';
}
