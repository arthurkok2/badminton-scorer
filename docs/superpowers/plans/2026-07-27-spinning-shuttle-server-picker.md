# Spinning Shuttle Server Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual `ServerPickerOverlay` with an interactive spinning shuttle animation that visually determines which team serves first.

**Architecture:** New `SpinningShuttle` component renders a fullscreen overlay with an SVG shuttle. User clicks to spin, CSS transition rotates the shuttle 2.5s with natural deceleration. After settling, the cork direction (left = Team A, right = Team B) determines the winner. Results show for 500ms then `onComplete` fires. `ServerPickerOverlay` is removed.

**Tech Stack:** React 19, TypeScript, plain CSS

---

### File Structure

| File | Responsibility |
|------|---------------|
| `src/components/SpinningShuttle.tsx` (NEW) | Overlay with SVG shuttle, click-to-spin, random outcome, state machine |
| `src/components/SpinningShuttle.test.tsx` (NEW) | Component tests: idle, spin, outcome, callback invocation |
| `src/components/ServerPickerOverlay.tsx` (REMOVE) | Replaced by SpinningShuttle |
| `src/styles.css` (MODIFY) | Remove `.server-picker-*` block, add `.spinning-shuttle-*` block |
| `src/App.tsx` (MODIFY) | Replace `showServerPicker` with `showSpinningShuttle`, update handler |
| `.docs/ui/ui-architecture.md` (MODIFY) | Replace ServerPickerOverlay reference with SpinningShuttle |

---

### Task 1: Add spinning shuttle styles to styles.css

**Files:**
- Modify: `src/styles.css` (replace lines 2221–2291, the `/* Server picker overlay */` block)

- [ ] **Step 1: Replace the Server picker overlay CSS block**

Remove the entire block from `/* Server picker overlay */` (line 2221) through `.server-picker-button--teamB` closing brace (line 2291). In its place, insert:

```css
/* Spinning shuttle overlay */
.spinning-shuttle-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  animation: spinning-shuttle-fade-in 0.3s ease-out forwards;
}

@keyframes spinning-shuttle-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.spinning-shuttle-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  padding: 40px 32px;
  border-radius: 16px;
  background: #141e24;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  position: relative;
  width: 280px;
}

.spinning-shuttle-prompt {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: #a0b4c4;
  text-align: center;
}

.spinning-shuttle-svg {
  width: 72px;
  height: 96px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
}

.spinning-shuttle-svg--spinning {
  transition: transform 2.5s cubic-bezier(0.2, 0.8, 0.3, 1);
  cursor: default;
}

.spinning-shuttle-svg--settled {
  cursor: default;
}

.spinning-shuttle-labels {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 0 4px;
}

.spinning-shuttle-label {
  font-size: 0.9rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
}

.spinning-shuttle-label--teamA {
  color: #e0736a;
  background: rgba(209, 75, 85, 0.15);
}

.spinning-shuttle-label--teamB {
  color: #6aace0;
  background: rgba(77, 130, 196, 0.15);
}

.spinning-shuttle-label--winner {
  outline: 2px solid #f3d36b;
  color: #f3d36b;
  background: rgba(243, 211, 107, 0.15);
}

.spinning-shuttle-result {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 900;
  color: #f5f7fa;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.35s ease-out, transform 0.35s ease-out;
}

.spinning-shuttle-result--visible {
  opacity: 1;
  transform: translateY(0);
}
```

- [ ] **Step 2: Verify CSS compiles**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run build
```

Expected: build succeeds, no CSS errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "style: replace server-picker CSS with spinning-shuttle styles"
```

---

### Task 2: Create SpinningShuttle component

**Files:**
- Create: `src/components/SpinningShuttle.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { useCallback, useRef, useState } from 'react';
import type { PlayerId, TeamId } from '../domain/matchTypes';

interface Props {
  readonly playerNames: Readonly<Record<PlayerId, string>>;
  readonly onComplete: (teamId: TeamId) => void;
}

type Phase = 'idle' | 'spinning' | 'settled';

function randomSpin(): { targetRotation: number; winner: TeamId } {
  const baseSpins = (3 + Math.floor(Math.random() * 3)) * 360;
  const teamB = Math.random() < 0.5;

  let offset: number;
  if (teamB) {
    offset = 60 + Math.random() * 60;
  } else {
    offset = 240 + Math.random() * 60;
  }

  return {
    targetRotation: baseSpins + offset,
    winner: teamB ? 'teamB' : 'teamA',
  };
}

export function SpinningShuttle({ playerNames, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [currentRotation, setCurrentRotation] = useState(0);
  const [winner, setWinner] = useState<TeamId | null>(null);
  const [showResult, setShowResult] = useState(false);
  const doneRef = useRef(false);
  const teamAName = playerNames.A1;
  const teamBName = playerNames.B1;

  const handleClick = useCallback(() => {
    if (phase !== 'idle') return;
    const { targetRotation, winner: w } = randomSpin();
    setWinner(w);
    setPhase('spinning');
    setCurrentRotation(targetRotation);
  }, [phase]);

  const handleTransitionEnd = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('settled');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setShowResult(true);
      });
    });

    setTimeout(() => {
      if (winner) onComplete(winner);
    }, 500);
  }, [winner, onComplete]);

  const shuttleClasses = [
    'spinning-shuttle-svg',
    phase === 'spinning' && 'spinning-shuttle-svg--spinning',
    phase === 'settled' && 'spinning-shuttle-svg--settled',
  ]
    .filter(Boolean)
    .join(' ');

  const labelAClasses = [
    'spinning-shuttle-label',
    'spinning-shuttle-label--teamA',
    showResult && winner === 'teamA' && 'spinning-shuttle-label--winner',
  ]
    .filter(Boolean)
    .join(' ');

  const labelBClasses = [
    'spinning-shuttle-label',
    'spinning-shuttle-label--teamB',
    showResult && winner === 'teamB' && 'spinning-shuttle-label--winner',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="spinning-shuttle-overlay" role="dialog" aria-label="Spin shuttle to decide who serves first">
      <div className="spinning-shuttle-card">
        <p className="spinning-shuttle-prompt">
          {phase === 'idle' && 'Tap the shuttle to toss'}
          {phase === 'spinning' && 'Spinning...'}
          {showResult && (winner === 'teamA' ? `Team A ${teamAName} serves first!` : `Team B ${teamBName} serves first!`)}
        </p>

        <div className="spinning-shuttle-labels">
          <span className={labelAClasses}>Team A {teamAName}</span>
          <span className={labelBClasses}>Team B {teamBName}</span>
        </div>

        <svg
          className={shuttleClasses}
          style={currentRotation !== 0 ? { transform: `rotate(${currentRotation}deg)` } : undefined}
          viewBox="0 0 60 80"
          xmlns="http://www.w3.org/2000/svg"
          onClick={handleClick}
          onTransitionEnd={handleTransitionEnd}
          role="button"
          aria-label="Tap to spin the shuttle"
          tabIndex={0}
        >
          <ellipse cx="30" cy="15" rx="8" ry="10" fill="#faf3e0" stroke="#c4b896" strokeWidth="1" />
          <rect x="27" y="24" width="6" height="10" rx="2" fill="#888" />
          <path
            d="M30 33 L52 68 L42 72 L30 48 L18 72 L8 68 Z"
            fill="#f0f0f0"
            stroke="#ccc"
            strokeWidth="1"
          />
          <line x1="30" y1="33" x2="45" y2="70" stroke="#ddd" strokeWidth="1" />
          <line x1="30" y1="33" x2="30" y2="72" stroke="#ddd" strokeWidth="1" />
          <line x1="30" y1="33" x2="15" y2="70" stroke="#ddd" strokeWidth="1" />
        </svg>

        <p className={`spinning-shuttle-result ${showResult ? 'spinning-shuttle-result--visible' : ''}`}>
          {showResult ? (winner === 'teamA' ? 'Team A serves first!' : 'Team B serves first!') : ' '}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SpinningShuttle.tsx
git commit -m "feat: add SpinningShuttle component"
```

---

### Task 3: Write tests for SpinningShuttle

**Files:**
- Create: `src/components/SpinningShuttle.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SpinningShuttle } from './SpinningShuttle';

const defaultProps = {
  playerNames: { A1: 'Alice', A2: 'Bob', B1: 'Charlie', B2: 'Diana' },
  onComplete: vi.fn(),
};

describe('SpinningShuttle', () => {
  it('renders the overlay with team names and prompt', () => {
    render(<SpinningShuttle {...defaultProps} />);

    expect(screen.getByRole('dialog', { name: /spin shuttle/i })).toBeInTheDocument();
    expect(screen.getByText(/tap the shuttle to toss/i)).toBeInTheDocument();
    expect(screen.getByText(/team a alice/i)).toBeInTheDocument();
    expect(screen.getByText(/team b charlie/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tap to spin/i })).toBeInTheDocument();
  });

  it('transitions to spinning on click', () => {
    render(<SpinningShuttle {...defaultProps} />);

    const shuttle = screen.getByRole('button', { name: /tap to spin/i });
    fireEvent.click(shuttle);

    expect(screen.getByText(/spinning/i)).toBeInTheDocument();
  });

  it('calls onComplete with a teamId after spin settles', async () => {
    vi.useFakeTimers();
    render(<SpinningShuttle {...defaultProps} />);

    const shuttle = screen.getByRole('button', { name: /tap to spin/i });
    fireEvent.click(shuttle);

    fireEvent.transitionEnd(shuttle);

    expect(screen.getByText(/serves first/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
    const teamId = defaultProps.onComplete.mock.calls[0][0];
    expect(['teamA', 'teamB']).toContain(teamId);

    vi.useRealTimers();
  });

  it('does not spin again when clicked during spinning', () => {
    render(<SpinningShuttle {...defaultProps} />);

    const shuttle = screen.getByRole('button', { name: /tap to spin/i });
    fireEvent.click(shuttle);
    fireEvent.click(shuttle);

    expect(defaultProps.onComplete).not.toHaveBeenCalled();
  });

  it('produces both outcomes over many spins', () => {
    const outcomes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      render(
        <SpinningShuttle
          playerNames={{ A1: 'A', A2: 'AA', B1: 'B', B2: 'BB' }}
          onComplete={vi.fn()}
        />,
      );

      const shuttle = screen.getByRole('button', { name: /tap to spin/i });
      fireEvent.click(shuttle);
      fireEvent.transitionEnd(shuttle);

      const resultEl = screen.getByText(/serves first/i);
      if (resultEl.textContent?.includes('Team A')) outcomes.add('teamA');
      if (resultEl.textContent?.includes('Team B')) outcomes.add('teamB');
    }

    expect(outcomes.has('teamA')).toBe(true);
    expect(outcomes.has('teamB')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/components/SpinningShuttle.test.tsx
```

Expected: all 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/SpinningShuttle.test.tsx
git commit -m "test: add SpinningShuttle tests"
```

---

### Task 4: Update App.tsx to use SpinningShuttle instead of ServerPickerOverlay

**Files:**
- Modify: `src/App.tsx` (lines 76, 186, 376, 398–404, 591, 1006–1012)
- Remove: `src/components/ServerPickerOverlay.tsx`

- [ ] **Step 1: Change the import**

At line 76, replace:

```typescript
import { ServerPickerOverlay } from './components/ServerPickerOverlay';
```

with:

```typescript
import { SpinningShuttle } from './components/SpinningShuttle';
```

- [ ] **Step 2: Rename the state variable**

At line 186, replace:

```typescript
const [showServerPicker, setShowServerPicker] = useState(false);
```

with:

```typescript
const [showSpinningShuttle, setShowSpinningShuttle] = useState(false);
```

- [ ] **Step 3: Update handleNewMatch**

At line 376, replace:

```typescript
    setShowServerPicker(true);
```

with:

```typescript
    setShowSpinningShuttle(true);
```

- [ ] **Step 4: Replace handleServerPickerComplete with handleShuttleComplete**

Remove the `handleServerPickerComplete` callback (lines 398–404):

```typescript
const handleServerPickerComplete = useCallback(
    (teamId: TeamId, playerId: PlayerId) => {
      setShowServerPicker(false);
      dispatch({ type: 'SET_INITIAL_SERVER', teamId, playerId });
    },
    [dispatch],
  );
```

In its place, add:

```typescript
const handleShuttleComplete = useCallback(
    (teamId: TeamId) => {
      setShowSpinningShuttle(false);
      const playerId = teamId === 'teamA' ? 'A1' : 'B1';
      dispatch({ type: 'SET_INITIAL_SERVER', teamId, playerId });
    },
    [dispatch],
  );
```

- [ ] **Step 5: Update handleStartMatch**

At line 591, replace:

```typescript
    setShowServerPicker(true);
```

with:

```typescript
    setShowSpinningShuttle(true);
```

- [ ] **Step 6: Update the JSX rendering**

Replace lines 1006–1012:

```tsx
      {showServerPicker && (
        <ServerPickerOverlay
          mode={match.mode}
          playerNames={sessionPlayerNames ?? preferences.playerNames}
          onComplete={handleServerPickerComplete}
        />
      )}
```

with:

```tsx
      {showSpinningShuttle && (
        <SpinningShuttle
          playerNames={sessionPlayerNames ?? preferences.playerNames}
          onComplete={handleShuttleComplete}
        />
      )}
```

- [ ] **Step 7: Delete ServerPickerOverlay.tsx**

```bash
git rm src/components/ServerPickerOverlay.tsx
```

- [ ] **Step 8: Run tests to verify no regressions**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test
```

Expected: all existing tests pass (App, MatchSettingsModal, commands, etc.).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: replace ServerPickerOverlay with SpinningShuttle
```
```

---

### Task 5: Update UI architecture doc

**Files:**
- Modify: `.docs/ui/ui-architecture.md`

- [ ] **Step 1: Add SpinningShuttle to the component hierarchy**

The doc currently doesn't explicitly list `ServerPickerOverlay` in the hierarchy tree. Add `SpinningShuttle` under `Menus & Modals` in the hierarchy diagram (line 36–44):

On line 36 (the `├── Menus & Modals` section), add a new line after the existing entries:

```
├── Menus & Modals
│   ├── AccountMenu (sign in/out, account settings)
│   ├── MatchSettingsMenu
│   ├── DisplayMenu (animations toggle, session history toggle)
│   ├── DiagnosticsLog
│   ├── MatchHistory
│   ├── AnimationsMenu
│   ├── AnnouncementsMenu
│   ├── RemoteControlsMenu
│   └── SpinningShuttle (interactive shuttle spin to pick first server)
```

- [ ] **Step 2: Commit**

```bash
git add .docs/ui/ui-architecture.md
git commit -m "docs: add SpinningShuttle to UI architecture doc"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full test suite**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run lint**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Run build**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Check service worker syntax**

```bash
node --check public/sw.js
```

Expected: no errors.

- [ ] **Step 5: Commit if any fixups needed**

```bash
git add -A && git commit -m "chore: final verification cleanups" || echo "Nothing to commit"
```
