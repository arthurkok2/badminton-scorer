import {
  appendToSessionArchive,
  clearActiveSession,
  loadActiveSession,
  loadSavedPlayers,
  loadSessionArchive,
  saveActiveSession,
  saveSavedPlayers,
} from './sessionStorage';
import { createSession, applyMatchResult, archiveSession } from './sessionScheduler';
import type { TeamSplit } from './sessionTypes';

describe('session storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns undefined when no active session is saved', () => {
    expect(loadActiveSession()).toBeUndefined();
  });

  it('saves and loads an active session', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave']);
    saveActiveSession(session);

    expect(loadActiveSession()).toEqual(session);
  });

  it('clears the active session', () => {
    saveActiveSession(createSession(['Alice', 'Bob', 'Carol', 'Dave']));
    clearActiveSession();

    expect(loadActiveSession()).toBeUndefined();
  });

  it('returns empty array when no archive exists', () => {
    expect(loadSessionArchive()).toEqual([]);
  });

  it('appends sessions to the archive', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };
    const archived = archiveSession(applyMatchResult(session, split, 'teamA'), '2026-05-11T10:00:00.000Z');

    appendToSessionArchive(archived);

    expect(loadSessionArchive()).toHaveLength(1);
    expect(loadSessionArchive()[0].id).toBe(archived.id);
  });

  it('appends without overwriting previous archive entries', () => {
    const session1 = createSession(['Alice', 'Bob', 'Carol', 'Dave']);
    const session2 = createSession(['Alice', 'Bob', 'Carol', 'Dave']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };
    appendToSessionArchive(archiveSession(applyMatchResult(session1, split, 'teamA'), '2026-05-11T10:00:00.000Z'));
    appendToSessionArchive(archiveSession(applyMatchResult(session2, split, 'teamB'), '2026-05-11T11:00:00.000Z'));

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

    expect(() => saveActiveSession(createSession(['Alice', 'Bob', 'Carol', 'Dave']))).not.toThrow();

    setItem.mockRestore();
  });
});
