# Meme Gif Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play full-screen meme gif overlays on milestone and fun scoring events (streak, comeback, bagel, shutout, etc.), with a preference toggle to disable them.

**Architecture:** A pure `detectAnimationEvent(prev, next)` function compares match states to emit an `AnimationEvent`. `App.tsx` calls it after each `POINT_TEAM` command via a `useEffect` watching `matchView.match`, storing the result in local state. An `AnimationOverlay` component renders the full-screen gif and auto-dismisses after 2500ms.

**Tech Stack:** React 19, TypeScript 5.8, Vitest 3 + Testing Library, plain CSS, static gif assets in `public/animations/`

**Spec:** `docs/superpowers/specs/2026-05-13-meme-gif-animations-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/animations/types.ts` | Create | `AnimationEventType` union, `AnimationEvent` interface |
| `src/animations/detectAnimationEvent.ts` | Create | Pure event detection logic |
| `src/animations/detectAnimationEvent.test.ts` | Create | Unit tests for detection |
| `src/animations/animationAssets.ts` | Create | Gif registry — maps event types to bundled asset paths |
| `src/components/AnimationOverlay.tsx` | Create | Full-screen overlay component |
| `src/components/AnimationOverlay.test.tsx` | Create | Component tests |
| `public/animations/` | Create dir + files | Bundled gif assets sourced from Giphy |
| `src/preferences.ts` | Modify | Add `animationsEnabled: boolean` |
| `src/preferences.test.ts` | Modify | Cover new preference field |
| `src/App.tsx` | Modify | Wire detection + overlay + preference |
| `src/components/Controls.tsx` | Modify | Add animations toggle button |
| `src/styles.css` | Modify | Overlay CSS and fade keyframes |

---

## Task 1: Add `animationsEnabled` to preferences

**Files:**
- Modify: `src/preferences.ts`
- Modify: `src/preferences.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/preferences.test.ts` inside the `describe('preferences')` block:

```ts
it('defaults animationsEnabled to true', () => {
  const preferences = loadPreferences();
  expect(preferences.animationsEnabled).toBe(true);
});

it('persists and loads animationsEnabled: false', () => {
  const prefs = { ...DEFAULT_PREFERENCES, animationsEnabled: false };
  savePreferences(prefs);
  expect(loadPreferences().animationsEnabled).toBe(false);
});

it('defaults animationsEnabled to true when stored value is invalid', () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ animationsEnabled: 'yes' }));
  expect(loadPreferences().animationsEnabled).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- preferences
```

Expected: FAIL — `animationsEnabled` does not exist on `AppPreferences`

- [ ] **Step 3: Add `animationsEnabled` to `AppPreferences`**

In `src/preferences.ts`, add to the `AppPreferences` interface after `remoteMapping`:

```ts
animationsEnabled: boolean;
```

Add to `DEFAULT_PREFERENCES` after `remoteMapping`:

```ts
animationsEnabled: true,
```

Add to `parsePreferences` return object after `remoteMapping`:

```ts
animationsEnabled: typeof value.animationsEnabled === 'boolean'
  ? value.animationsEnabled
  : DEFAULT_PREFERENCES.animationsEnabled,
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- preferences
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/preferences.ts src/preferences.test.ts
git commit -m "feat: add animationsEnabled preference"
```

---

## Task 2: Define animation types

**Files:**
- Create: `src/animations/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// src/animations/types.ts
import type { TeamId } from '../domain/matchTypes';

export type AnimationEventType =
  | 'match_won'
  | 'shutout'
  | 'bagel'
  | 'match_point'
  | 'deuce'
  | 'streak_9'
  | 'streak_6'
  | 'comeback'
  | 'streak_3'
  | 'first_to_11';

export interface AnimationEvent {
  readonly type: AnimationEventType;
  readonly teamId: TeamId;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run build 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/animations/types.ts
git commit -m "feat: define AnimationEvent types"
```

---

## Task 3: Implement `detectAnimationEvent`

**Files:**
- Create: `src/animations/detectAnimationEvent.ts`
- Create: `src/animations/detectAnimationEvent.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/animations/detectAnimationEvent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createMatch, awardPointToTeam } from '../domain/matchEngine';
import type { MatchState } from '../domain/matchTypes';
import { detectAnimationEvent } from './detectAnimationEvent';

function scorePoints(match: MatchState, teamId: 'teamA' | 'teamB', count: number): MatchState {
  let m = match;
  for (let i = 0; i < count; i++) m = awardPointToTeam(m, teamId);
  return m;
}

const base = createMatch({
  mode: 'doubles',
  initialServingTeamId: 'teamA',
  initialServingPlayerId: 'A1',
});

describe('detectAnimationEvent', () => {
  it('returns null when scores are unchanged (no point scored)', () => {
    expect(detectAnimationEvent(base, base)).toBeNull();
  });

  it('returns null for undo (score decreases)', () => {
    const after = scorePoints(base, 'teamA', 3);
    const undone = awardPointToTeam(after, 'teamA'); // undo not available, use prev state directly
    // Simulate undo by using after as "next" with fewer points
    const prev = scorePoints(base, 'teamA', 3);
    const next = scorePoints(base, 'teamA', 2);
    expect(detectAnimationEvent(prev, next)).toBeNull();
  });

  it('returns match_won when winner is set', () => {
    const prev = scorePoints(base, 'teamA', 20);
    const next = awardPointToTeam(prev, 'teamA'); // 21-0, teamA wins
    const event = detectAnimationEvent(prev, next);
    // Could be shutout since teamB is at 0, but match_won with 21-0 = shutout
    expect(event?.type).toBe('shutout');
    expect(event?.teamId).toBe('teamA');
  });

  it('returns match_won (not shutout) when loser has points', () => {
    const withPoints = scorePoints(base, 'teamB', 5);
    const prev = scorePoints(withPoints, 'teamA', 20);
    const next = awardPointToTeam(prev, 'teamA'); // 21-5, teamA wins
    const event = detectAnimationEvent(prev, next);
    expect(event?.type).toBe('match_won');
    expect(event?.teamId).toBe('teamA');
  });

  it('returns shutout when match won and opponent at 0', () => {
    const prev = scorePoints(base, 'teamA', 20);
    const next = awardPointToTeam(prev, 'teamA'); // 21-0
    expect(detectAnimationEvent(prev, next)?.type).toBe('shutout');
  });

  it('returns bagel when scorer reaches 11 and opponent is at 0', () => {
    const prev = scorePoints(base, 'teamA', 10);
    const next = awardPointToTeam(prev, 'teamA'); // 11-0
    expect(detectAnimationEvent(prev, next)?.type).toBe('bagel');
    expect(detectAnimationEvent(prev, next)?.teamId).toBe('teamA');
  });

  it('returns first_to_11 (not bagel) when scorer reaches 11 and opponent has points', () => {
    const withOpp = scorePoints(base, 'teamB', 3);
    const prev = scorePoints(withOpp, 'teamA', 10);
    const next = awardPointToTeam(prev, 'teamA'); // 11-3
    expect(detectAnimationEvent(prev, next)?.type).toBe('first_to_11');
  });

  it('returns match_point when scorer reaches 20 and opponent is at 19', () => {
    const withOpp = scorePoints(base, 'teamB', 19);
    const prev = scorePoints(withOpp, 'teamA', 19);
    const next = awardPointToTeam(prev, 'teamA'); // 20-19
    expect(detectAnimationEvent(prev, next)?.type).toBe('match_point');
    expect(detectAnimationEvent(prev, next)?.teamId).toBe('teamA');
  });

  it('returns match_point when at 21-20 (after deuce broken)', () => {
    const deuceBase = scorePoints(base, 'teamA', 20);
    const withDeuce = scorePoints(deuceBase, 'teamB', 20); // 20-20
    const prev = awardPointToTeam(withDeuce, 'teamA'); // 21-20
    const next = awardPointToTeam(prev, 'teamA'); // 22-20 — wait that's a win
    // Actually 21-20 itself is match_point state, check the transition to 21-20
    const atDeuce = scorePoints(base, 'teamA', 20);
    const atDeuceFull = scorePoints(atDeuce, 'teamB', 20); // 20-20
    const prevState = atDeuceFull; // 20-20
    const nextState = awardPointToTeam(prevState, 'teamA'); // 21-20
    expect(detectAnimationEvent(prevState, nextState)?.type).toBe('match_point');
  });

  it('returns deuce when score becomes 20-20', () => {
    const prev = scorePoints(scorePoints(base, 'teamA', 20), 'teamB', 19); // 20-19
    const next = awardPointToTeam(prev, 'teamB'); // 20-20
    expect(detectAnimationEvent(prev, next)?.type).toBe('deuce');
  });

  it('returns streak_3 after 3 consecutive points', () => {
    const prev = scorePoints(base, 'teamA', 2);
    const next = awardPointToTeam(prev, 'teamA'); // 3 in a row
    expect(detectAnimationEvent(prev, next)?.type).toBe('streak_3');
    expect(detectAnimationEvent(prev, next)?.teamId).toBe('teamA');
  });

  it('returns streak_6 after 6 consecutive points (not streak_3)', () => {
    const prev = scorePoints(base, 'teamA', 5);
    const next = awardPointToTeam(prev, 'teamA');
    expect(detectAnimationEvent(prev, next)?.type).toBe('streak_6');
  });

  it('returns streak_9 after 9 consecutive points (not streak_6)', () => {
    const prev = scorePoints(base, 'teamA', 8);
    const next = awardPointToTeam(prev, 'teamA');
    expect(detectAnimationEvent(prev, next)?.type).toBe('streak_9');
  });

  it('returns null at 4 consecutive (not a threshold)', () => {
    const prev = scorePoints(base, 'teamA', 3);
    // Interrupt streak then continue — actually just test 4 consecutive
    const next = awardPointToTeam(prev, 'teamA'); // 4 in a row
    expect(detectAnimationEvent(prev, next)).toBeNull();
  });

  it('returns streak_3 again at 12 consecutive (not tracked beyond 9)', () => {
    // At 12 the streak is 12 — no threshold matches, returns null
    const prev = scorePoints(base, 'teamA', 11);
    const next = awardPointToTeam(prev, 'teamA');
    expect(detectAnimationEvent(prev, next)).toBeNull();
  });

  it('returns comeback when team was down by 5 and is now tied', () => {
    const prev = scorePoints(scorePoints(base, 'teamB', 5), 'teamA', 0); // 0-5
    // Score a bunch for teamA to get them to 5-5
    const buildUp = scorePoints(scorePoints(base, 'teamB', 5), 'teamA', 4); // 4-5
    const next = awardPointToTeam(buildUp, 'teamA'); // 5-5
    expect(detectAnimationEvent(buildUp, next)?.type).toBe('comeback');
    expect(detectAnimationEvent(buildUp, next)?.teamId).toBe('teamA');
  });

  it('returns null when not trailing by 5', () => {
    const buildUp = scorePoints(scorePoints(base, 'teamB', 4), 'teamA', 3); // 3-4
    const next = awardPointToTeam(buildUp, 'teamA'); // 4-4
    expect(detectAnimationEvent(buildUp, next)).toBeNull();
  });

  it('returns first_to_11 when scorer reaches 11 (opponent > 0)', () => {
    const withOpp = scorePoints(base, 'teamB', 7);
    const prev = scorePoints(withOpp, 'teamA', 10);
    const next = awardPointToTeam(prev, 'teamA'); // 11-7
    expect(detectAnimationEvent(prev, next)?.type).toBe('first_to_11');
  });

  it('returns null for a regular point with no special condition', () => {
    const prev = scorePoints(base, 'teamA', 1);
    const next = awardPointToTeam(prev, 'teamA'); // 2-0
    expect(detectAnimationEvent(prev, next)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- detectAnimationEvent
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `src/animations/detectAnimationEvent.ts`**

```ts
import type { MatchState, TeamId } from '../domain/matchTypes';
import type { AnimationEvent, AnimationEventType } from './types';

export function detectAnimationEvent(prev: MatchState, next: MatchState): AnimationEvent | null {
  const prevTotal = prev.score.teamA + prev.score.teamB;
  const nextTotal = next.score.teamA + next.score.teamB;
  if (nextTotal !== prevTotal + 1) return null;
  if (prev.winnerTeamId) return null;

  const scorer: TeamId = next.score.teamA > prev.score.teamA ? 'teamA' : 'teamB';
  const opponent: TeamId = scorer === 'teamA' ? 'teamB' : 'teamA';

  // Priority 1 & 2: match_won / shutout
  if (next.winnerTeamId) {
    const type: AnimationEventType = next.score[opponent] === 0 ? 'shutout' : 'match_won';
    return { type, teamId: scorer };
  }

  // Priority 3: bagel
  if (next.score[scorer] === 11 && next.score[opponent] === 0) {
    return { type: 'bagel', teamId: scorer };
  }

  // Priority 4: match_point
  if (isMatchPoint(next.score, scorer, opponent)) {
    return { type: 'match_point', teamId: scorer };
  }

  // Priority 5: deuce
  if (next.score.teamA === 20 && next.score.teamB === 20) {
    return { type: 'deuce', teamId: scorer };
  }

  // Streak detection (priorities 6, 7, 9)
  const streak = getConsecutiveStreak(next);
  if (streak === 9) return { type: 'streak_9', teamId: scorer };
  if (streak === 6) return { type: 'streak_6', teamId: scorer };

  // Priority 8: comeback
  const wasBehindBy5 = prev.score[scorer] + 5 <= prev.score[opponent];
  const nowTiedOrAhead = next.score[scorer] >= next.score[opponent];
  if (wasBehindBy5 && nowTiedOrAhead) {
    return { type: 'comeback', teamId: scorer };
  }

  // Priority 9: streak_3
  if (streak === 3) return { type: 'streak_3', teamId: scorer };

  // Priority 10: first_to_11
  if (next.score[scorer] === 11 && next.score[opponent] > 0) {
    return { type: 'first_to_11', teamId: scorer };
  }

  return null;
}

function isMatchPoint(score: { teamA: number; teamB: number }, teamId: TeamId, opponent: TeamId): boolean {
  const next = score[teamId] + 1;
  if (next === 30) return true;
  return next >= 21 && next - score[opponent] >= 2;
}

function getConsecutiveStreak(match: MatchState): number {
  if (match.history.length === 0) return 0;

  const allStates = [...match.history, match];
  const lastIdx = allStates.length - 1;
  const lastScorer: TeamId =
    allStates[lastIdx].score.teamA > allStates[lastIdx - 1].score.teamA ? 'teamA' : 'teamB';

  let count = 1;
  for (let i = lastIdx - 1; i >= 1; i--) {
    const scorer: TeamId =
      allStates[i].score.teamA > allStates[i - 1].score.teamA ? 'teamA' : 'teamB';
    if (scorer === lastScorer) count++;
    else break;
  }
  return count;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- detectAnimationEvent
```

Expected: PASS (all tests green). If any fail, re-read the test and fix the logic — do not change the tests.

- [ ] **Step 5: Commit**

```bash
git add src/animations/detectAnimationEvent.ts src/animations/detectAnimationEvent.test.ts
git commit -m "feat: implement detectAnimationEvent pure function"
```

---

## Task 4: Source and commit gif assets

**Files:**
- Create: `public/animations/*.gif`

- [ ] **Step 1: Download gifs from Giphy**

For each event, search Giphy (giphy.com) and download one or two `.gif` files. Save them to `public/animations/` with these names:

| Filename | Giphy search |
|----------|-------------|
| `match_won_1.gif` | "celebration confetti" |
| `match_won_2.gif` | "victory celebration" |
| `shutout_1.gif` | "flawless victory mortal kombat" |
| `bagel_1.gif` | "sad trombone" |
| `bagel_2.gif` | "this is fine" |
| `match_point_1.gif` | "dramatic chipmunk" |
| `match_point_2.gif` | "final countdown" |
| `deuce_1.gif` | "back and forth tug of war" |
| `streak_9_1.gif` | "he's on fire nba jam" |
| `streak_9_2.gif` | "unstoppable" |
| `streak_6_1.gif` | "on fire" |
| `streak_3_1.gif` | "lets go fist pump" |
| `streak_3_2.gif` | "yeah excited" |
| `comeback_1.gif` | "rocky balboa training" |
| `comeback_2.gif` | "comeback" |
| `first_to_11_1.gif` | "halfway there" |

Keep each file under 2MB. `.gif` or `.webp` format both work.

- [ ] **Step 2: Commit assets**

```bash
git add public/animations/
git commit -m "chore: add bundled meme gif assets"
```

---

## Task 5: Implement `animationAssets.ts`

**Files:**
- Create: `src/animations/animationAssets.ts`

No tests needed — this is a static data registry. TypeScript will catch typos.

- [ ] **Step 1: Create the asset registry**

Update the arrays to match whatever filenames you actually committed in Task 4. The entries below assume the names from the plan; adjust if you used different names.

```ts
// src/animations/animationAssets.ts
import type { AnimationEventType } from './types';

const GIF_MAP: Record<AnimationEventType, string[]> = {
  match_won:   ['/animations/match_won_1.gif', '/animations/match_won_2.gif'],
  shutout:     ['/animations/shutout_1.gif'],
  bagel:       ['/animations/bagel_1.gif', '/animations/bagel_2.gif'],
  match_point: ['/animations/match_point_1.gif', '/animations/match_point_2.gif'],
  deuce:       ['/animations/deuce_1.gif'],
  streak_9:    ['/animations/streak_9_1.gif', '/animations/streak_9_2.gif'],
  streak_6:    ['/animations/streak_6_1.gif', '/animations/streak_6_2.gif'],
  streak_3:    ['/animations/streak_3_1.gif', '/animations/streak_3_2.gif'],
  comeback:    ['/animations/comeback_1.gif', '/animations/comeback_2.gif'],
  first_to_11: ['/animations/first_to_11_1.gif'],
};

export function getGifUrl(type: AnimationEventType): string {
  const options = GIF_MAP[type];
  return options[Math.floor(Math.random() * options.length)];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run build 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/animations/animationAssets.ts
git commit -m "feat: add animation gif asset registry"
```

---

## Task 6: Add overlay CSS

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Append overlay styles to `src/styles.css`**

Add at the end of the file:

```css
/* Animation overlay */
.animation-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: animation-overlay-fade 2.5s ease-in-out forwards;
}

.animation-overlay-gif {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.animation-overlay-label {
  position: relative;
  z-index: 1;
  font-size: 3rem;
  font-weight: bold;
  color: white;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
  margin: 0;
  text-align: center;
  padding: 0 1rem;
}

@keyframes animation-overlay-fade {
  0%   { opacity: 0; }
  10%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { opacity: 0; }
}
```

- [ ] **Step 2: Verify build**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run build 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: add animation overlay CSS"
```

---

## Task 7: Implement `AnimationOverlay` component

**Files:**
- Create: `src/components/AnimationOverlay.tsx`
- Create: `src/components/AnimationOverlay.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/AnimationOverlay.test.tsx`:

```tsx
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnimationOverlay } from './AnimationOverlay';

describe('AnimationOverlay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders nothing when event is null', () => {
    const { container } = render(
      <AnimationOverlay event={null} onDismiss={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay when event is provided', () => {
    render(
      <AnimationOverlay
        event={{ type: 'match_won', teamId: 'teamA' }}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows the correct label for match_won', () => {
    render(
      <AnimationOverlay
        event={{ type: 'match_won', teamId: 'teamA' }}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText('MATCH!')).toBeInTheDocument();
  });

  it('shows the correct label for deuce', () => {
    render(
      <AnimationOverlay
        event={{ type: 'deuce', teamId: 'teamB' }}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText('DEUCE')).toBeInTheDocument();
  });

  it('calls onDismiss after 2500ms', () => {
    const onDismiss = vi.fn();
    render(
      <AnimationOverlay
        event={{ type: 'streak_3', teamId: 'teamA' }}
        onDismiss={onDismiss}
      />
    );
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2500); });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does not call onDismiss before 2500ms', () => {
    const onDismiss = vi.fn();
    render(
      <AnimationOverlay
        event={{ type: 'comeback', teamId: 'teamB' }}
        onDismiss={onDismiss}
      />
    );
    act(() => { vi.advanceTimersByTime(2499); });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('clears timer when event becomes null', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <AnimationOverlay
        event={{ type: 'streak_6', teamId: 'teamA' }}
        onDismiss={onDismiss}
      />
    );
    rerender(<AnimationOverlay event={null} onDismiss={onDismiss} />);
    act(() => { vi.advanceTimersByTime(2500); });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- AnimationOverlay
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `src/components/AnimationOverlay.tsx`**

```tsx
import { useEffect } from 'react';
import type { AnimationEvent } from '../animations/types';
import { getGifUrl } from '../animations/animationAssets';

const EVENT_LABELS: Record<string, string> = {
  match_won:   'MATCH!',
  shutout:     'SHUTOUT!',
  bagel:       'BAGEL 🥯',
  match_point: 'MATCH POINT',
  deuce:       'DEUCE',
  streak_9:    'ON FIRE 🔥🔥🔥',
  streak_6:    'ON FIRE 🔥🔥',
  streak_3:    'ON FIRE 🔥',
  comeback:    'COMEBACK!',
  first_to_11: 'HALFWAY THERE',
};

interface Props {
  readonly event: AnimationEvent | null;
  readonly onDismiss: () => void;
}

export function AnimationOverlay({ event, onDismiss }: Props) {
  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [event, onDismiss]);

  if (!event) return null;

  const gifUrl = getGifUrl(event.type);
  const label = EVENT_LABELS[event.type] ?? '';

  return (
    <div className="animation-overlay" role="img" aria-label={label}>
      <img className="animation-overlay-gif" src={gifUrl} alt="" />
      <p className="animation-overlay-label">{label}</p>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test -- AnimationOverlay
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/AnimationOverlay.tsx src/components/AnimationOverlay.test.tsx
git commit -m "feat: implement AnimationOverlay component"
```

---

## Task 8: Wire animation detection into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports at the top of `App.tsx`**

Add after the existing imports (around line 44):

```ts
import { detectAnimationEvent } from './animations/detectAnimationEvent';
import { AnimationOverlay } from './components/AnimationOverlay';
import type { AnimationEvent } from './animations/types';
```

- [ ] **Step 2: Add `activeAnimation` state and `prevMatchRef`**

Inside `App()`, after `const match = matchView.match;` (around line 105), add:

```ts
const [activeAnimation, setActiveAnimation] = useState<AnimationEvent | null>(null);
const prevMatchRef = useRef<MatchState>(matchView.match);

const handleAnimationDismiss = useCallback(() => setActiveAnimation(null), []);
```

- [ ] **Step 3: Add the detection `useEffect`**

After the `useEffect` that saves match state (after line 113), add:

```ts
useEffect(() => {
  const prev = prevMatchRef.current;
  const next = matchView.match;
  prevMatchRef.current = next;

  if (!preferencesRef.current.animationsEnabled) return;

  const event = detectAnimationEvent(prev, next);
  if (event) {
    setActiveAnimation((current) => current ?? event);
  }
}, [matchView.match]);
```

- [ ] **Step 4: Add `<AnimationOverlay>` to the main return JSX**

In the final `return (...)` block, add `<AnimationOverlay>` as the last child inside `<main className="app-shell">`, just before the closing `</main>`:

```tsx
<AnimationOverlay event={activeAnimation} onDismiss={handleAnimationDismiss} />
```

The end of the return block should look like:

```tsx
    </div>
    <AnimationOverlay event={activeAnimation} onDismiss={handleAnimationDismiss} />
  </main>
);
```

- [ ] **Step 5: Run the full test suite**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test
```

Expected: PASS (all tests)

- [ ] **Step 6: Run lint and build**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run lint && npm run build
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire animation detection and overlay into App"
```

---

## Task 9: Add animations toggle to Controls

**Files:**
- Modify: `src/components/Controls.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add prop to `Controls` interface**

In `src/components/Controls.tsx`, find the `interface` (or `type`) for Controls props and add:

```ts
readonly animationsEnabled: boolean;
readonly onAnimationsEnabledChange: (enabled: boolean) => void;
```

- [ ] **Step 2: Add the toggle button to Controls render**

In `Controls.tsx`, find the `autoAnnounce` toggle button (around the `aria-label="Auto announce"` button). Add a similar toggle immediately after it:

```tsx
<button
  type="button"
  className={animationsEnabled ? 'toggle-button is-on' : 'toggle-button'}
  role="switch"
  aria-checked={animationsEnabled}
  aria-label="Animations"
  onClick={() => onAnimationsEnabledChange(!animationsEnabled)}
>
  🎬
</button>
```

Also destructure the new props in the Controls function signature alongside the existing props.

- [ ] **Step 3: Thread the prop through `App.tsx`**

In `App.tsx`, find the `<Controls ... />` JSX in the main return. Add:

```tsx
animationsEnabled={preferences.animationsEnabled}
onAnimationsEnabledChange={(animationsEnabled) =>
  updatePreferences((current) => ({ ...current, animationsEnabled }))
}
```

- [ ] **Step 4: Run the full test suite, lint, and build**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test && npm run lint && npm run build
```

Expected: all PASS, no errors. If Controls tests fail due to missing props, add the new required props to those test renders.

- [ ] **Step 5: Commit**

```bash
git add src/components/Controls.tsx src/App.tsx
git commit -m "feat: add animations toggle to Controls"
```

---

## Final Verification

- [ ] **Run all checks**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test && npm run lint && npm run build && node --check public/sw.js
```

Expected: all green

- [ ] **Manual smoke test**

Start the dev server (`npm run dev`), open the app, score several points in a row and verify:
- Streak animations fire at 3, 6, 9 consecutive points
- Match won shows the overlay
- The 🎬 toggle in Controls disables animations when off
