import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from './preferences';

const STORAGE_KEY = 'badminton-score-preferences';

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
