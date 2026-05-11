import { DEFAULT_PLAYER_NAMES, DEFAULT_PREFERENCES, loadPreferences, savePreferences } from './preferences';

const STORAGE_KEY = 'badminton-scorer-preferences';

describe('preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loads default preferences as a fresh object when storage is empty', () => {
    const preferences = loadPreferences();

    expect(preferences).toEqual(DEFAULT_PREFERENCES);
    expect(preferences).not.toBe(DEFAULT_PREFERENCES);
  });

  it('loads defaults for malformed JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{bad json');

    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('defaults invalid stored values', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        autoAnnounce: 'yes',
        matchMode: 'triples',
        remoteMapping: 'custom',
      }),
    );

    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps partial valid stored values and defaults the rest', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        autoAnnounce: true,
        matchMode: 'singles',
        remoteMapping: 'custom',
      }),
    );

    expect(loadPreferences()).toEqual({
      autoAnnounce: true,
      matchMode: 'singles',
      remoteMapping: 'server-receiver-default',
      playerNames: DEFAULT_PLAYER_NAMES,
    });
  });

  it('saves and loads custom player names', () => {
    const playerNames = { A1: 'Alice', A2: 'Bob', B1: 'Carol', B2: 'Dave' };
    savePreferences({ ...DEFAULT_PREFERENCES, playerNames });

    expect(loadPreferences().playerNames).toEqual(playerNames);
  });

  it('falls back to default player name for any blank or missing entry', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_PREFERENCES, playerNames: { A1: 'Alice', A2: '', B1: null, B2: 'Dave' } }),
    );

    expect(loadPreferences().playerNames).toEqual({
      A1: 'Alice',
      A2: DEFAULT_PLAYER_NAMES.A2,
      B1: DEFAULT_PLAYER_NAMES.B1,
      B2: 'Dave',
    });
  });

  it('does not throw when saving preferences fails', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage full');
    });

    expect(() => savePreferences(DEFAULT_PREFERENCES)).not.toThrow();

    setItem.mockRestore();
  });
});
