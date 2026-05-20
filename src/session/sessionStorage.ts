import type { ActiveSession, ArchivedSession, TeamSplit } from './sessionTypes';

const ACTIVE_SESSION_KEY = 'badminton-scorer-active-session';
const SESSION_ARCHIVE_KEY = 'badminton-scorer-session-archive';
const SAVED_PLAYERS_KEY = 'badminton-scorer-saved-players';
const IMPORTED_SESSION_MARKERS_KEY = 'badminton-scorer-imported-session-markers';
const IN_PROGRESS_MATCH_KEY = 'badminton-scorer-in-progress-match';

export interface InProgressMatchState {
  readonly split: TeamSplit;
  readonly startedAt: string;
}

export function loadActiveSession(): ActiveSession | undefined {
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.id !== 'string') return undefined;
    return parsed as ActiveSession;
  } catch {
    return undefined;
  }
}

export function saveActiveSession(session: ActiveSession): void {
  try {
    window.localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Non-critical; can fail in private mode or when storage is full.
  }
}

export function clearActiveSession(): void {
  try {
    window.localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function loadSessionArchive(): ArchivedSession[] {
  try {
    const raw = window.localStorage.getItem(SESSION_ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ArchivedSession[]) : [];
  } catch {
    return [];
  }
}

export function appendToSessionArchive(session: ArchivedSession): void {
  try {
    const archive = loadSessionArchive();
    window.localStorage.setItem(SESSION_ARCHIVE_KEY, JSON.stringify([...archive, session]));
  } catch {
    // Non-critical.
  }
}

export function loadSavedPlayers(): string[] {
  try {
    const raw = window.localStorage.getItem(SAVED_PLAYERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function saveSavedPlayers(players: readonly string[]): void {
  try {
    window.localStorage.setItem(SAVED_PLAYERS_KEY, JSON.stringify(players));
  } catch {
    // Non-critical.
  }
}

export function isSessionImportedForUser(uid: string, sessionId: string): boolean {
  return loadImportedSessionMarkers().includes(importMarker(uid, sessionId));
}

export function markSessionImportedForUser(uid: string, sessionId: string): void {
  try {
    const markers = new Set(loadImportedSessionMarkers());
    markers.add(importMarker(uid, sessionId));
    window.localStorage.setItem(IMPORTED_SESSION_MARKERS_KEY, JSON.stringify([...markers]));
  } catch {
    // Non-critical.
  }
}

function loadImportedSessionMarkers(): string[] {
  try {
    const raw = window.localStorage.getItem(IMPORTED_SESSION_MARKERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function importMarker(uid: string, sessionId: string): string {
  return `${uid}:${sessionId}`;
}

export function loadInProgressMatchState(): InProgressMatchState | undefined {
  try {
    const raw = window.localStorage.getItem(IN_PROGRESS_MATCH_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.startedAt !== 'string' || !parsed.split) return undefined;
    return parsed as InProgressMatchState;
  } catch {
    return undefined;
  }
}

export function saveInProgressMatchState(state: InProgressMatchState): void {
  try {
    window.localStorage.setItem(IN_PROGRESS_MATCH_KEY, JSON.stringify(state));
  } catch {
    // Non-critical.
  }
}

export function clearInProgressMatchState(): void {
  try {
    window.localStorage.removeItem(IN_PROGRESS_MATCH_KEY);
  } catch {
    // ignore
  }
}
