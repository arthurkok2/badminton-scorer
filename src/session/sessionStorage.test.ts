import {
  appendToSessionArchive,
  clearActiveSession,
  isSessionImportedForUser,
  loadActiveSession,
  loadSavedPlayers,
  loadSessionArchive,
  markSessionImportedForUser,
  saveActiveSession,
  saveSavedPlayers,
} from './sessionStorage';
import { createLegacySessionFromPlayerNames, applyMatchResult, archiveSession } from './sessionScheduler';

describe('session storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns undefined when no active session is saved', () => {
    expect(loadActiveSession()).toBeUndefined();
  });

  it('saves and loads an active session', () => {
    const session = createLegacySessionFromPlayerNames(['Alice', 'Bob', 'Carol', 'Dave']);
    saveActiveSession(session);

    expect(loadActiveSession()).toEqual(session);
  });

  it('clears the active session', () => {
    saveActiveSession(createLegacySessionFromPlayerNames(['Alice', 'Bob', 'Carol', 'Dave']));
    clearActiveSession();

    expect(loadActiveSession()).toBeUndefined();
  });

  it('returns empty array when no archive exists', () => {
    expect(loadSessionArchive()).toEqual([]);
  });

  it('appends sessions to the archive', () => {
    const session = createLegacySessionFromPlayerNames(['Alice', 'Bob', 'Carol', 'Dave']);
    const split = { teamA: [session.players[0], session.players[1]], teamB: [session.players[2], session.players[3]] } as const;
    const archived = archiveSession(applyMatchResult(session, split, 'teamA'), '2026-05-11T10:00:00.000Z');

    appendToSessionArchive(archived);

    expect(loadSessionArchive()).toHaveLength(1);
    expect(loadSessionArchive()[0].id).toBe(archived.id);
  });

  it('appends without overwriting previous archive entries', () => {
    const session1 = createLegacySessionFromPlayerNames(['Alice', 'Bob', 'Carol', 'Dave']);
    const session2 = createLegacySessionFromPlayerNames(['Alice', 'Bob', 'Carol', 'Dave']);
    const split1 = { teamA: [session1.players[0], session1.players[1]], teamB: [session1.players[2], session1.players[3]] } as const;
    const split2 = { teamA: [session2.players[0], session2.players[1]], teamB: [session2.players[2], session2.players[3]] } as const;
    appendToSessionArchive(archiveSession(applyMatchResult(session1, split1, 'teamA'), '2026-05-11T10:00:00.000Z'));
    appendToSessionArchive(archiveSession(applyMatchResult(session2, split2, 'teamB'), '2026-05-11T11:00:00.000Z'));

    expect(loadSessionArchive()).toHaveLength(2);
  });

  it('returns empty array for saved players when none stored', () => {
    expect(loadSavedPlayers()).toEqual([]);
  });

  it('saves and loads saved player names', () => {
    saveSavedPlayers(['Alice', 'Bob', 'Carol']);

    expect(loadSavedPlayers()).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('does not throw when storage write fails', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage full');
    });

    expect(() => saveActiveSession(createLegacySessionFromPlayerNames(['Alice', 'Bob', 'Carol', 'Dave']))).not.toThrow();

    setItem.mockRestore();
  });

  it('tracks imported local sessions per user', () => {
    expect(isSessionImportedForUser('uid-1', 'session-1')).toBe(false);

    markSessionImportedForUser('uid-1', 'session-1');

    expect(isSessionImportedForUser('uid-1', 'session-1')).toBe(true);
    expect(isSessionImportedForUser('uid-2', 'session-1')).toBe(false);
  });
});
