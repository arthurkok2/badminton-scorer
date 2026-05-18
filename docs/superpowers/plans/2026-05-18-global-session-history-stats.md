# Global Session History and Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require signed-in global players for session mode, persist completed session matches to Firestore, and expose global/player/pair/matchup history with global individual and pair Elo.

**Architecture:** Keep the existing match engine unchanged and evolve session mode around global player ids. Add pure domain modules for player ids, Elo, and stats; add a Firestore service that serializes global players, global pairs, global matches, and user-owned sessions; then update React UI to gate session mode on auth and select global players before a session starts.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Vitest, Testing Library, Firebase Auth, Firestore modular SDK, Firestore security rules.

---

## File Structure

- Modify `src/session/sessionTypes.ts`: add global-player-aware session types while preserving legacy local types for import.
- Modify `src/session/sessionScheduler.ts`: operate on player objects with `id` and `displayName`, not raw strings.
- Modify `src/session/sessionScheduler.test.ts`: update scheduler expectations to global player records.
- Create `src/session/playerIdentity.ts`: normalize search names, create pair ids, map legacy names.
- Create `src/session/playerIdentity.test.ts`: cover normalization, pair id sorting, duplicate display handling.
- Create `src/session/elo.ts`: calculate expected score and individual/pair Elo deltas.
- Create `src/session/elo.test.ts`: cover equal ratings, underdog wins, provisional K, pair Elo.
- Create `src/session/stats.ts`: aggregate user-scoped stats from completed global matches.
- Create `src/session/stats.test.ts`: cover player, pair, opponent, partner, recent-form summaries.
- Create `src/session/cloudSessionTypes.ts`: Firestore DTOs and service result types.
- Create `src/session/cloudSessionService.ts`: Firestore reads/writes, transactions, global player search/create, session persistence.
- Create `src/session/cloudSessionService.test.ts`: mock Firestore SDK and assert paths/payloads/transactions.
- Modify `src/session/sessionStorage.ts`: add import markers and keep legacy local storage helpers.
- Modify `src/session/sessionStorage.test.ts`: cover import marker behavior.
- Modify `src/components/SessionSetup.tsx`: replace free-text roster with global player picker props.
- Modify `src/components/SessionSetup.test.tsx`: assert global players are required.
- Create `src/components/SessionImportPrompt.tsx`: import/not-now prompt and player mapping flow.
- Create `src/components/SessionImportPrompt.test.tsx`: cover no-upload before mapping and import callback.
- Create `src/components/HistoryStatsModal.tsx`: tabbed Sessions/Players/Pairs/Matchups view.
- Create `src/components/HistoryStatsModal.test.tsx`: cover auth-gated view and tab rendering.
- Modify `src/components/AppMenu.tsx`: add `historyStats` action.
- Modify `src/App.tsx`: auth gate session mode, wire cloud service hooks/state, persist completed matches, show import prompt and history modal.
- Modify `src/App.test.tsx`: cover signed-out session gate, signed-in session start, import prompt, write failure warning.
- Modify `src/components/SessionMatchHistory.tsx`: render snapshot display names from global match records.
- Modify `src/components/MatchSuggestion.tsx`: render global player display names and pass global split records.
- Modify `firestore.rules`: add `players`, `pairs`, `globalMatches`, and `users/{uid}` rules.
- Modify `src/firestoreRules.test.ts`: assert named-user global/user-owned rule properties.
- Modify `firestore.indexes.json`: add global player search/ranking indexes if Firestore queries require them.
- Modify `docs/superpowers/specs/2026-05-18-cloud-session-history-stats-design.md`: only if implementation uncovers a design correction.

Every command below must be run with Node 22:

```bash
source ~/.nvm/nvm.sh && nvm use 22
```

---

### Task 1: Global Player Identity Types

**Files:**
- Modify: `src/session/sessionTypes.ts`
- Create: `src/session/playerIdentity.ts`
- Create: `src/session/playerIdentity.test.ts`

- [ ] **Step 1: Write failing identity tests**

Add `src/session/playerIdentity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  createGlobalPlayer,
  createPairId,
  normalizePlayerSearchName,
  toSessionPlayer,
} from './playerIdentity';

describe('player identity helpers', () => {
  it('normalizes player names for search', () => {
    expect(normalizePlayerSearchName('  Alice   Van  Pelt ')).toBe('alice van pelt');
  });

  it('creates stable pair ids regardless of player order', () => {
    expect(createPairId('player_bob', 'player_alice')).toBe('player_alice__player_bob');
    expect(createPairId('player_alice', 'player_bob')).toBe('player_alice__player_bob');
  });

  it('creates a global player with default Elo fields', () => {
    expect(createGlobalPlayer({ id: 'player_alice', displayName: 'Alice', createdBy: 'uid-1' })).toEqual({
      id: 'player_alice',
      displayName: 'Alice',
      searchName: 'alice',
      createdBy: 'uid-1',
      claimStatus: 'guest',
      globalIndividualElo: 1500,
      globalMatchCount: 0,
      statsVersion: 1,
    });
  });

  it('creates session players from global players', () => {
    const player = createGlobalPlayer({ id: 'player_alice', displayName: 'Alice', createdBy: 'uid-1' });

    expect(toSessionPlayer(player)).toEqual({
      id: 'player_alice',
      displayName: 'Alice',
      gamesPlayed: 0,
      consecutiveStreak: 0,
      onBreak: true,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/playerIdentity.test.ts
```

Expected: FAIL because `src/session/playerIdentity.ts` does not exist.

- [ ] **Step 3: Add global session types**

Update `src/session/sessionTypes.ts` with these types while retaining legacy local `ArchivedSession` and `MatchRecord` shapes for import compatibility until all callers are migrated:

```ts
export interface GlobalPlayer {
  readonly id: string;
  readonly displayName: string;
  readonly searchName: string;
  readonly createdBy: string;
  readonly claimStatus: 'guest' | 'claimed' | 'verified';
  readonly linkedUid?: string;
  readonly globalIndividualElo: number;
  readonly globalMatchCount: number;
  readonly statsVersion: number;
}

export interface SessionPlayer {
  readonly id: string;
  readonly displayName: string;
  readonly gamesPlayed: number;
  readonly consecutiveStreak: number;
  readonly onBreak: boolean;
}

export interface TeamSplit {
  readonly teamA: readonly [SessionPlayer, SessionPlayer];
  readonly teamB: readonly [SessionPlayer, SessionPlayer];
}

export interface MatchRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly matchNumber: number;
  readonly teamAPlayerIds: readonly [string, string];
  readonly teamBPlayerIds: readonly [string, string];
  readonly teamADisplayNames: readonly [string, string];
  readonly teamBDisplayNames: readonly [string, string];
  readonly teamAPairId: string;
  readonly teamBPairId: string;
  readonly winnerTeam: 'teamA' | 'teamB';
  readonly finalScore?: {
    readonly teamA: number;
    readonly teamB: number;
  };
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly globalMatchId?: string;
}
```

- [ ] **Step 4: Add player identity implementation**

Create `src/session/playerIdentity.ts`:

```ts
import type { GlobalPlayer, SessionPlayer } from './sessionTypes';

export function normalizePlayerSearchName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function createPairId(a: string, b: string): string {
  return [a, b].sort().join('__');
}

export function createGlobalPlayer({
  id,
  displayName,
  createdBy,
}: {
  readonly id: string;
  readonly displayName: string;
  readonly createdBy: string;
}): GlobalPlayer {
  return {
    id,
    displayName: displayName.trim(),
    searchName: normalizePlayerSearchName(displayName),
    createdBy,
    claimStatus: 'guest',
    globalIndividualElo: 1500,
    globalMatchCount: 0,
    statsVersion: 1,
  };
}

export function toSessionPlayer(player: GlobalPlayer): SessionPlayer {
  return {
    id: player.id,
    displayName: player.displayName,
    gamesPlayed: 0,
    consecutiveStreak: 0,
    onBreak: true,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/playerIdentity.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/session/sessionTypes.ts src/session/playerIdentity.ts src/session/playerIdentity.test.ts
git commit -m "feat: add global player identity types"
```

---

### Task 2: Elo Calculation

**Files:**
- Create: `src/session/elo.ts`
- Create: `src/session/elo.test.ts`

- [ ] **Step 1: Write failing Elo tests**

Create `src/session/elo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateIndividualEloUpdate, calculatePairEloUpdate, expectedScore, kFactorForMatches } from './elo';

describe('elo', () => {
  it('returns 0.5 expected score for equal ratings', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
  });

  it('uses provisional K below 10 matches', () => {
    expect(kFactorForMatches(0)).toBe(32);
    expect(kFactorForMatches(9)).toBe(32);
    expect(kFactorForMatches(10)).toBe(24);
  });

  it('updates both teammates equally from team-average ratings', () => {
    const update = calculateIndividualEloUpdate({
      teamA: [
        { id: 'alice', rating: 1500, matchCount: 0 },
        { id: 'bob', rating: 1500, matchCount: 0 },
      ],
      teamB: [
        { id: 'carol', rating: 1500, matchCount: 0 },
        { id: 'dave', rating: 1500, matchCount: 0 },
      ],
      winnerTeam: 'teamA',
    });

    expect(update.alice.delta).toBe(16);
    expect(update.bob.delta).toBe(16);
    expect(update.carol.delta).toBe(-16);
    expect(update.dave.delta).toBe(-16);
  });

  it('updates pair Elo separately', () => {
    const update = calculatePairEloUpdate({
      teamAPair: { id: 'alice__bob', rating: 1500, matchCount: 10 },
      teamBPair: { id: 'carol__dave', rating: 1500, matchCount: 10 },
      winnerTeam: 'teamB',
    });

    expect(update.alice__bob.delta).toBe(-12);
    expect(update.carol__dave.delta).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/elo.test.ts
```

Expected: FAIL because `src/session/elo.ts` does not exist.

- [ ] **Step 3: Implement Elo module**

Create `src/session/elo.ts`:

```ts
export interface EloSubject {
  readonly id: string;
  readonly rating: number;
  readonly matchCount: number;
}

export interface EloSnapshot {
  readonly before: number;
  readonly after: number;
  readonly delta: number;
}

export type EloUpdate = Readonly<Record<string, EloSnapshot>>;

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function kFactorForMatches(matchCount: number): number {
  return matchCount < 10 ? 32 : 24;
}

export function calculateIndividualEloUpdate(options: {
  readonly teamA: readonly [EloSubject, EloSubject];
  readonly teamB: readonly [EloSubject, EloSubject];
  readonly winnerTeam: 'teamA' | 'teamB';
}): EloUpdate {
  const teamARating = average(options.teamA[0].rating, options.teamA[1].rating);
  const teamBRating = average(options.teamB[0].rating, options.teamB[1].rating);
  const teamAScore = options.winnerTeam === 'teamA' ? 1 : 0;
  const teamBScore = 1 - teamAScore;
  const teamAK = average(kFactorForMatches(options.teamA[0].matchCount), kFactorForMatches(options.teamA[1].matchCount));
  const teamBK = average(kFactorForMatches(options.teamB[0].matchCount), kFactorForMatches(options.teamB[1].matchCount));
  const teamADelta = Math.round(teamAK * (teamAScore - expectedScore(teamARating, teamBRating)));
  const teamBDelta = Math.round(teamBK * (teamBScore - expectedScore(teamBRating, teamARating)));

  return {
    ...snapshotsForTeam(options.teamA, teamADelta),
    ...snapshotsForTeam(options.teamB, teamBDelta),
  };
}

export function calculatePairEloUpdate(options: {
  readonly teamAPair: EloSubject;
  readonly teamBPair: EloSubject;
  readonly winnerTeam: 'teamA' | 'teamB';
}): EloUpdate {
  const teamAScore = options.winnerTeam === 'teamA' ? 1 : 0;
  const teamBScore = 1 - teamAScore;
  const teamADelta = Math.round(kFactorForMatches(options.teamAPair.matchCount) * (teamAScore - expectedScore(options.teamAPair.rating, options.teamBPair.rating)));
  const teamBDelta = Math.round(kFactorForMatches(options.teamBPair.matchCount) * (teamBScore - expectedScore(options.teamBPair.rating, options.teamAPair.rating)));

  return {
    [options.teamAPair.id]: snapshot(options.teamAPair.rating, teamADelta),
    [options.teamBPair.id]: snapshot(options.teamBPair.rating, teamBDelta),
  };
}

function average(a: number, b: number): number {
  return (a + b) / 2;
}

function snapshotsForTeam(team: readonly EloSubject[], delta: number): EloUpdate {
  return Object.fromEntries(team.map((subject) => [subject.id, snapshot(subject.rating, delta)]));
}

function snapshot(before: number, delta: number): EloSnapshot {
  return { before, after: before + delta, delta };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/elo.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/session/elo.ts src/session/elo.test.ts
git commit -m "feat: add session elo calculations"
```

---

### Task 3: Global-Player Session Scheduler

**Files:**
- Modify: `src/session/sessionScheduler.ts`
- Modify: `src/session/sessionScheduler.test.ts`
- Modify: `src/components/SessionMatchHistory.tsx`
- Modify: `src/components/SessionMatchHistory.test.tsx`
- Modify: `src/components/MatchSuggestion.tsx`
- Modify: `src/components/MatchSuggestion.test.tsx`

- [ ] **Step 1: Write failing scheduler test for global player records**

In `src/session/sessionScheduler.test.ts`, update the first creation test to use global players:

```ts
const players = [
  makeGlobalPlayer('alice', 'Alice'),
  makeGlobalPlayer('bob', 'Bob'),
  makeGlobalPlayer('carol', 'Carol'),
  makeGlobalPlayer('dave', 'Dave'),
  makeGlobalPlayer('eve', 'Eve'),
];

it('creates a session with global players set to onBreak', () => {
  const session = createSession(players);

  expect(session.players.map((p) => p.id)).toEqual(['alice', 'bob', 'carol', 'dave', 'eve']);
  expect(session.players.map((p) => p.displayName)).toEqual(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
  expect(session.players.every((p) => p.onBreak)).toBe(true);
});
```

Add helper:

```ts
function makeGlobalPlayer(id: string, displayName: string) {
  return {
    id,
    displayName,
    searchName: displayName.toLowerCase(),
    createdBy: 'uid-1',
    claimStatus: 'guest' as const,
    globalIndividualElo: 1500,
    globalMatchCount: 0,
    statsVersion: 1,
  };
}
```

- [ ] **Step 2: Run scheduler test to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/sessionScheduler.test.ts
```

Expected: FAIL because `createSession` still expects strings and scheduler returns raw names.

- [ ] **Step 3: Update scheduler implementation**

Update `createSession`, `selectNextPlayers`, `rankSplitsForPlayers`, and matrix helpers to use `SessionPlayer.id` as the stable key and `displayName` for UI. Use this pattern:

```ts
export function createSession(players: readonly GlobalPlayer[]): ActiveSession {
  return {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    players: players.map(toSessionPlayer),
    matches: [],
    pairingMatrix: { together: {}, against: {} },
  };
}

function playerKey(player: SessionPlayer): string {
  return player.id;
}
```

For `applyMatchResult`, build records with ids and snapshots:

```ts
const matchRecord: MatchRecord = {
  id: metadata?.id ?? crypto.randomUUID(),
  sessionId: session.id,
  matchNumber: session.matches.length + 1,
  teamAPlayerIds: [split.teamA[0].id, split.teamA[1].id],
  teamBPlayerIds: [split.teamB[0].id, split.teamB[1].id],
  teamADisplayNames: [split.teamA[0].displayName, split.teamA[1].displayName],
  teamBDisplayNames: [split.teamB[0].displayName, split.teamB[1].displayName],
  teamAPairId: createPairId(split.teamA[0].id, split.teamA[1].id),
  teamBPairId: createPairId(split.teamB[0].id, split.teamB[1].id),
  winnerTeam,
  ...metadata,
};
```

- [ ] **Step 4: Update UI component tests to display names**

In `MatchSuggestion.test.tsx`, build `suggestion` from `SessionPlayer` objects and expect display names. In `SessionMatchHistory.test.tsx`, update match records to use `teamADisplayNames` and `teamBDisplayNames`.

- [ ] **Step 5: Run affected tests**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/sessionScheduler.test.ts src/components/MatchSuggestion.test.tsx src/components/SessionMatchHistory.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/session/sessionScheduler.ts src/session/sessionScheduler.test.ts src/components/MatchSuggestion.tsx src/components/MatchSuggestion.test.tsx src/components/SessionMatchHistory.tsx src/components/SessionMatchHistory.test.tsx
git commit -m "refactor: schedule sessions with global players"
```

---

### Task 4: Stats Aggregation

**Files:**
- Create: `src/session/stats.ts`
- Create: `src/session/stats.test.ts`

- [ ] **Step 1: Write failing stats tests**

Create `src/session/stats.test.ts` with a two-match fixture:

```ts
import { describe, expect, it } from 'vitest';
import { buildStatsSummary } from './stats';
import type { MatchRecord } from './sessionTypes';

describe('stats aggregation', () => {
  it('aggregates player, pair, opponent, and recent-form stats', () => {
    const matches: MatchRecord[] = [
      makeMatch({ id: 'm1', winnerTeam: 'teamA' }),
      makeMatch({ id: 'm2', winnerTeam: 'teamB' }),
    ];

    const summary = buildStatsSummary(matches);

    expect(summary.ratedMatchCount).toBe(2);
    expect(summary.players.alice.matchesPlayed).toBe(2);
    expect(summary.players.alice.wins).toBe(1);
    expect(summary.players.alice.losses).toBe(1);
    expect(summary.players.alice.recentForm).toEqual(['W', 'L']);
    expect(summary.pairs.alice__bob.matchesPlayed).toBe(2);
    expect(summary.pairs.alice__bob.wins).toBe(1);
    expect(summary.matchups['alice__vs__carol'].matchesPlayed).toBe(2);
  });
});

function makeMatch(overrides: { id: string; winnerTeam: 'teamA' | 'teamB' }): MatchRecord {
  return {
    id: overrides.id,
    sessionId: 'session-1',
    matchNumber: overrides.id === 'm1' ? 1 : 2,
    teamAPlayerIds: ['alice', 'bob'],
    teamBPlayerIds: ['carol', 'dave'],
    teamADisplayNames: ['Alice', 'Bob'],
    teamBDisplayNames: ['Carol', 'Dave'],
    teamAPairId: 'alice__bob',
    teamBPairId: 'carol__dave',
    winnerTeam: overrides.winnerTeam,
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/stats.test.ts
```

Expected: FAIL because `stats.ts` does not exist.

- [ ] **Step 3: Implement stats aggregation**

Create `src/session/stats.ts` with:

```ts
import type { MatchRecord } from './sessionTypes';

export interface PlayerStats {
  readonly displayName: string;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
  readonly recentForm: readonly ('W' | 'L')[];
}

export interface PairStats {
  readonly displayNames: readonly [string, string];
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
}

export interface MatchupStats {
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
}

export interface StatsSummary {
  readonly players: Readonly<Record<string, PlayerStats>>;
  readonly pairs: Readonly<Record<string, PairStats>>;
  readonly matchups: Readonly<Record<string, MatchupStats>>;
  readonly ratedMatchCount: number;
  readonly statsVersion: 1;
}

export function buildStatsSummary(matches: readonly MatchRecord[]): StatsSummary {
  const players: Record<string, MutablePlayerStats> = {};
  const pairs: Record<string, MutablePairStats> = {};
  const matchups: Record<string, MutableMatchupStats> = {};

  for (const match of matches) {
    applyMatch(match, players, pairs, matchups);
  }

  return {
    players: mapValues(players, finalizePlayer),
    pairs: mapValues(pairs, finalizePair),
    matchups: mapValues(matchups, finalizeMatchup),
    ratedMatchCount: matches.length,
    statsVersion: 1,
  };
}
```

Implement `applyMatch` with these explicit updates:

```ts
function applyMatch(
  match: MatchRecord,
  players: Record<string, MutablePlayerStats>,
  pairs: Record<string, MutablePairStats>,
  matchups: Record<string, MutableMatchupStats>,
): void {
  const teamAWon = match.winnerTeam === 'teamA';
  const teamA = match.teamAPlayerIds;
  const teamB = match.teamBPlayerIds;

  for (const [index, id] of teamA.entries()) {
    incrementPlayer(players, id, match.teamADisplayNames[index]!, teamAWon);
  }
  for (const [index, id] of teamB.entries()) {
    incrementPlayer(players, id, match.teamBDisplayNames[index]!, !teamAWon);
  }

  incrementPair(pairs, match.teamAPairId, match.teamADisplayNames, teamAWon);
  incrementPair(pairs, match.teamBPairId, match.teamBDisplayNames, !teamAWon);

  for (const playerA of teamA) {
    for (const playerB of teamB) {
      incrementMatchup(matchups, `${playerA}__vs__${playerB}`, teamAWon);
      incrementMatchup(matchups, `${playerB}__vs__${playerA}`, !teamAWon);
    }
  }
}
```

`incrementPlayer`, `incrementPair`, and `incrementMatchup` should initialize missing records with zero counts, increment `matchesPlayed`, increment `wins` or `losses`, and recompute `winRate` in finalizers as `wins / matchesPlayed`. `incrementPlayer` appends `W` or `L` to `recentForm` and keeps only the last five entries.

- [ ] **Step 4: Run stats tests**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/stats.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/session/stats.ts src/session/stats.test.ts
git commit -m "feat: aggregate session player stats"
```

---

### Task 5: Local Import Markers

**Files:**
- Modify: `src/session/sessionStorage.ts`
- Modify: `src/session/sessionStorage.test.ts`

- [ ] **Step 1: Write failing import marker tests**

Add to `src/session/sessionStorage.test.ts`:

```ts
import { isSessionImportedForUser, markSessionImportedForUser } from './sessionStorage';

it('tracks imported local sessions per user', () => {
  expect(isSessionImportedForUser('uid-1', 'session-1')).toBe(false);

  markSessionImportedForUser('uid-1', 'session-1');

  expect(isSessionImportedForUser('uid-1', 'session-1')).toBe(true);
  expect(isSessionImportedForUser('uid-2', 'session-1')).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/sessionStorage.test.ts
```

Expected: FAIL because marker helpers are missing.

- [ ] **Step 3: Implement import markers**

In `src/session/sessionStorage.ts`:

```ts
const IMPORTED_SESSION_MARKERS_KEY = 'badminton-scorer-imported-session-markers';

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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/sessionStorage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/session/sessionStorage.ts src/session/sessionStorage.test.ts
git commit -m "feat: track imported local sessions"
```

---

### Task 6: Firestore DTOs and Cloud Session Service

**Files:**
- Create: `src/session/cloudSessionTypes.ts`
- Create: `src/session/cloudSessionService.ts`
- Create: `src/session/cloudSessionService.test.ts`

- [ ] **Step 1: Write failing Firestore service tests**

Create `src/session/cloudSessionService.test.ts` with mocked Firestore SDK:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase/firestore';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((parent: unknown, path: string) => ({ kind: 'collection', parent, path })),
  doc: vi.fn((parent: unknown, id?: string) => ({ kind: 'doc', parent, id: id ?? 'generated-id' })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((count: number) => ({ kind: 'limit', count })),
  orderBy: vi.fn((field: string, direction?: string) => ({ kind: 'orderBy', field, direction })),
  query: vi.fn((...constraints: unknown[]) => ({ kind: 'query', constraints })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ kind: 'serverTimestamp' })),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn((field: string, operator: string, value: unknown) => ({ kind: 'where', field, operator, value })),
}));

vi.mock('firebase/firestore', () => firestoreMocks);

describe('cloud session service', () => {
  const db = { kind: 'firestore' } as unknown as Firestore;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a global player document with default rating fields', async () => {
    const { createGlobalPlayerDocument } = await import('./cloudSessionService');

    const player = await createGlobalPlayerDocument({ displayName: 'Alice', uid: 'uid-1', db });

    expect(player.displayName).toBe('Alice');
    expect(player.globalIndividualElo).toBe(1500);
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      { kind: 'doc', parent: { kind: 'collection', parent: db, path: 'players' }, id: expect.any(String) },
      expect.objectContaining({
        displayName: 'Alice',
        searchName: 'alice',
        createdBy: 'uid-1',
        claimStatus: 'guest',
        globalIndividualElo: 1500,
        globalMatchCount: 0,
      }),
    );
  });

  it('searches global players by normalized search name prefix', async () => {
    const { searchGlobalPlayers } = await import('./cloudSessionService');
    firestoreMocks.getDocs.mockResolvedValue({ docs: [] });

    await searchGlobalPlayers({ searchText: ' Ali ', db });

    expect(firestoreMocks.where).toHaveBeenCalledWith('searchName', '>=', 'ali');
    expect(firestoreMocks.where).toHaveBeenCalledWith('searchName', '<=', 'ali\uf8ff');
    expect(firestoreMocks.limit).toHaveBeenCalledWith(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/cloudSessionService.test.ts
```

Expected: FAIL because cloud service files are missing.

- [ ] **Step 3: Add Firestore DTO types**

Create `src/session/cloudSessionTypes.ts`:

```ts
import type { EloSnapshot } from './elo';

export interface GlobalPlayerDocument {
  readonly id: string;
  readonly displayName: string;
  readonly searchName: string;
  readonly createdBy: string;
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
  readonly claimStatus: 'guest' | 'claimed' | 'verified';
  readonly linkedUid?: string;
  readonly globalIndividualElo: number;
  readonly globalMatchCount: number;
  readonly statsVersion: number;
}

export interface GlobalPairDocument {
  readonly id: string;
  readonly playerIds: readonly [string, string];
  readonly displayNames: readonly [string, string];
  readonly createdAt: unknown;
  readonly updatedAt: unknown;
  readonly globalPairElo: number;
  readonly globalMatchCount: number;
  readonly statsVersion: number;
}

export interface GlobalMatchDocument {
  readonly id: string;
  readonly submittedBy: string;
  readonly sessionId: string;
  readonly sourcePath: string;
  readonly matchNumber: number;
  readonly teamAPlayerIds: readonly [string, string];
  readonly teamBPlayerIds: readonly [string, string];
  readonly teamAPairId: string;
  readonly teamBPairId: string;
  readonly winnerTeam: 'teamA' | 'teamB';
  readonly finalScore?: { readonly teamA: number; readonly teamB: number };
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly globalIndividualElo: Readonly<Record<string, EloSnapshot>>;
  readonly globalPairElo: Readonly<Record<string, EloSnapshot>>;
  readonly status: 'submitted';
  readonly createdAt: unknown;
}
```

- [ ] **Step 4: Implement cloud service skeleton**

Create `src/session/cloudSessionService.ts` with:

```ts
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseDb } from '../firebase';
import { createGlobalPlayer, normalizePlayerSearchName } from './playerIdentity';
import type { GlobalPlayer } from './sessionTypes';

export async function createGlobalPlayerDocument(options: {
  readonly displayName: string;
  readonly uid: string;
  readonly db?: Firestore;
}): Promise<GlobalPlayer> {
  const db = resolveDb(options.db);
  const playerRef = doc(collection(db, 'players'));
  const player = createGlobalPlayer({ id: playerRef.id, displayName: options.displayName, createdBy: options.uid });
  const timestamp = serverTimestamp();

  await setDoc(playerRef, {
    ...player,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return player;
}

export async function searchGlobalPlayers(options: {
  readonly searchText: string;
  readonly db?: Firestore;
}): Promise<GlobalPlayer[]> {
  const searchName = normalizePlayerSearchName(options.searchText);
  if (!searchName) return [];

  const snapshot = await getDocs(query(
    collection(resolveDb(options.db), 'players'),
    where('searchName', '>=', searchName),
    where('searchName', '<=', `${searchName}\uf8ff`),
    orderBy('searchName', 'asc'),
    limit(10),
  ));

  return snapshot.docs.map((document) => document.data() as GlobalPlayer);
}

function resolveDb(db?: Firestore): Firestore {
  return db ?? getFirebaseDb();
}
```

- [ ] **Step 5: Run test to verify skeleton passes**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/cloudSessionService.test.ts
```

Expected: PASS for create/search tests.

- [ ] **Step 6: Add transaction tests for match completion**

Extend `cloudSessionService.test.ts` with a test for `completeCloudSessionMatch` that asserts `runTransaction` is called and that the transaction writes:

- `users/{uid}/sessions/{sessionId}/matches/{matchId}`
- `globalMatches/{matchId}`
- affected `players/{playerId}` docs
- affected `pairs/{pairId}` docs
- `users/{uid}/stats/summary`

Use `expect.objectContaining({ globalIndividualElo: expect.any(Object), globalPairElo: expect.any(Object) })`.

- [ ] **Step 7: Implement transaction completion**

Add `completeCloudSessionMatch` to `cloudSessionService.ts`. It should:

1. Read four player documents.
2. Ensure both pair documents exist or create them with `1500`.
3. Calculate individual and pair Elo snapshots.
4. Create the user match document.
5. Create the global match document.
6. Update player and pair Elo/counts.
7. Update session `matchCount` and user stats summary.

- [ ] **Step 8: Run service tests**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/cloudSessionService.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/session/cloudSessionTypes.ts src/session/cloudSessionService.ts src/session/cloudSessionService.test.ts
git commit -m "feat: add cloud session persistence service"
```

---

### Task 7: Firestore Rules and Indexes

**Files:**
- Modify: `firestore.rules`
- Modify: `src/firestoreRules.test.ts`
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Write failing rules tests**

Add assertions to `src/firestoreRules.test.ts`:

```ts
it('defines global player, pair, global match, and user-owned paths', () => {
  expect(rules).toContain('match /players/{playerId}');
  expect(rules).toContain('match /pairs/{pairId}');
  expect(rules).toContain('match /globalMatches/{matchId}');
  expect(rules).toContain('match /users/{userId}');
});

it('requires ownership for user-owned history and stats', () => {
  expect(rules).toContain('request.auth.uid == userId');
  expect(rules).toContain('match /sessions/{sessionId}');
  expect(rules).toContain('match /stats/{statsId}');
});

it('allows signed-in global lookup but rejects anonymous users', () => {
  expect(rules).toContain('allow read: if isNamedSignedIn()');
  expect(rules).toContain("request.auth.token.firebase.sign_in_provider != 'anonymous'");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/firestoreRules.test.ts
```

Expected: FAIL because rules do not contain new paths.

- [ ] **Step 3: Update `firestore.rules`**

Add helpers:

```js
function isValidPlayerId(v) {
  return v is string && v.size() >= 1 && v.size() <= 128;
}

function isValidPlayerList(v) {
  return v is list && v.size() == 2 && isValidPlayerId(v[0]) && isValidPlayerId(v[1]);
}

function isValidElo(v) {
  return v is number && v >= 0 && v <= 5000;
}
```

Add matches:

```js
match /players/{playerId} {
  allow read: if isNamedSignedIn();
  allow create: if isNamedSignedIn()
    && request.resource.data.id == playerId
    && request.resource.data.createdBy == request.auth.uid
    && request.resource.data.displayName is string
    && request.resource.data.displayName.size() >= 1
    && request.resource.data.displayName.size() <= 80
    && request.resource.data.searchName is string
    && request.resource.data.searchName.size() >= 1
    && request.resource.data.searchName.size() <= 80
    && request.resource.data.claimStatus == 'guest'
    && request.resource.data.globalIndividualElo == 1500
    && request.resource.data.globalMatchCount == 0
    && request.resource.data.statsVersion == 1
    && request.resource.data.createdAt == request.time
    && request.resource.data.updatedAt == request.time;
  allow update: if isNamedSignedIn()
    && request.resource.data.id == resource.data.id
    && isValidElo(request.resource.data.globalIndividualElo)
    && request.resource.data.globalMatchCount is number
    && request.resource.data.globalMatchCount >= resource.data.globalMatchCount;
  allow delete: if false;
}
```

Add `pairs/{pairId}`:

```js
match /pairs/{pairId} {
  allow read: if isNamedSignedIn();
  allow create: if isNamedSignedIn()
    && request.resource.data.id == pairId
    && isValidPlayerList(request.resource.data.playerIds)
    && request.resource.data.displayNames is list
    && request.resource.data.displayNames.size() == 2
    && request.resource.data.globalPairElo == 1500
    && request.resource.data.globalMatchCount == 0
    && request.resource.data.statsVersion == 1
    && request.resource.data.createdAt == request.time
    && request.resource.data.updatedAt == request.time;
  allow update: if isNamedSignedIn()
    && request.resource.data.id == resource.data.id
    && request.resource.data.playerIds == resource.data.playerIds
    && isValidElo(request.resource.data.globalPairElo)
    && request.resource.data.globalMatchCount is number
    && request.resource.data.globalMatchCount >= resource.data.globalMatchCount;
  allow delete: if false;
}
```

Add `globalMatches/{matchId}`:

```js
match /globalMatches/{matchId} {
  allow read: if isNamedSignedIn();
  allow create: if isNamedSignedIn()
    && request.resource.data.id == matchId
    && request.resource.data.submittedBy == request.auth.uid
    && isValidPlayerList(request.resource.data.teamAPlayerIds)
    && isValidPlayerList(request.resource.data.teamBPlayerIds)
    && isValidTeamId(request.resource.data.winnerTeam)
    && request.resource.data.status == 'submitted'
    && request.resource.data.createdAt == request.time;
  allow update, delete: if false;
}
```

Add `users/{userId}` with nested sessions, matches, and stats:

```js
match /users/{userId} {
  allow read, create, update: if isNamedSignedIn() && request.auth.uid == userId;
  allow delete: if false;

  match /sessions/{sessionId} {
    allow read, create, update: if isNamedSignedIn() && request.auth.uid == userId;
    allow delete: if false;

    match /matches/{matchId} {
      allow read, create: if isNamedSignedIn() && request.auth.uid == userId;
      allow update, delete: if false;
    }
  }

  match /stats/{statsId} {
    allow read, create, update: if isNamedSignedIn() && request.auth.uid == userId;
    allow delete: if false;
  }
}
```

Keep the existing `matches/{code}` remote-control rules intact.

- [ ] **Step 4: Add player search index**

Update `firestore.indexes.json` if needed for `players` search:

```json
{
  "collectionGroup": "players",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "searchName", "order": "ASCENDING" }
  ]
}
```

If Firestore accepts the simple collection query without a composite index, leave `firestore.indexes.json` unchanged.

- [ ] **Step 5: Run rules test**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/firestoreRules.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firestore.indexes.json src/firestoreRules.test.ts
git commit -m "feat: secure global session firestore data"
```

---

### Task 8: Session Mode Auth Gate and Global Player Picker

**Files:**
- Modify: `src/components/SessionSetup.tsx`
- Modify: `src/components/SessionSetup.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing SessionSetup tests**

Update `SessionSetup.test.tsx` to use global players:

```ts
const players = [
  makePlayer('alice', 'Alice'),
  makePlayer('bob', 'Bob'),
  makePlayer('carol', 'Carol'),
  makePlayer('dave', 'Dave'),
];

it('calls onSearchPlayers when text changes', async () => {
  const onSearchPlayers = vi.fn();
  render(<SessionSetup savedPlayers={players} searchResults={[]} onSearchPlayers={onSearchPlayers} onCreatePlayer={vi.fn()} onStartSession={vi.fn()} />);

  await userEvent.type(screen.getByRole('textbox', { name: /player search/i }), 'Ali');

  expect(onSearchPlayers).toHaveBeenLastCalledWith('Ali');
});

it('starts with selected global players', async () => {
  const onStartSession = vi.fn();
  render(<SessionSetup savedPlayers={players} searchResults={[]} onSearchPlayers={vi.fn()} onCreatePlayer={vi.fn()} onStartSession={onStartSession} />);

  for (const player of players) {
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`add ${player.displayName}`, 'i') }));
  }
  await userEvent.click(screen.getByRole('button', { name: /start session/i }));

  expect(onStartSession).toHaveBeenCalledWith(players);
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/SessionSetup.test.tsx
```

Expected: FAIL because props still use strings.

- [ ] **Step 3: Update SessionSetup props and UI**

Use this prop shape:

```ts
interface SessionSetupProps {
  readonly savedPlayers: readonly GlobalPlayer[];
  readonly searchResults: readonly GlobalPlayer[];
  readonly onSearchPlayers: (searchText: string) => void;
  readonly onCreatePlayer: (displayName: string) => Promise<GlobalPlayer | undefined>;
  readonly onStartSession: (players: readonly GlobalPlayer[]) => void;
}
```

Render saved player chips, search results, and a create button. Prevent duplicates by `player.id`.

- [ ] **Step 4: Add signed-out session gate test**

In `src/App.test.tsx`, mock `useAuth` as signed out, open app menu, click Session mode, and assert a sign-in nudge appears instead of `SessionSetup`.

- [ ] **Step 5: Wire App auth gate and cloud player search**

In `App.tsx`:

- Add `historyStats` modal state.
- Change `handleSwitchToSession` to require `user && !isAnonymous`.
- Load/search global players with `searchGlobalPlayers`.
- Create new global players with `createGlobalPlayerDocument`.
- Call `createSession(globalPlayers)`.

- [ ] **Step 6: Run App and SessionSetup tests**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/SessionSetup.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/SessionSetup.tsx src/components/SessionSetup.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: require global players for sessions"
```

---

### Task 9: Import Prompt and Legacy Mapping Flow

**Files:**
- Create: `src/components/SessionImportPrompt.tsx`
- Create: `src/components/SessionImportPrompt.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing import prompt tests**

Create `src/components/SessionImportPrompt.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SessionImportPrompt } from './SessionImportPrompt';

it('does not import until every legacy name is mapped', async () => {
  const onImport = vi.fn();
  render(
    <SessionImportPrompt
      legacyNames={['Alice']}
      searchResults={[]}
      onSearchPlayers={vi.fn()}
      onCreatePlayer={vi.fn()}
      onImport={onImport}
      onDismiss={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: /import/i }));

  expect(onImport).not.toHaveBeenCalled();
  expect(screen.getByText(/map every player/i)).toBeInTheDocument();
});

it('dismisses without importing', async () => {
  const onDismiss = vi.fn();
  render(<SessionImportPrompt legacyNames={['Alice']} searchResults={[]} onSearchPlayers={vi.fn()} onCreatePlayer={vi.fn()} onImport={vi.fn()} onDismiss={onDismiss} />);

  await userEvent.click(screen.getByRole('button', { name: /not now/i }));

  expect(onDismiss).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/SessionImportPrompt.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement import prompt**

Create `SessionImportPrompt` with:

- Summary of importable sessions.
- Per-name mapping rows.
- Search/select existing global player.
- Create global player action.
- Import button disabled or guarded until every name maps to a global player id.
- `Not now` button.

- [ ] **Step 4: Wire App import detection**

In `App.tsx`:

- On signed-in auth state, inspect `loadActiveSession()`, `loadSessionArchive()`, and import markers.
- Show `SessionImportPrompt` when importable legacy data exists.
- On import, convert legacy name-based records to global player ids and call cloud import service.
- Mark sessions imported with `markSessionImportedForUser`.

- [ ] **Step 5: Run prompt/App tests**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/SessionImportPrompt.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/SessionImportPrompt.tsx src/components/SessionImportPrompt.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: map legacy sessions to global players"
```

---

### Task 10: History and Stats Modal

**Files:**
- Modify: `src/components/AppMenu.tsx`
- Create: `src/components/HistoryStatsModal.tsx`
- Create: `src/components/HistoryStatsModal.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing HistoryStatsModal tests**

Create `src/components/HistoryStatsModal.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { HistoryStatsModal } from './HistoryStatsModal';

it('renders sessions, players, pairs, and matchups tabs', () => {
  render(<HistoryStatsModal sessions={[]} players={[]} pairs={[]} matchups={[]} onClose={vi.fn()} />);

  expect(screen.getByRole('tab', { name: /sessions/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /players/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /pairs/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /matchups/i })).toBeInTheDocument();
});

it('switches to player leaderboard', async () => {
  render(<HistoryStatsModal sessions={[]} players={[{ id: 'alice', displayName: 'Alice', elo: 1516, matchesPlayed: 1, winRate: 1, recentForm: ['W'] }]} pairs={[]} matchups={[]} onClose={vi.fn()} />);

  await userEvent.click(screen.getByRole('tab', { name: /players/i }));

  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('1516')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/HistoryStatsModal.test.tsx
```

Expected: FAIL because component is missing.

- [ ] **Step 3: Implement modal**

Create `HistoryStatsModal` as a tabbed panel using buttons with `role="tab"` and panels with empty states. Keep all layout in `src/styles.css` and reuse existing modal styles.

- [ ] **Step 4: Add app menu action**

In `AppMenu.tsx`, add:

```ts
| 'historyStats'
```

and item:

```ts
{ action: 'historyStats', label: 'History & Stats', icon: Trophy }
```

- [ ] **Step 5: Wire App modal**

In `App.tsx`, handle `historyStats`:

- Signed out: show sign-in nudge modal.
- Signed in: show `HistoryStatsModal`.
- Load global leaderboard/user stats through cloud service.

- [ ] **Step 6: Run modal/App tests**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/HistoryStatsModal.test.tsx src/components/AppMenu.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/AppMenu.tsx src/components/HistoryStatsModal.tsx src/components/HistoryStatsModal.test.tsx src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: add history and stats view"
```

---

### Task 11: Complete Match Cloud Sync

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/session/cloudSessionService.ts`
- Modify: `src/session/cloudSessionService.test.ts`

- [ ] **Step 1: Write failing App test for match completion sync**

In `src/App.test.tsx`, mock `completeCloudSessionMatch`, complete a session match, click `Next match`, and assert it receives:

```ts
expect(completeCloudSessionMatch).toHaveBeenCalledWith(expect.objectContaining({
  uid: 'uid-1',
  session: expect.objectContaining({ id: expect.any(String) }),
  split: expect.objectContaining({ teamA: expect.any(Array), teamB: expect.any(Array) }),
  winnerTeam: 'teamA',
  finalScore: expect.objectContaining({ teamA: 21 }),
}));
```

- [ ] **Step 2: Run test to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/App.test.tsx
```

Expected: FAIL because App does not call the cloud completion service.

- [ ] **Step 3: Wire completion flow**

In `handleMatchEnded`:

- Keep current local `applyMatchResult` behavior.
- If signed in, call `completeCloudSessionMatch`.
- On success, clear sync warning.
- On failure, keep local state and show sync warning/retry.

Use a state shape:

```ts
const [sessionSyncError, setSessionSyncError] = useState<string | undefined>(undefined);
```

- [ ] **Step 4: Add retry path**

Render a compact warning in session mode:

```tsx
{sessionSyncError ? (
  <div className="session-sync-warning" role="status">
    <span>{sessionSyncError}</span>
    <button onClick={handleRetrySessionSync}>Retry</button>
  </div>
) : null}
```

- [ ] **Step 5: Run App tests**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/session/cloudSessionService.ts src/session/cloudSessionService.test.ts src/styles.css
git commit -m "feat: sync completed sessions to firestore"
```

---

### Task 12: Final Verification and Spec Sync

**Files:**
- Modify: `docs/superpowers/specs/2026-05-18-cloud-session-history-stats-design.md` only if implementation changed design.
- Modify: any failing source/test files found by verification.

- [ ] **Step 1: Run focused test suite**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session src/components src/App.test.tsx src/firestoreRules.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full project verification**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test
source ~/.nvm/nvm.sh && nvm use 22 && npm run lint
source ~/.nvm/nvm.sh && nvm use 22 && npm run build
node --check public/sw.js
```

Expected: all commands exit 0.

- [ ] **Step 3: Review Firestore security caveat**

Confirm final implementation and UI copy do not imply tamper-resistant public rankings. The v1 global ranking must be described as trusted-group ranking unless server-side Elo is added.

- [ ] **Step 4: Commit final fixes**

If verification required changes, stage only the exact files reported by `git status --short`, using their real paths from the command output:

```bash
git status --short
git commit -m "fix: stabilize global session history"
```

If no changes were needed, do not create an empty commit.
