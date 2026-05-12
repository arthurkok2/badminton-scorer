import { createMatch, awardPointToServingTeam } from './domain/matchEngine';
import {
  DEFAULT_PLAYER_NAMES,
  DEFAULT_PREFERENCES,
  loadMatchState,
  loadPreferences,
  saveMatchState,
  savePreferences,
} from './preferences';

const STORAGE_KEY = 'badminton-scorer-preferences';
const MATCH_STORAGE_KEY = 'badminton-scorer-match';

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
      announcementMode: 'full',
      matchMode: 'singles',
      remoteMapping: 'server-receiver-default',
      playerNames: DEFAULT_PLAYER_NAMES,
    });
  });

  it('saves and loads the selected announcement mode', () => {
    savePreferences({ ...DEFAULT_PREFERENCES, announcementMode: 'short' });

    expect(loadPreferences().announcementMode).toBe('short');
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

  it('saves match state with history and without legacy previous', () => {
    const match = awardPointToServingTeam(
      createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    );

    saveMatchState(match);

    const saved = JSON.parse(window.localStorage.getItem(MATCH_STORAGE_KEY) ?? '{}');
    expect(saved.history).toHaveLength(1);
    expect(saved.previous).toBeUndefined();
  });

  it('loads saved match state with history', () => {
    const match = awardPointToServingTeam(
      createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    );
    window.localStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(match));

    expect(loadMatchState()).toMatchObject({
      mode: 'doubles',
      score: { teamA: 1, teamB: 0 },
      history: [expect.objectContaining({ score: { teamA: 0, teamB: 0 } })],
    });
  });

  it('normalizes legacy saved match previous snapshot into history', () => {
    const match = awardPointToServingTeam(
      createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    );
    const previous = match.history[0];
    const legacy = { ...match, history: undefined, previous };

    window.localStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(legacy));

    const loaded = loadMatchState();
    expect(loaded?.history).toEqual([previous]);
    expect('previous' in (loaded as object)).toBe(false);
  });

  it('falls back to empty match history when saved history is malformed', () => {
    const match = awardPointToServingTeam(
      createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    );
    window.localStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify({ ...match, history: 'bad-history' }));

    expect(loadMatchState()?.history).toEqual([]);
  });

  it('does not throw when saving preferences fails', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage full');
    });

    expect(() => savePreferences(DEFAULT_PREFERENCES)).not.toThrow();

    setItem.mockRestore();
  });
});
