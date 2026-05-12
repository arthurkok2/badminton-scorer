# Multi-Point Undo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to undo multiple awarded points in a row while keeping undo points-only.

**Architecture:** Store undo history directly on `MatchState` as a stack of `MatchSnapshot` entries. Scoring appends the pre-point snapshot, undo restores the last snapshot with the remaining history, and loading normalizes legacy saved `previous` snapshots into the new history shape.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, browser `localStorage`.

---

## File Structure

- Modify `src/domain/matchTypes.ts`: replace the single `previous` undo field with `history`.
- Modify `src/domain/matchEngine.ts`: append snapshots on point awards, pop snapshots on undo, keep history out of snapshots.
- Modify `src/domain/matchEngine.test.ts`: update undo tests for multi-step history and points-only behavior.
- Modify `src/preferences.ts`: normalize loaded match state from either new `history` or legacy `previous`.
- Modify `src/preferences.test.ts`: add match-state persistence tests for new and legacy shapes.
- Modify `src/input/commands.test.ts`: verify repeated `UNDO` commands walk back multiple points.
- Modify `src/App.test.tsx`: verify repeated Undo button clicks walk the visible score back.
- Modify any TypeScript references to `match.previous`, especially setup visibility and `hasStarted`.

## Task 1: Domain Model And Multi-Undo Engine

**Files:**
- Modify: `src/domain/matchTypes.ts`
- Modify: `src/domain/matchEngine.ts`
- Test: `src/domain/matchEngine.test.ts`

- [ ] **Step 1: Update domain tests to describe multi-point undo**

Replace the three existing undo-related tests in `src/domain/matchEngine.test.ts`:

```ts
  it('restores the previous state with last-action undo', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToServingTeam(match);
    const undone = undoLastPoint(next);

    expect(undone.score).toEqual(match.score);
    expect(undone.serverId).toBe(match.serverId);
    expect(undone.previous).toBeUndefined();
  });

  it('undoes only the last action after multiple points', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const firstPoint = awardPointToServingTeam(match);
    const secondPoint = awardPointToReceivingTeam(firstPoint);
    const undone = undoLastPoint(secondPoint);

    expect(undone.score).toEqual(firstPoint.score);
    expect(undone.servingTeamId).toBe(firstPoint.servingTeamId);
    expect(undone.serverId).toBe(firstPoint.serverId);
    expect(undone.receiverId).toBe(firstPoint.receiverId);
    expect(undone.previous).toBeUndefined();
  });

  it('keeps undo snapshots independent of caller mutations after scoring', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToServingTeam(match);
    const mutableScore = match.score as { teamA: number };
    const mutableCourtPositions = match.courtPositions as { A1: 'left' | 'right' };

    mutableScore.teamA = 99;
    mutableCourtPositions.A1 = 'left';

    const undone = undoLastPoint(next);

    expect(undone.score).toEqual({ teamA: 0, teamB: 0 });
    expect(undone.courtPositions.A1).toBe('right');
  });
```

with these tests:

```ts
  it('restores the previous point and keeps earlier point history', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const firstPoint = awardPointToServingTeam(match);
    const secondPoint = awardPointToReceivingTeam(firstPoint);
    const undone = undoLastPoint(secondPoint);

    expect(undone.score).toEqual(firstPoint.score);
    expect(undone.servingTeamId).toBe(firstPoint.servingTeamId);
    expect(undone.serverId).toBe(firstPoint.serverId);
    expect(undone.receiverId).toBe(firstPoint.receiverId);
    expect(undone.courtPositions).toEqual(firstPoint.courtPositions);
    expect(undone.history).toHaveLength(1);
  });

  it('undoes multiple awarded points in sequence', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const firstPoint = awardPointToServingTeam(match);
    const secondPoint = awardPointToReceivingTeam(firstPoint);
    const thirdPoint = awardPointToServingTeam(secondPoint);

    const afterOneUndo = undoLastPoint(thirdPoint);
    const afterTwoUndos = undoLastPoint(afterOneUndo);
    const afterThreeUndos = undoLastPoint(afterTwoUndos);
    const afterExtraUndo = undoLastPoint(afterThreeUndos);

    expect(afterOneUndo.score).toEqual(secondPoint.score);
    expect(afterOneUndo.servingTeamId).toBe(secondPoint.servingTeamId);
    expect(afterOneUndo.serverId).toBe(secondPoint.serverId);
    expect(afterOneUndo.receiverId).toBe(secondPoint.receiverId);
    expect(afterOneUndo.history).toHaveLength(2);

    expect(afterTwoUndos.score).toEqual(firstPoint.score);
    expect(afterTwoUndos.servingTeamId).toBe(firstPoint.servingTeamId);
    expect(afterTwoUndos.serverId).toBe(firstPoint.serverId);
    expect(afterTwoUndos.receiverId).toBe(firstPoint.receiverId);
    expect(afterTwoUndos.history).toHaveLength(1);

    expect(afterThreeUndos.score).toEqual(match.score);
    expect(afterThreeUndos.servingTeamId).toBe(match.servingTeamId);
    expect(afterThreeUndos.serverId).toBe(match.serverId);
    expect(afterThreeUndos.receiverId).toBe(match.receiverId);
    expect(afterThreeUndos.history).toHaveLength(0);

    expect(afterExtraUndo).toBe(afterThreeUndos);
  });

  it('keeps undo history snapshots independent of caller mutations after scoring', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const next = awardPointToServingTeam(match);
    const mutableScore = match.score as { teamA: number };
    const mutableCourtPositions = match.courtPositions as { A1: 'left' | 'right' };

    mutableScore.teamA = 99;
    mutableCourtPositions.A1 = 'left';

    const undone = undoLastPoint(next);

    expect(undone.score).toEqual({ teamA: 0, teamB: 0 });
    expect(undone.courtPositions.A1).toBe('right');
  });
```

Add this new test after `allows changing the initial server before scoring starts`:

```ts
  it('does not create point history when changing the initial server', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const changed = setInitialServer(match, 'teamB', 'B2');

    expect(changed.history).toHaveLength(0);
    expect(undoLastPoint(changed)).toBe(changed);
  });
```

- [ ] **Step 2: Run the domain test file and confirm the expected failure**

Run:

```bash
npm test -- src/domain/matchEngine.test.ts
```

Expected: FAIL. The failures should mention `previous` or missing `history` behavior because the implementation still supports only one undo snapshot.

- [ ] **Step 3: Update `MatchState` to use history**

In `src/domain/matchTypes.ts`, replace:

```ts
export interface MatchState extends MatchSnapshot {
  readonly previous?: MatchSnapshot;
}
```

with:

```ts
export interface MatchState extends MatchSnapshot {
  readonly history: readonly MatchSnapshot[];
}
```

- [ ] **Step 4: Implement history-based scoring and undo**

In `src/domain/matchEngine.ts`, add `history: []` to the `base` object created by `createMatch`:

```ts
    courtPositions,
    history: [],
  };
```

Replace both scoring blocks that currently use `withoutPrevious(match)` and `previous: cloneMatchSnapshot(match)` with `withoutHistory(match)` and `history: appendHistory(match)`.

For `awardPointToServingTeam`, the `next` construction should be:

```ts
  const next = deriveServerAndReceiver({
    ...withoutHistory(match),
    history: appendHistory(match),
    score,
    courtPositions,
  });
```

For `awardPointToReceivingTeam`, the `next` construction should be:

```ts
  const next = deriveServerAndReceiver({
    ...withoutHistory(match),
    history: appendHistory(match),
    score,
    servingTeamId: newServingTeamId,
    courtPositions:
      match.mode === 'singles' ? positionSinglesForServingSide(match.courtPositions, servingSide) : { ...match.courtPositions },
  });
```

Replace `undoLastPoint` with:

```ts
export function undoLastPoint(match: MatchState): MatchState {
  if (match.history.length === 0) {
    return match;
  }

  const previous = match.history[match.history.length - 1];
  const remainingHistory = match.history.slice(0, -1);

  return restoreSnapshot(previous, remainingHistory);
}
```

Replace `withoutPrevious` with:

```ts
function withoutHistory(match: MatchState): MatchSnapshot {
  const { history, ...rest } = match;
  return rest;
}
```

Replace the first line of `cloneMatchSnapshot` with:

```ts
  const snapshot = withoutHistory(match);
```

Add this helper near `cloneMatchSnapshot`:

```ts
function appendHistory(match: MatchState): MatchSnapshot[] {
  return [...match.history.map(cloneSnapshot), cloneMatchSnapshot(match)];
}
```

Replace `restoreSnapshot` with this version:

```ts
function restoreSnapshot(snapshot: MatchSnapshot, history: readonly MatchSnapshot[] = []): MatchState {
  return {
    ...cloneSnapshot(snapshot),
    history: history.map(cloneSnapshot),
  };
}
```

Add this helper before `restoreSnapshot`:

```ts
function cloneSnapshot(snapshot: MatchSnapshot): MatchSnapshot {
  return {
    ...snapshot,
    teams: {
      teamA: {
        ...snapshot.teams.teamA,
        players: snapshot.teams.teamA.players.map((player) => ({ ...player })),
      },
      teamB: {
        ...snapshot.teams.teamB,
        players: snapshot.teams.teamB.players.map((player) => ({ ...player })),
      },
    },
    score: { ...snapshot.score },
    courtPositions: { ...snapshot.courtPositions },
  };
}
```

Then simplify `cloneMatchSnapshot` to:

```ts
function cloneMatchSnapshot(match: MatchState): MatchSnapshot {
  return cloneSnapshot(withoutHistory(match));
}
```

- [ ] **Step 5: Remove remaining `previous` references from domain files**

Run:

```bash
rg -n "previous|withoutPrevious" src/domain
```

Expected: no matches.

- [ ] **Step 6: Run domain tests and confirm they pass**

Run:

```bash
npm test -- src/domain/matchEngine.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the domain change**

Run:

```bash
git add src/domain/matchTypes.ts src/domain/matchEngine.ts src/domain/matchEngine.test.ts
git commit -m "feat: support multi-point undo in match engine"
```

## Task 2: Persistence Compatibility

**Files:**
- Modify: `src/preferences.ts`
- Test: `src/preferences.test.ts`

- [ ] **Step 1: Add match-state persistence tests**

Update the import at the top of `src/preferences.test.ts` from:

```ts
import { DEFAULT_PLAYER_NAMES, DEFAULT_PREFERENCES, loadPreferences, savePreferences } from './preferences';
```

to:

```ts
import { createMatch, awardPointToServingTeam } from './domain/matchEngine';
import {
  DEFAULT_PLAYER_NAMES,
  DEFAULT_PREFERENCES,
  loadMatchState,
  loadPreferences,
  saveMatchState,
  savePreferences,
} from './preferences';
```

Add this storage key below the existing `STORAGE_KEY`:

```ts
const MATCH_STORAGE_KEY = 'badminton-scorer-match';
```

Add these tests before the final `does not throw when saving preferences fails` test:

```ts
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
```

- [ ] **Step 2: Run the persistence tests and confirm the expected failure**

Run:

```bash
npm test -- src/preferences.test.ts
```

Expected: FAIL. The failures should show that `loadMatchState` still casts parsed JSON directly and does not normalize legacy `previous`.

- [ ] **Step 3: Implement match-state normalization**

Update the type import in `src/preferences.ts` from:

```ts
import type { MatchState, PlayerId } from './domain/matchTypes';
```

to:

```ts
import type { MatchSnapshot, MatchState, PlayerId } from './domain/matchTypes';
```

Replace `loadMatchState` with:

```ts
export function loadMatchState(): MatchState | undefined {
  try {
    const raw = window.localStorage.getItem(MATCH_STORAGE_KEY);
    if (!raw) return undefined;
    return parseMatchState(JSON.parse(raw));
  } catch {
    return undefined;
  }
}
```

Add this helper below `clearMatchState`:

```ts
function parseMatchState(value: unknown): MatchState | undefined {
  if (!isRecord(value) || !isMatchMode(value.mode)) {
    return undefined;
  }

  const { previous, history, ...rest } = value;
  const normalizedHistory = Array.isArray(history)
    ? history.map((entry) => entry as MatchSnapshot)
    : isRecord(previous)
      ? [previous as unknown as MatchSnapshot]
      : [];

  return {
    ...(rest as unknown as Omit<MatchState, 'history'>),
    mode: value.mode,
    history: normalizedHistory,
  };
}
```

- [ ] **Step 4: Run persistence tests and confirm they pass**

Run:

```bash
npm test -- src/preferences.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the persistence change**

Run:

```bash
git add src/preferences.ts src/preferences.test.ts
git commit -m "fix: normalize saved match undo history"
```

## Task 3: Command And App Behavior

**Files:**
- Modify: `src/input/commands.test.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/components/Controls.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update command reducer test for repeated undo**

In `src/input/commands.test.ts`, replace the `restores the last point for UNDO` test with:

```ts
  it('walks back multiple points for repeated UNDO commands', () => {
    const match = createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' });
    const firstPoint = applyCommand(match, { type: 'POINT_TEAM', teamId: 'teamA' });
    const secondPoint = applyCommand(firstPoint, { type: 'POINT_TEAM', teamId: 'teamB' });

    const afterOneUndo = applyCommand(secondPoint, { type: 'UNDO' });
    const afterTwoUndos = applyCommand(afterOneUndo, { type: 'UNDO' });

    expect(afterOneUndo.score).toEqual(firstPoint.score);
    expect(afterOneUndo.servingTeamId).toBe(firstPoint.servingTeamId);
    expect(afterOneUndo.history).toHaveLength(1);
    expect(afterTwoUndos.score).toEqual(match.score);
    expect(afterTwoUndos.servingTeamId).toBe(match.servingTeamId);
    expect(afterTwoUndos.history).toHaveLength(0);
  });
```

- [ ] **Step 2: Update app test for repeated Undo button clicks**

In `src/App.test.tsx`, replace the `undo restores the previous score` test with:

```tsx
  it('undo can restore multiple previous scores', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /award point to team a, score \d+/i }));
    await user.click(screen.getByRole('button', { name: /award point to team b, score 0/i }));
    await user.click(screen.getByRole('button', { name: /undo last point/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('1');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');

    await user.click(screen.getByRole('button', { name: /undo last point/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('0');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
    expect(screen.getByText('Player 1').closest('.player-chip')).toHaveClass('active-server');
  });
```

- [ ] **Step 3: Run command and app tests and confirm the expected failure**

Run:

```bash
npm test -- src/input/commands.test.ts src/App.test.tsx
```

Expected: FAIL. The failure should be TypeScript or assertion errors from remaining `previous` references in UI logic.

- [ ] **Step 4: Update UI started-state checks to use history**

In `src/components/Controls.tsx`, replace:

```ts
  const canSetInitialServer = match.score.teamA === 0 && match.score.teamB === 0 && match.previous === undefined;
```

with:

```ts
  const canSetInitialServer = match.score.teamA === 0 && match.score.teamB === 0 && match.history.length === 0;
```

In `src/App.tsx`, replace:

```ts
  return match.score.teamA !== 0 || match.score.teamB !== 0 || match.previous !== undefined || match.winnerTeamId !== undefined;
```

with:

```ts
  return match.score.teamA !== 0 || match.score.teamB !== 0 || match.history.length > 0 || match.winnerTeamId !== undefined;
```

- [ ] **Step 5: Remove remaining app-wide `previous` references**

Run:

```bash
rg -n "previous" src
```

Expected: no matches in source files except test fixtures intentionally creating legacy saved state in `src/preferences.test.ts`.

- [ ] **Step 6: Run command and app tests and confirm they pass**

Run:

```bash
npm test -- src/input/commands.test.ts src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit the command and UI behavior change**

Run:

```bash
git add src/input/commands.test.ts src/App.test.tsx src/components/Controls.tsx src/App.tsx
git commit -m "test: cover repeated undo commands"
```

## Task 4: Full Verification

**Files:**
- No planned file changes.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run the TypeScript build**

Run:

```bash
npm run build
```

Expected: PASS with Vite producing a production build.

- [ ] **Step 3: Inspect final git status**

Run:

```bash
git status --short
```

Expected: only unrelated pre-existing files remain, such as `.claude/`, if still present.

- [ ] **Step 4: Commit any verification-only fixes if needed**

If Step 1 or Step 2 required small fixes, commit them with:

```bash
git add src/domain/matchTypes.ts src/domain/matchEngine.ts src/domain/matchEngine.test.ts src/preferences.ts src/preferences.test.ts src/input/commands.test.ts src/App.test.tsx src/components/Controls.tsx src/App.tsx
git commit -m "fix: complete multi-point undo verification"
```

Expected: skip this commit if no fixes were needed after Task 3.
