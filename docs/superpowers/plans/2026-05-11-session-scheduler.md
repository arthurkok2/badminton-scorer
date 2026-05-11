# Session Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Session mode to the badminton scorer that manages player rotation, fair break assignment, and varied team pairings across multiple matches.

**Architecture:** A pure scheduler module (`src/session/sessionScheduler.ts`) handles all rotation and pairing logic as immutable state transforms. A storage module (`src/session/sessionStorage.ts`) persists the active session and an archive to localStorage. Two new React components (`SessionSetup`, `MatchSuggestion`) handle the session UI phases. `App.tsx` gains a top-level match/session mode toggle and routes between the existing scorer and the session flow.

**Tech Stack:** TypeScript, React 19, Vitest, @testing-library/react, localStorage

---

## File Structure

**New files:**
- `src/session/sessionTypes.ts` — all session domain types
- `src/session/sessionScheduler.ts` — pure rotation and pairing functions
- `src/session/sessionScheduler.test.ts` — scheduler unit tests
- `src/session/sessionStorage.ts` — localStorage read/write for session state and archive
- `src/session/sessionStorage.test.ts` — storage unit tests
- `src/components/SessionSetup.tsx` — player roster setup screen
- `src/components/SessionSetup.test.tsx` — setup component tests
- `src/components/MatchSuggestion.tsx` — match suggestion and override screen
- `src/components/MatchSuggestion.test.tsx` — suggestion component tests

**Modified files:**
- `src/App.tsx` — top-level mode toggle and session phase routing
- `src/styles.css` — styles for new components

---

### Task 1: Session Types

**Files:**
- Create: `src/session/sessionTypes.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/session/sessionTypes.ts

export interface SessionPlayer {
  readonly name: string;
  readonly gamesPlayed: number;
  readonly consecutiveStreak: number;
  readonly onBreak: boolean;
}

export interface TeamSplit {
  readonly teamA: readonly [string, string];
  readonly teamB: readonly [string, string];
}

export interface MatchRecord {
  readonly teamA: readonly [string, string];
  readonly teamB: readonly [string, string];
  readonly winnerTeam: 'teamA' | 'teamB';
}

export interface PairingMatrix {
  readonly together: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly against: Readonly<Record<string, Readonly<Record<string, number>>>>;
}

export interface MatchSuggestion {
  readonly rankedSplits: readonly [TeamSplit, TeamSplit, TeamSplit];
  readonly onBreak: readonly string[];
}

export interface ActiveSession {
  readonly id: string;
  readonly startedAt: string;
  readonly players: readonly SessionPlayer[];
  readonly matches: readonly MatchRecord[];
  readonly pairingMatrix: PairingMatrix;
}

export interface ArchivedPlayer {
  readonly name: string;
  readonly gamesPlayed: number;
  readonly breaksTaken: number;
}

export interface ArchivedSession {
  readonly id: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly players: readonly ArchivedPlayer[];
  readonly matches: readonly MatchRecord[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/session/sessionTypes.ts
git commit -m "feat: add session domain types"
```

---

### Task 2: Session Scheduler — Core Functions

**Files:**
- Create: `src/session/sessionScheduler.ts`
- Create: `src/session/sessionScheduler.test.ts`

- [ ] **Step 1: Write failing tests for createSession, selectNextPlayers, rankSplitsForPlayers**

```ts
// src/session/sessionScheduler.test.ts
import { createSession, selectNextPlayers, rankSplitsForPlayers } from './sessionScheduler';
import type { PairingMatrix, SessionPlayer } from './sessionTypes';

const emptyMatrix: PairingMatrix = { together: {}, against: {} };

describe('createSession', () => {
  it('creates a session with all players set to onBreak', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);

    expect(session.players).toHaveLength(5);
    expect(session.players.map(p => p.name)).toEqual(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    expect(session.players.every(p => p.onBreak)).toBe(true);
    expect(session.players.every(p => p.gamesPlayed === 0)).toBe(true);
    expect(session.matches).toHaveLength(0);
    expect(session.pairingMatrix).toEqual({ together: {}, against: {} });
  });
});

describe('selectNextPlayers', () => {
  it('selects all players when there are exactly 4', () => {
    const players: SessionPlayer[] = [
      { name: 'Alice', gamesPlayed: 2, consecutiveStreak: 2, onBreak: false },
      { name: 'Bob', gamesPlayed: 2, consecutiveStreak: 2, onBreak: false },
      { name: 'Carol', gamesPlayed: 2, consecutiveStreak: 2, onBreak: false },
      { name: 'Dave', gamesPlayed: 2, consecutiveStreak: 2, onBreak: false },
    ];

    const { selected, onBreak } = selectNextPlayers(players);

    expect(selected).toHaveLength(4);
    expect(onBreak).toHaveLength(0);
    expect(selected).toContain('Alice');
  });

  it('always brings players on break on first', () => {
    const players: SessionPlayer[] = [
      { name: 'Alice', gamesPlayed: 3, consecutiveStreak: 3, onBreak: false },
      { name: 'Bob', gamesPlayed: 3, consecutiveStreak: 3, onBreak: false },
      { name: 'Carol', gamesPlayed: 3, consecutiveStreak: 3, onBreak: false },
      { name: 'Dave', gamesPlayed: 3, consecutiveStreak: 3, onBreak: false },
      { name: 'Eve', gamesPlayed: 2, consecutiveStreak: 0, onBreak: true },
    ];

    const { selected, onBreak } = selectNextPlayers(players);

    expect(selected).toContain('Eve');
    expect(onBreak).not.toContain('Eve');
  });

  it('sits out the on-court player with the longest consecutive streak', () => {
    const players: SessionPlayer[] = [
      { name: 'Alice', gamesPlayed: 4, consecutiveStreak: 4, onBreak: false },
      { name: 'Bob', gamesPlayed: 3, consecutiveStreak: 1, onBreak: false },
      { name: 'Carol', gamesPlayed: 3, consecutiveStreak: 1, onBreak: false },
      { name: 'Dave', gamesPlayed: 3, consecutiveStreak: 1, onBreak: false },
      { name: 'Eve', gamesPlayed: 2, consecutiveStreak: 0, onBreak: true },
    ];

    const { selected, onBreak } = selectNextPlayers(players);

    expect(selected).toContain('Eve');
    expect(onBreak).toContain('Alice');
    expect(selected).not.toContain('Alice');
  });

  it('prefers break player with fewer games when multiple on-break players exceed the 4-slot limit', () => {
    const players: SessionPlayer[] = [
      { name: 'Alice', gamesPlayed: 5, consecutiveStreak: 0, onBreak: true },
      { name: 'Bob', gamesPlayed: 3, consecutiveStreak: 0, onBreak: true },
      { name: 'Carol', gamesPlayed: 3, consecutiveStreak: 0, onBreak: true },
      { name: 'Dave', gamesPlayed: 3, consecutiveStreak: 0, onBreak: true },
      { name: 'Eve', gamesPlayed: 3, consecutiveStreak: 0, onBreak: true },
    ];

    const { onBreak } = selectNextPlayers(players);

    expect(onBreak).toContain('Alice');
    expect(onBreak).toHaveLength(1);
  });
});

describe('rankSplitsForPlayers', () => {
  it('returns exactly 3 splits covering all 4 players', () => {
    const splits = rankSplitsForPlayers(['Alice', 'Bob', 'Carol', 'Dave'], emptyMatrix);

    expect(splits).toHaveLength(3);
    for (const split of splits) {
      const names = [...split.teamA, ...split.teamB].sort();
      expect(names).toEqual(['Alice', 'Bob', 'Carol', 'Dave'].sort());
    }
  });

  it('ranks the split with fewer partner repeats first', () => {
    const matrix: PairingMatrix = {
      together: {
        Alice: { Bob: 3 },
        Bob: { Alice: 3 },
      },
      against: {},
    };

    const splits = rankSplitsForPlayers(['Alice', 'Bob', 'Carol', 'Dave'], matrix);

    // Best split should not pair Alice with Bob (3 repeats together)
    const [a1, a2] = splits[0].teamA;
    const [b1, b2] = splits[0].teamB;
    expect([a1, a2]).not.toEqual(expect.arrayContaining(['Alice', 'Bob']));
    expect([b1, b2]).not.toEqual(expect.arrayContaining(['Alice', 'Bob']));
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- sessionScheduler`
Expected: FAIL — Cannot find module `'./sessionScheduler'`

- [ ] **Step 3: Implement the three functions**

```ts
// src/session/sessionScheduler.ts
import type {
  ActiveSession,
  ArchivedSession,
  MatchRecord,
  MatchSuggestion,
  PairingMatrix,
  SessionPlayer,
  TeamSplit,
} from './sessionTypes';

export function createSession(playerNames: readonly string[]): ActiveSession {
  return {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    players: playerNames.map(name => ({
      name,
      gamesPlayed: 0,
      consecutiveStreak: 0,
      onBreak: true,
    })),
    matches: [],
    pairingMatrix: { together: {}, against: {} },
  };
}

export function selectNextPlayers(players: readonly SessionPlayer[]): {
  readonly selected: readonly [string, string, string, string];
  readonly onBreak: readonly string[];
} {
  if (players.length <= 4) {
    return {
      selected: players.map(p => p.name) as unknown as readonly [string, string, string, string],
      onBreak: [],
    };
  }

  const breakPlayers = [...players]
    .filter(p => p.onBreak)
    .sort((a, b) => a.gamesPlayed - b.gamesPlayed);
  const onCourtPlayers = [...players]
    .filter(p => !p.onBreak)
    .sort((a, b) => a.consecutiveStreak - b.consecutiveStreak);

  // Break players (fewest games first) take priority over on-court players.
  // On-court players with highest streak sit out (they end up at the tail of prioritized).
  const prioritized = [...breakPlayers, ...onCourtPlayers];

  return {
    selected: prioritized.slice(0, 4).map(p => p.name) as unknown as readonly [string, string, string, string],
    onBreak: prioritized.slice(4).map(p => p.name),
  };
}

function getPairCount(
  matrix: Readonly<Record<string, Readonly<Record<string, number>>>>,
  a: string,
  b: string,
): number {
  return matrix[a]?.[b] ?? 0;
}

function scoreTeamSplit(split: TeamSplit, matrix: PairingMatrix): number {
  const [a1, a2] = split.teamA;
  const [b1, b2] = split.teamB;
  const togetherScore =
    (getPairCount(matrix.together, a1, a2) + getPairCount(matrix.together, b1, b2)) * 2;
  const againstScore =
    getPairCount(matrix.against, a1, b1) +
    getPairCount(matrix.against, a1, b2) +
    getPairCount(matrix.against, a2, b1) +
    getPairCount(matrix.against, a2, b2);
  return togetherScore + againstScore;
}

export function rankSplitsForPlayers(
  players: readonly [string, string, string, string],
  matrix: PairingMatrix,
): readonly [TeamSplit, TeamSplit, TeamSplit] {
  const [p0, p1, p2, p3] = players;
  const splits: [TeamSplit, TeamSplit, TeamSplit] = [
    { teamA: [p0, p1], teamB: [p2, p3] },
    { teamA: [p0, p2], teamB: [p1, p3] },
    { teamA: [p0, p3], teamB: [p1, p2] },
  ];
  splits.sort((a, b) => scoreTeamSplit(a, matrix) - scoreTeamSplit(b, matrix));
  return splits;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- sessionScheduler`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/sessionScheduler.ts src/session/sessionScheduler.test.ts
git commit -m "feat: add session scheduler core functions"
```

---

### Task 3: Session Scheduler — Match Flow

**Files:**
- Modify: `src/session/sessionScheduler.ts`
- Modify: `src/session/sessionScheduler.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `src/session/sessionScheduler.test.ts`:

```ts
import { createSession, selectNextPlayers, rankSplitsForPlayers, generateMatchSuggestion, applyMatchResult, archiveSession } from './sessionScheduler';

describe('generateMatchSuggestion', () => {
  it('returns 3 ranked splits and the on-break list', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const suggestion = generateMatchSuggestion(session);

    expect(suggestion.rankedSplits).toHaveLength(3);
    expect(suggestion.onBreak).toHaveLength(1);
  });

  it('all players appear exactly once across splits and break', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const suggestion = generateMatchSuggestion(session);

    const playing = [...suggestion.rankedSplits[0].teamA, ...suggestion.rankedSplits[0].teamB];
    const all = [...playing, ...suggestion.onBreak].sort();
    expect(all).toEqual(['Alice', 'Bob', 'Carol', 'Dave', 'Eve'].sort());
  });
});

describe('applyMatchResult', () => {
  it('increments gamesPlayed and consecutiveStreak for players who played', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };

    const next = applyMatchResult(session, split, 'teamA');

    const alice = next.players.find(p => p.name === 'Alice')!;
    expect(alice.gamesPlayed).toBe(1);
    expect(alice.consecutiveStreak).toBe(1);
    expect(alice.onBreak).toBe(false);
  });

  it('resets consecutiveStreak and sets onBreak for the player who sat out', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };

    const next = applyMatchResult(session, split, 'teamA');

    const eve = next.players.find(p => p.name === 'Eve')!;
    expect(eve.consecutiveStreak).toBe(0);
    expect(eve.onBreak).toBe(true);
    expect(eve.gamesPlayed).toBe(0);
  });

  it('appends the match record to history', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };

    const next = applyMatchResult(session, split, 'teamB');

    expect(next.matches).toHaveLength(1);
    expect(next.matches[0]).toEqual({ teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'], winnerTeam: 'teamB' });
  });

  it('increments partner together count symmetrically', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };

    const next = applyMatchResult(session, split, 'teamA');

    expect(next.pairingMatrix.together['Alice']?.['Bob']).toBe(1);
    expect(next.pairingMatrix.together['Bob']?.['Alice']).toBe(1);
    expect(next.pairingMatrix.together['Carol']?.['Dave']).toBe(1);
  });

  it('increments against count for all cross-team pairs', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };

    const next = applyMatchResult(session, split, 'teamA');

    expect(next.pairingMatrix.against['Alice']?.['Carol']).toBe(1);
    expect(next.pairingMatrix.against['Alice']?.['Dave']).toBe(1);
    expect(next.pairingMatrix.against['Bob']?.['Carol']).toBe(1);
    expect(next.pairingMatrix.against['Bob']?.['Dave']).toBe(1);
  });
});

describe('archiveSession', () => {
  it('produces correct player summaries', () => {
    const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
    const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };
    const after = applyMatchResult(session, split, 'teamA');

    const archive = archiveSession(after, '2026-05-11T10:00:00.000Z');

    const alice = archive.players.find(p => p.name === 'Alice')!;
    expect(alice.gamesPlayed).toBe(1);
    expect(alice.breaksTaken).toBe(0);

    const eve = archive.players.find(p => p.name === 'Eve')!;
    expect(eve.gamesPlayed).toBe(0);
    expect(eve.breaksTaken).toBe(1);

    expect(archive.endedAt).toBe('2026-05-11T10:00:00.000Z');
    expect(archive.matches).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- sessionScheduler`
Expected: FAIL — `generateMatchSuggestion`, `applyMatchResult`, `archiveSession` not exported

- [ ] **Step 3: Implement the three functions — append to `src/session/sessionScheduler.ts`**

```ts
export function generateMatchSuggestion(session: ActiveSession): MatchSuggestion {
  const { selected, onBreak } = selectNextPlayers(session.players);
  const rankedSplits = rankSplitsForPlayers(selected, session.pairingMatrix);
  return { rankedSplits, onBreak };
}

function incrementPairCount(
  matrix: Readonly<Record<string, Readonly<Record<string, number>>>>,
  a: string,
  b: string,
): Readonly<Record<string, Readonly<Record<string, number>>>> {
  return {
    ...matrix,
    [a]: { ...matrix[a], [b]: (matrix[a]?.[b] ?? 0) + 1 },
    [b]: { ...matrix[b], [a]: (matrix[b]?.[a] ?? 0) + 1 },
  };
}

function updatePairingMatrix(matrix: PairingMatrix, split: TeamSplit): PairingMatrix {
  const [a1, a2] = split.teamA;
  const [b1, b2] = split.teamB;
  let together = matrix.together;
  together = incrementPairCount(together, a1, a2);
  together = incrementPairCount(together, b1, b2);
  let against = matrix.against;
  against = incrementPairCount(against, a1, b1);
  against = incrementPairCount(against, a1, b2);
  against = incrementPairCount(against, a2, b1);
  against = incrementPairCount(against, a2, b2);
  return { together, against };
}

export function applyMatchResult(
  session: ActiveSession,
  split: TeamSplit,
  winnerTeam: 'teamA' | 'teamB',
): ActiveSession {
  const playedNames = new Set([...split.teamA, ...split.teamB]);
  const newMatrix = updatePairingMatrix(session.pairingMatrix, split);
  const newPlayers: SessionPlayer[] = session.players.map(player =>
    playedNames.has(player.name)
      ? { ...player, gamesPlayed: player.gamesPlayed + 1, consecutiveStreak: player.consecutiveStreak + 1, onBreak: false }
      : { ...player, consecutiveStreak: 0, onBreak: true },
  );
  const matchRecord: MatchRecord = { teamA: split.teamA, teamB: split.teamB, winnerTeam };
  return { ...session, players: newPlayers, matches: [...session.matches, matchRecord], pairingMatrix: newMatrix };
}

export function archiveSession(session: ActiveSession, endedAt: string): ArchivedSession {
  return {
    id: session.id,
    startedAt: session.startedAt,
    endedAt,
    players: session.players.map(player => ({
      name: player.name,
      gamesPlayed: player.gamesPlayed,
      breaksTaken: session.matches.length - player.gamesPlayed,
    })),
    matches: session.matches,
  };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- sessionScheduler`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/sessionScheduler.ts src/session/sessionScheduler.test.ts
git commit -m "feat: add session scheduler match flow"
```

---

### Task 4: Session Storage

**Files:**
- Create: `src/session/sessionStorage.ts`
- Create: `src/session/sessionStorage.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/session/sessionStorage.test.ts
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- sessionStorage`
Expected: FAIL — Cannot find module `'./sessionStorage'`

- [ ] **Step 3: Implement session storage**

```ts
// src/session/sessionStorage.ts
import type { ActiveSession, ArchivedSession } from './sessionTypes';

const ACTIVE_SESSION_KEY = 'badminton-scorer-active-session';
const SESSION_ARCHIVE_KEY = 'badminton-scorer-session-archive';
const SAVED_PLAYERS_KEY = 'badminton-scorer-saved-players';

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
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- sessionStorage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/session/sessionStorage.ts src/session/sessionStorage.test.ts
git commit -m "feat: add session storage"
```

---

### Task 5: SessionSetup Component

**Files:**
- Create: `src/components/SessionSetup.tsx`
- Create: `src/components/SessionSetup.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/SessionSetup.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SessionSetup } from './SessionSetup';

describe('SessionSetup', () => {
  it('shows a disabled start button with fewer than 4 players', () => {
    render(<SessionSetup savedPlayers={[]} onStartSession={vi.fn()} />);

    expect(screen.getByRole('button', { name: /start session/i })).toBeDisabled();
  });

  it('shows saved player chips for quick-add', () => {
    render(<SessionSetup savedPlayers={['Alice', 'Bob']} onStartSession={vi.fn()} />);

    expect(screen.getByRole('button', { name: /add alice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add bob/i })).toBeInTheDocument();
  });

  it('adds a player from a chip and enables start after 4 players', async () => {
    render(<SessionSetup savedPlayers={['Alice', 'Bob', 'Carol', 'Dave']} onStartSession={vi.fn()} />);

    for (const name of ['Alice', 'Bob', 'Carol', 'Dave']) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`add ${name}`, 'i') }));
    }

    expect(screen.getByRole('button', { name: /start session/i })).not.toBeDisabled();
  });

  it('adds a player by typing and clicking Add', async () => {
    render(<SessionSetup savedPlayers={[]} onStartSession={vi.fn()} />);

    await userEvent.type(screen.getByRole('textbox', { name: /player name/i }), 'Zara');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(screen.getByText('Zara')).toBeInTheDocument();
  });

  it('removes a player when their remove button is clicked', async () => {
    render(<SessionSetup savedPlayers={['Alice']} onStartSession={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /add alice/i }));
    await userEvent.click(screen.getByRole('button', { name: /remove alice/i }));

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('calls onStartSession with the current player list', async () => {
    const onStartSession = vi.fn();
    render(<SessionSetup savedPlayers={['Alice', 'Bob', 'Carol', 'Dave']} onStartSession={onStartSession} />);

    for (const name of ['Alice', 'Bob', 'Carol', 'Dave']) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`add ${name}`, 'i') }));
    }
    await userEvent.click(screen.getByRole('button', { name: /start session/i }));

    expect(onStartSession).toHaveBeenCalledWith(['Alice', 'Bob', 'Carol', 'Dave']);
  });

  it('does not add a duplicate name', async () => {
    render(<SessionSetup savedPlayers={['Alice']} onStartSession={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /add alice/i }));
    await userEvent.click(screen.getByRole('button', { name: /add alice/i }));

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- SessionSetup`
Expected: FAIL — Cannot find module `'./SessionSetup'`

- [ ] **Step 3: Implement SessionSetup**

```tsx
// src/components/SessionSetup.tsx
import { useState } from 'react';

interface SessionSetupProps {
  readonly savedPlayers: readonly string[];
  readonly onStartSession: (playerNames: readonly string[]) => void;
}

export function SessionSetup({ savedPlayers, onStartSession }: SessionSetupProps) {
  const [players, setPlayers] = useState<string[]>([]);
  const [nameInput, setNameInput] = useState('');

  function addPlayer(name: string) {
    const trimmed = name.trim();
    if (!trimmed || players.includes(trimmed)) return;
    setPlayers(prev => [...prev, trimmed]);
    setNameInput('');
  }

  function removePlayer(name: string) {
    setPlayers(prev => prev.filter(p => p !== name));
  }

  const availableChips = savedPlayers.filter(name => !players.includes(name));

  return (
    <section className="session-setup" aria-label="Session setup">
      <h2>Session setup</h2>

      {availableChips.length > 0 && (
        <div className="session-player-chips">
          {availableChips.map(name => (
            <button key={name} className="session-player-chip" onClick={() => addPlayer(name)} aria-label={`Add ${name}`}>
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="session-add-player">
        <label htmlFor="player-name-input">Player name</label>
        <input
          id="player-name-input"
          type="text"
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addPlayer(nameInput); }}
          placeholder="Type a name…"
        />
        <button onClick={() => addPlayer(nameInput)} aria-label="Add">Add</button>
      </div>

      {players.length > 0 && (
        <ol className="session-player-list">
          {players.map(name => (
            <li key={name}>
              <span>{name}</span>
              <button onClick={() => removePlayer(name)} aria-label={`Remove ${name}`}>Remove</button>
            </li>
          ))}
        </ol>
      )}

      <p className="session-player-count">
        {players.length} player{players.length !== 1 ? 's' : ''} — need at least 4
      </p>

      <button
        className="session-start-button"
        disabled={players.length < 4}
        onClick={() => onStartSession(players)}
      >
        Start session
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- SessionSetup`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SessionSetup.tsx src/components/SessionSetup.test.tsx
git commit -m "feat: add SessionSetup component"
```

---

### Task 6: MatchSuggestion Component

**Files:**
- Create: `src/components/MatchSuggestion.tsx`
- Create: `src/components/MatchSuggestion.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/MatchSuggestion.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MatchSuggestion } from './MatchSuggestion';
import type {
  MatchSuggestion as MatchSuggestionData,
  PairingMatrix,
  SessionPlayer,
} from '../session/sessionTypes';

const suggestion: MatchSuggestionData = {
  rankedSplits: [
    { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] },
    { teamA: ['Alice', 'Carol'], teamB: ['Bob', 'Dave'] },
    { teamA: ['Alice', 'Dave'], teamB: ['Bob', 'Carol'] },
  ],
  onBreak: ['Eve'],
};

const allPlayers: SessionPlayer[] = [
  { name: 'Alice', gamesPlayed: 1, consecutiveStreak: 1, onBreak: false },
  { name: 'Bob', gamesPlayed: 1, consecutiveStreak: 1, onBreak: false },
  { name: 'Carol', gamesPlayed: 1, consecutiveStreak: 1, onBreak: false },
  { name: 'Dave', gamesPlayed: 1, consecutiveStreak: 1, onBreak: false },
  { name: 'Eve', gamesPlayed: 0, consecutiveStreak: 0, onBreak: true },
];

const emptyMatrix: PairingMatrix = { together: {}, against: {} };

function renderSuggestion(overrides?: Partial<React.ComponentProps<typeof MatchSuggestion>>) {
  return render(
    <MatchSuggestion
      suggestion={suggestion}
      allPlayers={allPlayers}
      pairingMatrix={emptyMatrix}
      onStartMatch={vi.fn()}
      onEditPlayers={vi.fn()}
      onEndSession={vi.fn()}
      {...overrides}
    />,
  );
}

describe('MatchSuggestion', () => {
  it('shows all four playing players and the break player', () => {
    renderSuggestion();

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.getByText('Dave')).toBeInTheDocument();
    expect(screen.getByText('Eve')).toBeInTheDocument();
  });

  it('cycles to the next ranked split on Swap', async () => {
    renderSuggestion();

    await userEvent.click(screen.getByRole('button', { name: /swap teams/i }));

    // After one swap: Alice & Carol vs Bob & Dave (rankedSplits[1])
    const teamA = screen.getByRole('group', { name: /team a/i });
    expect(teamA).toHaveTextContent('Alice');
    expect(teamA).toHaveTextContent('Carol');
  });

  it('wraps back to the first split after three swaps', async () => {
    renderSuggestion();

    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole('button', { name: /swap teams/i }));
    }

    const teamA = screen.getByRole('group', { name: /team a/i });
    expect(teamA).toHaveTextContent('Alice');
    expect(teamA).toHaveTextContent('Bob');
  });

  it('calls onStartMatch with the current split', async () => {
    const onStartMatch = vi.fn();
    renderSuggestion({ onStartMatch });

    await userEvent.click(screen.getByRole('button', { name: /start match/i }));

    expect(onStartMatch).toHaveBeenCalledWith(suggestion.rankedSplits[0]);
  });

  it('calls onStartMatch with the swapped split after one swap', async () => {
    const onStartMatch = vi.fn();
    renderSuggestion({ onStartMatch });

    await userEvent.click(screen.getByRole('button', { name: /swap teams/i }));
    await userEvent.click(screen.getByRole('button', { name: /start match/i }));

    expect(onStartMatch).toHaveBeenCalledWith(suggestion.rankedSplits[1]);
  });

  it('calls onEditPlayers when Edit players is clicked', async () => {
    const onEditPlayers = vi.fn();
    renderSuggestion({ onEditPlayers });

    await userEvent.click(screen.getByRole('button', { name: /edit players/i }));

    expect(onEditPlayers).toHaveBeenCalled();
  });

  it('calls onEndSession when End session is clicked', async () => {
    const onEndSession = vi.fn();
    renderSuggestion({ onEndSession });

    await userEvent.click(screen.getByRole('button', { name: /end session/i }));

    expect(onEndSession).toHaveBeenCalled();
  });

  it('shows break-swap selects when Change break is clicked', async () => {
    renderSuggestion();

    await userEvent.click(screen.getByRole('button', { name: /change break/i }));

    expect(screen.getByRole('combobox', { name: /who sits out/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /who comes on/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- MatchSuggestion`
Expected: FAIL — Cannot find module `'./MatchSuggestion'`

- [ ] **Step 3: Implement MatchSuggestion**

```tsx
// src/components/MatchSuggestion.tsx
import { useState } from 'react';
import { rankSplitsForPlayers } from '../session/sessionScheduler';
import type {
  MatchSuggestion as MatchSuggestionData,
  PairingMatrix,
  SessionPlayer,
  TeamSplit,
} from '../session/sessionTypes';

interface MatchSuggestionProps {
  readonly suggestion: MatchSuggestionData;
  readonly allPlayers: readonly SessionPlayer[];
  readonly pairingMatrix: PairingMatrix;
  readonly onStartMatch: (split: TeamSplit) => void;
  readonly onEditPlayers: () => void;
  readonly onEndSession: () => void;
}

export function MatchSuggestion({
  suggestion,
  allPlayers: _allPlayers,
  pairingMatrix,
  onStartMatch,
  onEditPlayers,
  onEndSession,
}: MatchSuggestionProps) {
  const [rankedSplits, setRankedSplits] = useState(suggestion.rankedSplits);
  const [onBreak, setOnBreak] = useState(suggestion.onBreak);
  const [splitIndex, setSplitIndex] = useState<0 | 1 | 2>(0);
  const [showBreakPicker, setShowBreakPicker] = useState(false);
  const [swapOut, setSwapOut] = useState('');
  const [swapIn, setSwapIn] = useState('');

  const currentSplit = rankedSplits[splitIndex];
  const playingNow = [...rankedSplits[0].teamA, ...rankedSplits[0].teamB] as [string, string, string, string];

  function handleSwap() {
    setSplitIndex(prev => ((prev + 1) % 3) as 0 | 1 | 2);
  }

  function handleConfirmBreakChange() {
    if (!swapOut || !swapIn) return;
    const newFour = playingNow.map(name => (name === swapOut ? swapIn : name)) as [string, string, string, string];
    const newRanked = rankSplitsForPlayers(newFour, pairingMatrix);
    setRankedSplits(newRanked);
    setOnBreak([...onBreak.filter(n => n !== swapIn), swapOut]);
    setSplitIndex(0);
    setShowBreakPicker(false);
    setSwapOut('');
    setSwapIn('');
  }

  return (
    <section className="match-suggestion" aria-label="Next match">
      <h2>Next match</h2>

      <div className="match-suggestion-teams">
        <fieldset role="group" aria-label="Team A">
          <legend>Team A</legend>
          <span>{currentSplit.teamA[0]}</span>
          <span>{currentSplit.teamA[1]}</span>
        </fieldset>
        <span className="match-suggestion-vs">vs</span>
        <fieldset role="group" aria-label="Team B">
          <legend>Team B</legend>
          <span>{currentSplit.teamB[0]}</span>
          <span>{currentSplit.teamB[1]}</span>
        </fieldset>
      </div>

      {onBreak.length > 0 && (
        <p className="match-suggestion-break">On break: {onBreak.join(', ')}</p>
      )}

      <div className="match-suggestion-actions">
        <button onClick={handleSwap} aria-label="Swap teams">Swap teams</button>
        {onBreak.length > 0 && (
          <button onClick={() => setShowBreakPicker(v => !v)} aria-label="Change break">
            Change break
          </button>
        )}
        <button onClick={() => onStartMatch(currentSplit)} aria-label="Start match">Start match</button>
      </div>

      {showBreakPicker && (
        <div className="match-suggestion-break-picker">
          <label htmlFor="swap-out">Who sits out</label>
          <select id="swap-out" value={swapOut} onChange={e => setSwapOut(e.target.value)} aria-label="Who sits out">
            <option value="">Select…</option>
            {playingNow.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <label htmlFor="swap-in">Who comes on</label>
          <select id="swap-in" value={swapIn} onChange={e => setSwapIn(e.target.value)} aria-label="Who comes on">
            <option value="">Select…</option>
            {onBreak.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <button onClick={handleConfirmBreakChange} disabled={!swapOut || !swapIn}>Confirm</button>
        </div>
      )}

      <div className="match-suggestion-secondary">
        <button onClick={onEditPlayers} aria-label="Edit players">Edit players</button>
        <button onClick={onEndSession} aria-label="End session">End session</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- MatchSuggestion`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/MatchSuggestion.tsx src/components/MatchSuggestion.test.tsx
git commit -m "feat: add MatchSuggestion component"
```

---

### Task 7: App Integration

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports — insert after the existing import block in `src/App.tsx`**

```ts
import {
  createSession,
  generateMatchSuggestion,
  applyMatchResult,
  archiveSession,
} from './session/sessionScheduler';
import {
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  appendToSessionArchive,
  loadSavedPlayers,
  saveSavedPlayers,
} from './session/sessionStorage';
import { SessionSetup } from './components/SessionSetup';
import { MatchSuggestion } from './components/MatchSuggestion';
import type { ActiveSession, MatchSuggestion as MatchSuggestionData, TeamSplit } from './session/sessionTypes';
```

- [ ] **Step 2: Add session state — insert after the existing `useState` calls inside `App()`**

```ts
type AppMode = 'match' | 'session';
type SessionPhase = 'setup' | 'suggestion' | 'playing';

const [appMode, setAppMode] = useState<AppMode>(() =>
  loadActiveSession() ? 'session' : 'match',
);
const [sessionPhase, setSessionPhase] = useState<SessionPhase>(() =>
  loadActiveSession() ? 'suggestion' : 'setup',
);
const [activeSession, setActiveSession] = useState<ActiveSession | undefined>(
  () => loadActiveSession(),
);
const [currentSuggestion, setCurrentSuggestion] = useState<MatchSuggestionData | undefined>(() => {
  const saved = loadActiveSession();
  return saved ? generateMatchSuggestion(saved) : undefined;
});
const [currentPlayedSplit, setCurrentPlayedSplit] = useState<TeamSplit | undefined>(undefined);
const [savedPlayers, setSavedPlayers] = useState<string[]>(() => loadSavedPlayers());
```

- [ ] **Step 3: Add session handlers — insert after `handleRerollFirstServer` inside `App()`**

```ts
const handleSwitchToSession = useCallback(() => {
  if (hasStarted(matchView.match) && !window.confirm('Leave this match and start a session?')) return;
  setAppMode('session');
}, [matchView.match]);

const handleSwitchToMatch = useCallback(() => {
  if (activeSession && !window.confirm('End the current session?')) return;
  if (activeSession) {
    appendToSessionArchive(archiveSession(activeSession, new Date().toISOString()));
    clearActiveSession();
    setActiveSession(undefined);
    setCurrentSuggestion(undefined);
  }
  setAppMode('match');
  setSessionPhase('setup');
}, [activeSession]);

const handleStartSession = useCallback((playerNames: readonly string[]) => {
  const merged = Array.from(new Set([...savedPlayers, ...playerNames]));
  saveSavedPlayers(merged);
  setSavedPlayers(merged);
  const session = createSession(playerNames);
  saveActiveSession(session);
  const suggestion = generateMatchSuggestion(session);
  setActiveSession(session);
  setCurrentSuggestion(suggestion);
  setSessionPhase('suggestion');
}, [savedPlayers]);

const handleStartMatch = useCallback((split: TeamSplit) => {
  const playerNames = { A1: split.teamA[0], A2: split.teamA[1], B1: split.teamB[0], B2: split.teamB[1] };
  clearMatchState();
  setMatchView({ match: createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1', playerNames }) });
  setCurrentPlayedSplit(split);
  setSessionPhase('playing');
}, []);

const handleMatchEnded = useCallback((winnerTeam: 'teamA' | 'teamB') => {
  if (!activeSession || !currentPlayedSplit) return;
  const updated = applyMatchResult(activeSession, currentPlayedSplit, winnerTeam);
  saveActiveSession(updated);
  const suggestion = generateMatchSuggestion(updated);
  setActiveSession(updated);
  setCurrentSuggestion(suggestion);
  setCurrentPlayedSplit(undefined);
  setSessionPhase('suggestion');
}, [activeSession, currentPlayedSplit]);

const handleEndSession = useCallback(() => {
  if (!activeSession) return;
  appendToSessionArchive(archiveSession(activeSession, new Date().toISOString()));
  clearActiveSession();
  setActiveSession(undefined);
  setCurrentSuggestion(undefined);
  setSessionPhase('setup');
  setAppMode('match');
}, [activeSession]);

const handleEditPlayers = useCallback(() => {
  setSessionPhase('setup');
}, []);
```

- [ ] **Step 4: Replace the `return (` block with session-aware routing**

```tsx
const matchWinner = match.winnerTeamId;

if (appMode === 'session' && sessionPhase === 'setup') {
  return (
    <main className="app-shell">
      <div className="app-layout">
        <div className="app-mode-toggle">
          <button onClick={handleSwitchToMatch}>← Match mode</button>
        </div>
        <SessionSetup savedPlayers={savedPlayers} onStartSession={handleStartSession} />
      </div>
    </main>
  );
}

if (appMode === 'session' && sessionPhase === 'suggestion' && currentSuggestion && activeSession) {
  return (
    <main className="app-shell">
      <div className="app-layout">
        <MatchSuggestion
          suggestion={currentSuggestion}
          allPlayers={activeSession.players}
          pairingMatrix={activeSession.pairingMatrix}
          onStartMatch={handleStartMatch}
          onEditPlayers={handleEditPlayers}
          onEndSession={handleEndSession}
        />
      </div>
    </main>
  );
}

// Derive player names from the match itself when in session mode so Controls shows the correct names.
const sessionPlayerNames = appMode === 'session'
  ? {
      A1: [...match.teams.teamA.players, ...match.teams.teamB.players].find(p => p.id === 'A1')?.name ?? '',
      A2: [...match.teams.teamA.players, ...match.teams.teamB.players].find(p => p.id === 'A2')?.name ?? '',
      B1: [...match.teams.teamA.players, ...match.teams.teamB.players].find(p => p.id === 'B1')?.name ?? '',
      B2: [...match.teams.teamA.players, ...match.teams.teamB.players].find(p => p.id === 'B2')?.name ?? '',
    }
  : undefined;

return (
  <main className="app-shell">
    <div className="app-layout">
      <div className="app-mode-toggle">
        {appMode === 'match' && (
          <button onClick={handleSwitchToSession}>Session mode</button>
        )}
      </div>
      <Scoreboard match={match} onPointTeam={(teamId) => dispatch({ type: 'POINT_TEAM', teamId })} />
      <CourtView match={match} />
      <Controls
        match={match}
        autoAnnounce={preferences.autoAnnounce}
        matchMode={preferences.matchMode}
        playerNames={sessionPlayerNames ?? preferences.playerNames}
        onUndo={() => dispatch({ type: 'UNDO' })}
        onAnnounce={() => speakAnnouncement(match)}
        onAutoAnnounceChange={(autoAnnounce) => updatePreferences((current) => ({ ...current, autoAnnounce }))}
        onMatchModeChange={handleMatchModeChange}
        onNewMatch={handleNewMatch}
        onSetInitialServer={handleSetInitialServer}
        onRerollFirstServer={handleRerollFirstServer}
        onPlayerNameChange={appMode === 'session' ? () => {} : handlePlayerNameChange}
      />
      <StatusBar
        bluetoothStatus={bluetoothStatus}
        speechStatus={getSpeechStatus()}
        onConnectBluetooth={handleConnectBluetooth}
      />
      <RemoteDiagnostics events={diagnostics} />
      {appMode === 'session' && sessionPhase === 'playing' && matchWinner && (
        <div className="session-match-over" role="dialog" aria-label="Match over">
          <p>{match.teams[matchWinner].name} wins!</p>
          <button onClick={() => handleMatchEnded(matchWinner)}>Next match →</button>
        </div>
      )}
    </div>
  </main>
);
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run lint`
Expected: no errors. If `TeamId` is not imported, add it to the existing import from `'./domain/matchTypes'`.

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate session mode into App"
```

---

### Task 8: Styles

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Append CSS for session components to `src/styles.css`**

```css
/* ── Mode toggle ── */
.app-mode-toggle {
  display: flex;
  justify-content: flex-end;
  padding: 0.5rem 1rem;
}

/* ── Session Setup ── */
.session-setup {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.session-player-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.session-player-chip {
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  border: 1px solid currentColor;
  background: transparent;
  cursor: pointer;
  font-size: 0.9rem;
}

.session-add-player {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.session-add-player label {
  font-size: 0.85rem;
  white-space: nowrap;
}

.session-player-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.session-player-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.5rem;
}

.session-player-count {
  font-size: 0.85rem;
  opacity: 0.7;
}

.session-start-button {
  align-self: flex-start;
  padding: 0.6rem 1.2rem;
  font-size: 1rem;
}

/* ── Match Suggestion ── */
.match-suggestion {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.match-suggestion-teams {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.match-suggestion-teams fieldset {
  flex: 1;
  border: 1px solid currentColor;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.match-suggestion-vs {
  font-weight: bold;
}

.match-suggestion-break {
  font-size: 0.9rem;
  opacity: 0.8;
}

.match-suggestion-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.match-suggestion-break-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem;
  border: 1px dashed currentColor;
  border-radius: 0.5rem;
}

.match-suggestion-secondary {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid currentColor;
  opacity: 0.7;
}

/* ── Session match-over overlay ── */
.session-match-over {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1.5rem;
  background: var(--color-bg, #000);
  border-top: 2px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  z-index: 100;
}
```

- [ ] **Step 2: Run full test suite and lint**

Run: `npm test && npm run lint`
Expected: all tests pass, no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: add styles for session mode components"
```
