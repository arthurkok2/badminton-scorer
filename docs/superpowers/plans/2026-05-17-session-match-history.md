# Session Match History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session match history with completed-match duration and a Display setting that controls live-screen visibility.

**Architecture:** Store optional `startedAt` and `endedAt` timestamps on session `MatchRecord`s. Render completed matches through a focused `SessionMatchHistory` component used by both the suggestion screen and the live session screen. Persist a display preference, defaulting on, that only hides the live-screen instance.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, plain CSS.

---

## File Structure

- Modify `src/session/sessionTypes.ts` to add optional timestamp fields to `MatchRecord`.
- Modify `src/session/sessionScheduler.ts` to accept optional timestamp metadata when applying a result.
- Modify `src/session/sessionScheduler.test.ts` to prove timestamp metadata is stored.
- Create `src/components/SessionMatchHistory.tsx` for formatting and rendering history.
- Create `src/components/SessionMatchHistory.test.tsx` for history rendering and legacy records.
- Modify `src/components/MatchSuggestion.tsx` and `src/components/MatchSuggestion.test.tsx` to render suggestion-screen history.
- Modify `src/preferences.ts` and `src/preferences.test.ts` to persist `showSessionHistoryDuringLiveMatches`.
- Modify `src/components/DisplaySettingsModal.tsx` and `src/components/DisplaySettingsModal.test.tsx` to expose the toggle.
- Modify `src/App.tsx` and `src/App.test.tsx` to track match start time, record end time, and render/toggle live history.
- Modify `src/styles.css` to style the history panel compactly.

### Task 1: Timestamp Session Match Records

**Files:**
- Modify: `src/session/sessionTypes.ts`
- Modify: `src/session/sessionScheduler.ts`
- Test: `src/session/sessionScheduler.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test in the `applyMatchResult` describe block:

```ts
it('stores optional match timing metadata in history', () => {
  const session = createSession(['Alice', 'Bob', 'Carol', 'Dave', 'Eve']);
  const split: TeamSplit = { teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'] };

  const next = applyMatchResult(session, split, 'teamB', {
    startedAt: '2026-05-17T10:00:00.000Z',
    endedAt: '2026-05-17T10:14:30.000Z',
  });

  expect(next.matches[0]).toEqual({
    teamA: ['Alice', 'Bob'],
    teamB: ['Carol', 'Dave'],
    winnerTeam: 'teamB',
    startedAt: '2026-05-17T10:00:00.000Z',
    endedAt: '2026-05-17T10:14:30.000Z',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/sessionScheduler.test.ts
```

Expected: FAIL because `applyMatchResult` accepts only three arguments.

- [ ] **Step 3: Implement minimal timestamp support**

Update `MatchRecord`:

```ts
export interface MatchRecord {
  readonly teamA: readonly [string, string];
  readonly teamB: readonly [string, string];
  readonly winnerTeam: 'teamA' | 'teamB';
  readonly startedAt?: string;
  readonly endedAt?: string;
}
```

Update `applyMatchResult` signature and match record creation:

```ts
export function applyMatchResult(
  session: ActiveSession,
  split: TeamSplit,
  winnerTeam: 'teamA' | 'teamB',
  timing?: Pick<MatchRecord, 'startedAt' | 'endedAt'>,
): ActiveSession {
  // existing player and matrix code remains
  const matchRecord: MatchRecord = { teamA: split.teamA, teamB: split.teamB, winnerTeam, ...timing };
  return { ...session, players: newPlayers, matches: [...session.matches, matchRecord], pairingMatrix: newMatrix };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/session/sessionScheduler.test.ts
```

Expected: PASS.

### Task 2: Render Reusable Match History

**Files:**
- Create: `src/components/SessionMatchHistory.tsx`
- Test: `src/components/SessionMatchHistory.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `src/components/SessionMatchHistory.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import { SessionMatchHistory } from './SessionMatchHistory';
import type { MatchRecord } from '../session/sessionTypes';

describe('SessionMatchHistory', () => {
  it('renders completed matches newest first with winner and duration', () => {
    const matches: MatchRecord[] = [
      {
        teamA: ['Alice', 'Bob'],
        teamB: ['Carol', 'Dave'],
        winnerTeam: 'teamA',
        startedAt: '2026-05-17T10:00:00.000Z',
        endedAt: '2026-05-17T10:14:30.000Z',
      },
      {
        teamA: ['Alice', 'Carol'],
        teamB: ['Bob', 'Dave'],
        winnerTeam: 'teamB',
        startedAt: '2026-05-17T10:20:00.000Z',
        endedAt: '2026-05-17T10:41:00.000Z',
      },
    ];

    render(<SessionMatchHistory matches={matches} />);

    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByText(/match 2/i)).toBeInTheDocument();
    expect(within(rows[0]).getByText(/bob & dave won/i)).toBeInTheDocument();
    expect(within(rows[0]).getByText('21 min')).toBeInTheDocument();
    expect(within(rows[1]).getByText(/match 1/i)).toBeInTheDocument();
    expect(within(rows[1]).getByText('15 min')).toBeInTheDocument();
  });

  it('renders legacy matches without duration timestamps', () => {
    render(<SessionMatchHistory matches={[{ teamA: ['Alice', 'Bob'], teamB: ['Carol', 'Dave'], winnerTeam: 'teamA' }]} />);

    expect(screen.getByText(/duration unavailable/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/SessionMatchHistory.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/SessionMatchHistory.tsx`:

```tsx
import type { MatchRecord } from '../session/sessionTypes';

interface SessionMatchHistoryProps {
  readonly matches: readonly MatchRecord[];
}

export function SessionMatchHistory({ matches }: SessionMatchHistoryProps) {
  if (matches.length === 0) return null;

  const rows = matches.map((match, index) => ({ match, matchNumber: index + 1 })).toReversed();

  return (
    <section className="session-match-history" aria-label="Session match history">
      <div className="session-section-title-row">
        <h3>Match history</h3>
        <span>{matches.length} played</span>
      </div>
      <ol className="session-match-history-list">
        {rows.map(({ match, matchNumber }) => (
          <li key={`${matchNumber}-${match.teamA.join('-')}-${match.teamB.join('-')}`}>
            <div>
              <span className="session-match-history-number">Match {matchNumber}</span>
              <strong>{formatTeam(match.teamA)} vs {formatTeam(match.teamB)}</strong>
              <span>{formatWinner(match)} won</span>
            </div>
            <span className="session-match-history-duration">{formatDuration(match)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function formatTeam(team: readonly [string, string]): string {
  return `${team[0]} & ${team[1]}`;
}

function formatWinner(match: MatchRecord): string {
  return formatTeam(match[match.winnerTeam]);
}

function formatDuration(match: MatchRecord): string {
  if (!match.startedAt || !match.endedAt) return 'Duration unavailable';

  const startedAt = Date.parse(match.startedAt);
  const endedAt = Date.parse(match.endedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) {
    return 'Duration unavailable';
  }

  const minutes = Math.round((endedAt - startedAt) / 60000);
  return minutes < 1 ? '<1 min' : `${minutes} min`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/SessionMatchHistory.test.tsx
```

Expected: PASS.

### Task 3: Render History on the Suggestion Screen

**Files:**
- Modify: `src/components/MatchSuggestion.tsx`
- Test: `src/components/MatchSuggestion.test.tsx`

- [ ] **Step 1: Write failing test**

Add this test:

```tsx
it('shows completed session match history', () => {
  renderSuggestion({
    completedMatches: [
      {
        teamA: ['Alice', 'Bob'],
        teamB: ['Carol', 'Dave'],
        winnerTeam: 'teamA',
        startedAt: '2026-05-17T10:00:00.000Z',
        endedAt: '2026-05-17T10:12:00.000Z',
      },
    ],
  });

  expect(screen.getByRole('region', { name: /session match history/i })).toBeInTheDocument();
  expect(screen.getByText(/alice & bob won/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/MatchSuggestion.test.tsx
```

Expected: FAIL because `completedMatches` is not a prop.

- [ ] **Step 3: Implement suggestion history**

Import `SessionMatchHistory`, add `completedMatches: readonly MatchRecord[]` to props with a default of `[]`, and render `<SessionMatchHistory matches={completedMatches} />` after the secondary action buttons.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/MatchSuggestion.test.tsx
```

Expected: PASS.

### Task 4: Persist the Display Preference

**Files:**
- Modify: `src/preferences.ts`
- Test: `src/preferences.test.ts`

- [ ] **Step 1: Write failing preference tests**

Add assertions that `DEFAULT_PREFERENCES.showSessionHistoryDuringLiveMatches` is `true`, partial stored preferences default it to `true`, and saving `false` loads `false`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/preferences.test.ts
```

Expected: FAIL because the preference does not exist.

- [ ] **Step 3: Implement preference parsing**

Add `showSessionHistoryDuringLiveMatches: boolean` to `AppPreferences`, set it to `true` in `DEFAULT_PREFERENCES`, and parse stored values with:

```ts
showSessionHistoryDuringLiveMatches: typeof value.showSessionHistoryDuringLiveMatches === 'boolean'
  ? value.showSessionHistoryDuringLiveMatches
  : DEFAULT_PREFERENCES.showSessionHistoryDuringLiveMatches,
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/preferences.test.ts
```

Expected: PASS.

### Task 5: Add the Display Settings Toggle

**Files:**
- Modify: `src/components/DisplaySettingsModal.tsx`
- Test: `src/components/DisplaySettingsModal.test.tsx`

- [ ] **Step 1: Write failing toggle test**

Render `DisplaySettingsModal` with `showSessionHistoryDuringLiveMatches={true}` and `onShowSessionHistoryDuringLiveMatchesChange={vi.fn()}`, click the switch named `/show session match history/i`, and expect the callback to receive `false`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/DisplaySettingsModal.test.tsx
```

Expected: FAIL because the props and switch do not exist.

- [ ] **Step 3: Implement toggle**

Add both props and render a second `role="switch"` button with aria-label `Show session match history during live matches`; clicking it calls the new callback with the inverted value.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/DisplaySettingsModal.test.tsx
```

Expected: PASS.

### Task 6: Wire App Session History Behavior

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing app tests**

Add tests that complete one session match, expect the suggestion screen to show `Session match history` with a duration, start the next match and expect live history to be visible by default, then disable the Display setting and expect live history to be hidden.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/App.test.tsx
```

Expected: FAIL because App does not track match timestamps or render history.

- [ ] **Step 3: Implement app wiring**

In `App.tsx`, add state for the current session match start timestamp:

```ts
const [currentSessionMatchStartedAt, setCurrentSessionMatchStartedAt] = useState<string | undefined>();
```

Set it in `handleStartMatch` before entering `playing`, and pass it to `applyMatchResult` in `handleMatchEnded`:

```ts
const endedAt = new Date().toISOString();
const updated = applyMatchResult(activeSession, currentPlayedSplit, winnerTeam, {
  startedAt: currentSessionMatchStartedAt ?? endedAt,
  endedAt,
});
```

Pass `activeSession.matches` into `MatchSuggestion`, render `SessionMatchHistory` on the live screen when the new preference is enabled, and pass the new preference/callback into `DisplaySettingsModal`.

Add compact CSS for `.session-match-history`, `.session-match-history-list`, `.session-match-history-number`, and `.session-match-history-duration`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/App.test.tsx
```

Expected: PASS.

### Task 7: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run required checks**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test
source ~/.nvm/nvm.sh && nvm use 22 && npm run lint
source ~/.nvm/nvm.sh && nvm use 22 && npm run build
source ~/.nvm/nvm.sh && nvm use 22 && node --check public/sw.js
```

Expected: all pass.

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add src docs/superpowers/plans/2026-05-17-session-match-history.md
git commit -m "feat: add session match history"
```
