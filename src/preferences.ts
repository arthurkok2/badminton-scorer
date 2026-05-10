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
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: AppPreferences): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
