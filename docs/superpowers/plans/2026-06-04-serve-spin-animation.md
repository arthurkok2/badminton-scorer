# Serve Spin Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a spinning shuttle overlay when a new match starts or when rerolling the first server, visually determining which team serves first.

**Architecture:** A new `ServeSpinOverlay` component renders a full-screen semi-transparent overlay with an inline SVG shuttle. The shuttle spins with a CSS keyframe animation (2.8s, decelerating cubic-bezier), then transitions to a randomly chosen final rotation angle (pointing left = Team A, right = Team B). After landing, result text appears for 1s before auto-dismiss. If `animationsEnabled` is `false`, skip the overlay and resolve immediately.

**Tech Stack:** React, TypeScript, CSS (keyframes + transitions)

---

### File Structure

| File | Responsibility |
|------|---------------|
| `src/components/ServeSpinOverlay.tsx` (NEW) | Overlay component with SVG shuttle, animation lifecycle, random result |
| `src/styles.css` (MODIFY) | Spin keyframes, overlay backdrop, shuttle and result text styles |
| `src/App.tsx` (MODIFY) | `showServeSpin` state, hook into New Match and Session Start flows, render overlay, handle completion |
| `src/components/MatchSettingsModal.tsx` (MODIFY) | Wire "Reroll first server" button to `onRequestServeSpin` instead of `onRerollFirstServer` |

---

### Task 1: Add serve spin styles to styles.css

**Files:**
- Modify: `src/styles.css` (append before end)

- [ ] **Step 1: Append overlay and spin styles**

Append the following before the closing of `src/styles.css` (after line 2169, the end of the animation-overlay section):

```css
/* Serve spin overlay */
.serve-spin-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  animation: serve-spin-fade-in 0.3s ease-out forwards;
}

@keyframes serve-spin-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.serve-spin-shuttle {
  width: 80px;
  height: 100px;
  will-change: transform;
}

.serve-spin-shuttle--spinning {
  animation: serve-shuttle-spin 2.8s cubic-bezier(0.15, 0.9, 0.3, 1) forwards;
}

.serve-spin-shuttle--landed {
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.3, 1);
}

@keyframes serve-shuttle-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(5760deg); }
}

.serve-spin-result {
  margin-top: 24px;
  font-size: 2rem;
  font-weight: bold;
  color: white;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.35s ease-out, transform 0.35s ease-out;
}

.serve-spin-result--visible {
  opacity: 1;
  transform: translateY(0);
}
```

---

### Task 2: Create ServeSpinOverlay component

**Files:**
- Create: `src/components/ServeSpinOverlay.tsx`

- [ ] **Step 1: Write the component**

```typescript
import { useEffect, useRef, useState } from 'react';
import type { MatchMode, PlayerId, TeamId } from '../domain/matchTypes';

interface Props {
  readonly mode: MatchMode;
  readonly onComplete: (teamId: TeamId, playerId: PlayerId) => void;
}

function rollResult(mode: MatchMode): { teamId: TeamId; playerId: PlayerId } {
  const choices: Array<{ teamId: TeamId; playerId: PlayerId }> =
    mode === 'singles'
      ? [
          { teamId: 'teamA', playerId: 'A1' },
          { teamId: 'teamB', playerId: 'B1' },
        ]
      : [
          { teamId: 'teamA', playerId: 'A1' },
          { teamId: 'teamA', playerId: 'A2' },
          { teamId: 'teamB', playerId: 'B1' },
          { teamId: 'teamB', playerId: 'B2' },
        ];
  return choices[Math.floor(Math.random() * choices.length)];
}

export function ServeSpinOverlay({ mode, onComplete }: Props) {
  const resultRef = useRef(rollResult(mode));
  const [landed, setLanded] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    function onAnimEnd() {
      if (doneRef.current) return;
      doneRef.current = true;
      setLanded(true);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShowResult(true);
        });
      });

      setTimeout(() => {
        onComplete(resultRef.current.teamId, resultRef.current.playerId);
      }, 1400);
    }

    const el = document.querySelector('.serve-spin-shuttle--spinning');
    el?.addEventListener('animationend', onAnimEnd);
    return () => el?.removeEventListener('animationend', onAnimEnd);
  }, [onComplete]);

  const finalDeg =
    resultRef.current.teamId === 'teamA'
      ? 5760 - 90
      : 5760 + 90;

  return (
    <div className="serve-spin-overlay" role="img" aria-label="Spinning shuttle to determine first server">
      <svg
        className={`serve-spin-shuttle ${landed ? 'serve-spin-shuttle--landed' : 'serve-spin-shuttle--spinning'}`}
        style={landed ? { transform: `rotate(${finalDeg}deg)` } : undefined}
        viewBox="0 0 60 80"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M30 2 L58 45 L48 50 L30 22 L12 50 L2 45 Z"
          fill="#f0f0f0"
          stroke="#ccc"
          strokeWidth="1"
        />
        <line x1="30" y1="6" x2="46" y2="47" stroke="#ddd" strokeWidth="1" />
        <line x1="30" y1="6" x2="30" y2="49" stroke="#ddd" strokeWidth="1" />
        <line x1="30" y1="6" x2="14" y2="47" stroke="#ddd" strokeWidth="1" />
        <rect x="27" y="45" width="6" height="12" rx="2" fill="#888" />
        <ellipse cx="30" cy="63" rx="10" ry="7" fill="#faf3e0" stroke="#c4b896" strokeWidth="1" />
      </svg>
      <p className={`serve-spin-result ${showResult ? 'serve-spin-result--visible' : ''}`}>
        {resultRef.current.teamId === 'teamA' ? 'Team A' : 'Team B'} serves first!
      </p>
    </div>
  );
}
```

---

### Task 3: Update App.tsx to integrate the spin overlay

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add import for ServeSpinOverlay**

At line 74 (after the existing AnimationOverlay import), add:

```typescript
import { ServeSpinOverlay } from './components/ServeSpinOverlay';
```

- [ ] **Step 2: Add showServeSpin state**

After line 182 (`const [activeAnimation, setActiveAnimation] = useState<AnimationEvent | null>(null);`), add:

```typescript
const [showServeSpin, setShowServeSpin] = useState(false);
```

- [ ] **Step 3: Create handleRequestServeSpin callback**

After line 407 (after `handleRerollFirstServer` closing brace), add:

```typescript
const handleRequestServeSpin = useCallback(() => {
  if (!preferencesRef.current.animationsEnabled) {
    handleRerollFirstServer();
    return;
  }
  setShowServeSpin(true);
}, [handleRerollFirstServer]);
```

- [ ] **Step 4: Create handleServeSpinComplete callback**

After the new `handleRequestServeSpin` callback, add:

```typescript
const handleServeSpinComplete = useCallback(
  (teamId: TeamId, playerId: PlayerId) => {
    setShowServeSpin(false);
    dispatch({ type: 'SET_INITIAL_SERVER', teamId, playerId });
  },
  [dispatch],
);
```

- [ ] **Step 5: Modify handleNewMatch to show spin**

Replace lines 357-371 (the entire `handleNewMatch` callback) with:

```typescript
const handleNewMatch = useCallback(() => {
  if (hasStarted(matchView.match) && !window.confirm('Start a new match and discard the current score?')) {
    return;
  }

  clearMatchState();
  setOneOffSpriteOverrides({});
  setMatchView((current) =>
    applyMatchViewAction(current, {
      type: 'RESET_MODE',
      mode: preferencesRef.current.matchMode,
      playerNames: preferencesRef.current.playerNames,
    }),
  );

  if (preferencesRef.current.animationsEnabled) {
    setShowServeSpin(true);
  } else {
    const choices: Array<{ teamId: TeamId; playerId: PlayerId }> =
      preferencesRef.current.matchMode === 'singles'
        ? [
            { teamId: 'teamA' as TeamId, playerId: 'A1' as PlayerId },
            { teamId: 'teamB' as TeamId, playerId: 'B1' as PlayerId },
          ]
        : [
            { teamId: 'teamA' as TeamId, playerId: 'A1' as PlayerId },
            { teamId: 'teamA' as TeamId, playerId: 'A2' as PlayerId },
            { teamId: 'teamB' as TeamId, playerId: 'B1' as PlayerId },
            { teamId: 'teamB' as TeamId, playerId: 'B2' as PlayerId },
          ];
    const choice = choices[Math.floor(Math.random() * choices.length)];
    dispatch({ type: 'SET_INITIAL_SERVER', teamId: choice.teamId, playerId: choice.playerId });
  }
}, [matchView.match, dispatch]);
```

- [ ] **Step 6: Modify handleStartMatch to show spin**

Replace lines 579-593 (the entire `handleStartMatch` callback) with:

```typescript
const handleStartMatch = useCallback((split: TeamSplit) => {
  const playerNames = {
    A1: split.teamA[0].displayName,
    A2: split.teamA[1].displayName,
    B1: split.teamB[0].displayName,
    B2: split.teamB[1].displayName,
  };
  const startedAt = new Date().toISOString();
  clearMatchState();
  saveInProgressMatchState({ split, startedAt });
  setMatchView({ match: createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1', playerNames }) });
  setCurrentPlayedSplit(split);
  setCurrentSessionMatchStartedAt(startedAt);
  setSessionPhase('playing');

  if (preferencesRef.current.animationsEnabled) {
    setShowServeSpin(true);
  }
}, []);
```

- [ ] **Step 7: Render ServeSpinOverlay in the main return**

Right after line 1005 (`<AnimationOverlay event={activeAnimation} onDismiss={handleAnimationDismiss} />`), add:

```typescript
{showServeSpin && (
  <ServeSpinOverlay mode={match.mode} onComplete={handleServeSpinComplete} />
)}
```

---

### Task 4: Update MatchSettingsModal to trigger spin

**Files:**
- Modify: `src/components/MatchSettingsModal.tsx`

- [ ] **Step 1: Replace onRerollFirstServer prop with onRequestServeSpin**

Replace line 10:
```typescript
  readonly onRerollFirstServer: () => void;
```
With:
```typescript
  readonly onRequestServeSpin: () => void;
```

- [ ] **Step 2: Add onRequestServeSpin to destructured props**

Replace line 21:
```typescript
  onRerollFirstServer,
```
With:
```typescript
  onRequestServeSpin,
```

- [ ] **Step 3: Wire button to new prop**

Replace line 71-72:
```typescript
          <button type="button" disabled={settingsLocked} onClick={onRerollFirstServer}>
            Reroll first server
          </button>
```
With:
```typescript
          <button type="button" disabled={settingsLocked} onClick={onRequestServeSpin}>
            Reroll first server
          </button>
```

- [ ] **Step 4: Update App.tsx to pass new prop to MatchSettingsModal**

In `src/App.tsx`, find the `MatchSettingsModal` JSX (around line 795-804) and replace the `onRerollFirstServer` prop:

Find:
```typescript
          onRerollFirstServer={handleRerollFirstServer}
```
Replace with:
```typescript
          onRequestServeSpin={handleRequestServeSpin}
```

---

### Task 5: Verify with lint and typecheck

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 2: Run lint**

Check AGENTS.md for the lint command; if none, skip.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add serve spin animation for first server selection"
```
