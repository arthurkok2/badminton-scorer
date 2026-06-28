# Physical Toss Server Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the random ServeSpinOverlay with a manual ServerPickerOverlay that lets players record who serves first after a physical shuttle toss.

**Architecture:** New `ServerPickerOverlay` component renders a fullscreen overlay with two buttons (Team A / Team B serves). `App.tsx` renders it instead of `ServeSpinOverlay`. `MatchSettingsModal` drops the "Reroll first server" button. `pickRandomServer` and `ServeSpinOverlay` are removed entirely.

**Tech Stack:** React 19, TypeScript, plain CSS

---

### Task 1: Create ServerPickerOverlay component

**Files:**
- Create: `src/components/ServerPickerOverlay.tsx`

- [ ] **Step 1: Write the component**

```tsx
import type { MatchMode, PlayerId, TeamId } from '../domain/matchTypes';

interface Props {
  readonly mode: MatchMode;
  readonly playerNames: Record<PlayerId, string>;
  readonly onComplete: (teamId: TeamId, playerId: PlayerId) => void;
}

export function ServerPickerOverlay({ mode: _mode, playerNames, onComplete }: Props) {
  const teamAName = playerNames.A1;
  const teamBName = playerNames.B1;

  return (
    <div className="server-picker-overlay" role="dialog" aria-label="Choose which team serves first">
      <div className="server-picker-card">
        <h2 className="server-picker-title">Who serves first?</h2>
        <div className="server-picker-buttons">
          <button
            type="button"
            className="server-picker-button server-picker-button--teamA"
            onClick={() => onComplete('teamA', 'A1')}
          >
            Team A {teamAName} serves
          </button>
          <button
            type="button"
            className="server-picker-button server-picker-button--teamB"
            onClick={() => onComplete('teamB', 'B1')}
          >
            Team B {teamBName} serves
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ServerPickerOverlay.tsx
git commit -m "feat: add ServerPickerOverlay component"
```

---

### Task 2: Update styles.css

**Files:**
- Modify: `src/styles.css:2212-2264` (remove serve-spin block, add server-picker block)

- [ ] **Step 1: Replace serve-spin CSS with server-picker CSS**

Remove lines 2212-2264 (the entire `/* Serve spin overlay */` block including all `.serve-spin-*` classes and `@keyframes serve-spin-fade-in` and `@keyframes serve-shuttle-spin`).

In its place, add:

```css
/* Server picker overlay */
.server-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  animation: server-picker-fade-in 0.3s ease-out forwards;
}

@keyframes server-picker-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.server-picker-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 32px 24px;
  border-radius: 16px;
  background: #141e24;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.server-picker-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 900;
  color: #f5f7fa;
}

.server-picker-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
}

.server-picker-button {
  min-height: 56px;
  border: 0;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 1.1rem;
  font-weight: 700;
  color: #f5f7fa;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.server-picker-button--teamA {
  background: linear-gradient(135deg, #d14b55, #e87a52);
}

.server-picker-button--teamB {
  background: linear-gradient(135deg, #4d82c4, #4ab8a6);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "style: replace serve-spin CSS with server-picker styles"
```

---

### Task 3: Update MatchSettingsModal

**Files:**
- Modify: `src/components/MatchSettingsModal.tsx`

- [ ] **Step 1: Remove `onRequestServeSpin` from interface, props destructuring, and the Reroll button**

Change the interface at lines 3-12:

```tsx
interface MatchSettingsModalProps {
  readonly match: MatchState;
  readonly matchMode: MatchMode;
  readonly playerNames: Record<PlayerId, string>;
  readonly settingsLocked?: boolean;
  readonly onMatchModeChange: (mode: MatchMode) => void;
  readonly onSetInitialServer: (teamId: TeamId, playerId: PlayerId) => void;
  readonly onPlayerNameChange: (playerId: PlayerId, name: string) => void;
}
```

(Removed `onRequestServeSpin: () => void;`)

Change the function signature at line 14 to remove `onRequestServeSpin`:

```tsx
export function MatchSettingsModal({
  match,
  matchMode,
  playerNames,
  settingsLocked = false,
  onMatchModeChange,
  onSetInitialServer,
  onPlayerNameChange,
}: MatchSettingsModalProps) {
```

(Removed `onRequestServeSpin,` from destructuring)

Remove the Reroll button (lines 71-73):

```tsx
          {/* Remove these lines: */}
          {/* <button type="button" disabled={settingsLocked} onClick={onRequestServeSpin}>
                Reroll first server
              </button> */}
```

- [ ] **Step 2: Verify the file compiles**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npx tsc --noEmit src/components/MatchSettingsModal.tsx
```

Expected: no errors (may show unrelated global errors from loose file compilation; that's OK).

- [ ] **Step 3: Commit**

```bash
git add src/components/MatchSettingsModal.tsx
git commit -m "refactor: remove Reroll first server button from match settings"
```

---

### Task 4: Update MatchSettingsModal test

**Files:**
- Modify: `src/components/MatchSettingsModal.test.tsx`

- [ ] **Step 1: Remove `onRequestServeSpin` from test props and remove its assertion**

In `renderModal` (lines 8-21), remove line 15 (`onRequestServeSpin: vi.fn(),`):

```tsx
function renderModal(overrides = {}) {
  const props = {
    match: createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
    matchMode: 'doubles' as const,
    playerNames: { ...DEFAULT_PLAYER_NAMES },
    onMatchModeChange: vi.fn(),
    onSetInitialServer: vi.fn(),
    onPlayerNameChange: vi.fn(),
    ...overrides,
  };
  render(<MatchSettingsModal {...props} />);
  return props;
}
```

In the "calls match settings callbacks" test (lines 32-47), remove the Reroll click and its assertion. Replace lines 40-45:

```tsx
  it('calls match settings callbacks', async () => {
    const user = userEvent.setup();
    const props = renderModal();

    await user.click(screen.getByRole('button', { name: /singles/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /team a player 1 name/i }), {
      target: { value: 'Alice' },
    });
    await user.click(screen.getByRole('button', { name: /team b player 3 serves/i }));

    expect(props.onMatchModeChange).toHaveBeenCalledWith('singles');
    expect(props.onPlayerNameChange).toHaveBeenCalledWith('A1', 'Alice');
    expect(props.onSetInitialServer).toHaveBeenCalledWith('teamB', 'B1');
  });
```

(Removed `await user.click(screen.getByRole('button', { name: /reroll first server/i }));` and `expect(props.onRequestServeSpin).toHaveBeenCalledTimes(1);`)

In the "disables match setup controls when session context locks settings" test (lines 61-70), remove line 67 (`expect(screen.getByRole('button', { name: /reroll first server/i })).toBeDisabled();`):

```tsx
  it('disables match setup controls when session context locks settings', () => {
    renderModal({ settingsLocked: true });

    expect(screen.getByRole('button', { name: /doubles/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /singles/i })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /team a player 1 name/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /team b player 3 serves/i })).toBeDisabled();
    expect(screen.getByText(/session match settings are locked/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it passes**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/components/MatchSettingsModal.test.tsx
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```bash
git add src/components/MatchSettingsModal.test.tsx
git commit -m "test: remove Reroll first server assertions from match settings tests"
```

---

### Task 5: Update App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace import**

At line 75, replace:

```tsx
import { pickRandomServer, ServeSpinOverlay } from './components/ServeSpinOverlay';
```

with:

```tsx
import { ServerPickerOverlay } from './components/ServerPickerOverlay';
```

- [ ] **Step 2: Rename state variable**

At line 184, replace:

```tsx
  const [showServeSpin, setShowServeSpin] = useState(false);
```

with:

```tsx
  const [showServerPicker, setShowServerPicker] = useState(false);
```

- [ ] **Step 3: Update handleNewMatch (lines 359-380)**

Replace the animations check block (lines 374-379):

```tsx
    if (preferencesRef.current.animationsEnabled) {
      setShowServeSpin(true);
    } else {
      const { teamId, playerId } = pickRandomServer(preferencesRef.current.matchMode);
      dispatch({ type: 'SET_INITIAL_SERVER', teamId, playerId });
    }
```

with:

```tsx
    setShowServerPicker(true);
```

- [ ] **Step 4: Remove handleRerollFirstServer (lines 401-404)**

Remove this entire callback:

```tsx
  const handleRerollFirstServer = useCallback(() => {
    const { teamId, playerId } = pickRandomServer(preferencesRef.current.matchMode);
    dispatch({ type: 'SET_INITIAL_SERVER', teamId, playerId });
  }, [dispatch]);
```

- [ ] **Step 5: Remove handleRequestServeSpin (lines 406-412)**

Remove this entire callback:

```tsx
  const handleRequestServeSpin = useCallback(() => {
    if (!preferencesRef.current.animationsEnabled) {
      handleRerollFirstServer();
      return;
    }
    setShowServeSpin(true);
  }, [handleRerollFirstServer]);
```

- [ ] **Step 6: Rename handleServeSpinComplete → handleServerPickerComplete (lines 414-419)**

Replace:

```tsx
  const handleServeSpinComplete = useCallback(
    (teamId: TeamId, playerId: PlayerId) => {
      setShowServeSpin(false);
      dispatch({ type: 'SET_INITIAL_SERVER', teamId, playerId });
    },
    [dispatch],
  );
```

with:

```tsx
  const handleServerPickerComplete = useCallback(
    (teamId: TeamId, playerId: PlayerId) => {
      setShowServerPicker(false);
      dispatch({ type: 'SET_INITIAL_SERVER', teamId, playerId });
    },
    [dispatch],
  );
```

- [ ] **Step 7: Update handleStartMatch (lines 607-612)**

Replace the animations block:

```tsx
    if (preferencesRef.current.animationsEnabled) {
      setShowServeSpin(true);
    } else {
      const { teamId, playerId } = pickRandomServer('doubles');
      dispatch({ type: 'SET_INITIAL_SERVER', teamId, playerId });
    }
```

with:

```tsx
    setShowServerPicker(true);
```

- [ ] **Step 8: Update MatchSettingsModal JSX (lines 814-824)**

Remove the `onRequestServeSpin` prop. Change from:

```tsx
        <MatchSettingsModal
          match={match}
          matchMode={preferences.matchMode}
          playerNames={sessionPlayerNames ?? preferences.playerNames}
          settingsLocked={settingsLocked}
          onMatchModeChange={handleMatchModeChange}
          onSetInitialServer={handleSetInitialServer}
          onRequestServeSpin={handleRequestServeSpin}
          onPlayerNameChange={appMode === 'session' ? () => undefined : handlePlayerNameChange}
        />
```

to:

```tsx
        <MatchSettingsModal
          match={match}
          matchMode={preferences.matchMode}
          playerNames={sessionPlayerNames ?? preferences.playerNames}
          settingsLocked={settingsLocked}
          onMatchModeChange={handleMatchModeChange}
          onSetInitialServer={handleSetInitialServer}
          onPlayerNameChange={appMode === 'session' ? () => undefined : handlePlayerNameChange}
        />
```

- [ ] **Step 9: Replace JSX overlay rendering (lines 1026-1028)**

Replace:

```tsx
      {showServeSpin && (
        <ServeSpinOverlay mode={match.mode} onComplete={handleServeSpinComplete} />
      )}
```

with:

```tsx
      {showServerPicker && (
        <ServerPickerOverlay
          mode={match.mode}
          playerNames={preferences.playerNames}
          onComplete={handleServerPickerComplete}
        />
      )}
```

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace ServeSpinOverlay with ServerPickerOverlay"
```

---

### Task 6: Delete ServeSpinOverlay

**Files:**
- Remove: `src/components/ServeSpinOverlay.tsx`

- [ ] **Step 1: Delete the obsolete file**

```bash
git rm src/components/ServeSpinOverlay.tsx
git commit -m "refactor: remove obsolete ServeSpinOverlay component"
```

---

### Task 7: Verify

- [ ] **Step 1: Run full test suite**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Verify service worker**

```bash
node --check public/sw.js
```

Expected: no output (success).

- [ ] **Step 5: Commit (if any fixups from verification)**

```bash
git add -A
git diff --cached --stat
# Only commit if verification surfaced issues that needed fixes
```
