# Court Score Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate live scoreboard panel with a single large court display whose two centered, overlaid score halves are the primary touch scoring controls.

**Architecture:** `CourtView` becomes the live scoring surface by accepting `onPointTeam(teamId)` and rendering score buttons inside the existing `.court` stacking context. `App` passes the existing `POINT_TEAM` dispatch callback into `CourtView` and stops rendering `Scoreboard` on the match screen. CSS moves from a two-panel scoreboard/court layout to a full-width court-first layout while keeping controls and status panels below.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, CSS.

---

## File Structure

- Modify `src/components/CourtView.tsx`: add the `onPointTeam` prop, score overlay buttons, disabled winner behavior, and score-only visible text.
- Modify `src/components/CourtView.test.tsx`: add focused tests for overlay rendering, click callbacks, disabled winner state, and no visible team labels in score buttons.
- Modify `src/App.tsx`: remove the `Scoreboard` import and render path, pass the point callback to `CourtView`.
- Modify `src/App.test.tsx`: update scoring queries to use the new accessible labels, remove assertions for deleted serve-summary text, and assert player chips still reflect server changes.
- Modify `src/styles.css`: remove live scoreboard layout/styles, add full-width court layout and overlay score styles.
- Delete `src/components/Scoreboard.tsx` if no imports remain after `App` moves to `CourtView`.

## Task 1: Add Failing Court Overlay Tests

**Files:**
- Modify: `src/components/CourtView.test.tsx`

- [ ] **Step 1: Replace the test imports**

Change the import block at the top of `src/components/CourtView.test.tsx` to include `userEvent`, `vi`, and `MatchState`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CourtView } from './CourtView';
import { createMatch } from '../domain/matchEngine';
import type { MatchState } from '../domain/matchTypes';
```

- [ ] **Step 2: Update existing `CourtView` renders to include `onPointTeam`**

For the three existing tests, replace:

```tsx
render(<CourtView match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })} />);
```

with:

```tsx
render(
  <CourtView
    match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
    onPointTeam={vi.fn()}
  />,
);
```

- [ ] **Step 3: Add overlay rendering and click tests**

Append these tests inside the existing `describe('CourtView', () => {` block, after the player lane mirroring test:

```tsx
  it('renders score-only buttons centered in each team court half', () => {
    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        onPointTeam={vi.fn()}
      />,
    );

    const teamAScore = screen.getByRole('button', { name: /award point to team a, score 0/i });
    const teamBScore = screen.getByRole('button', { name: /award point to team b, score 0/i });

    expect(teamAScore).toHaveClass('court-score-button', 'teamA', 'is-serving');
    expect(teamBScore).toHaveClass('court-score-button', 'teamB');
    expect(teamAScore).toHaveTextContent(/^0$/);
    expect(teamBScore).toHaveTextContent(/^0$/);
    expect(teamAScore).not.toHaveTextContent(/team a/i);
    expect(teamBScore).not.toHaveTextContent(/team b/i);
  });

  it('awards points from the overlaid court score buttons', async () => {
    const user = userEvent.setup();
    const onPointTeam = vi.fn();

    render(
      <CourtView
        match={createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' })}
        onPointTeam={onPointTeam}
      />,
    );

    await user.click(screen.getByRole('button', { name: /award point to team a, score 0/i }));
    await user.click(screen.getByRole('button', { name: /award point to team b, score 0/i }));

    expect(onPointTeam).toHaveBeenNthCalledWith(1, 'teamA');
    expect(onPointTeam).toHaveBeenNthCalledWith(2, 'teamB');
  });
```

- [ ] **Step 4: Add disabled winner-state test**

Append this helper and test below the click test:

```tsx
  it('disables both score buttons after a winner is decided', () => {
    const winnerMatch: MatchState = {
      ...createMatch({ mode: 'doubles', initialServingTeamId: 'teamA', initialServingPlayerId: 'A1' }),
      score: { teamA: 21, teamB: 10 },
      winnerTeamId: 'teamA',
    };

    render(<CourtView match={winnerMatch} onPointTeam={vi.fn()} />);

    expect(screen.getByRole('button', { name: /award point to team a, score 21/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /award point to team b, score 10/i })).toBeDisabled();
  });
```

- [ ] **Step 5: Run the focused test and verify it fails**

Run:

```bash
npm test -- src/components/CourtView.test.tsx
```

Expected: FAIL because `CourtView` does not yet accept `onPointTeam` and does not render `court-score-button` buttons.

- [ ] **Step 6: Commit the failing tests**

```bash
git add src/components/CourtView.test.tsx
git commit -m "test: cover court score overlay behavior"
```

## Task 2: Implement Court Score Overlay

**Files:**
- Modify: `src/components/CourtView.tsx`
- Test: `src/components/CourtView.test.tsx`

- [ ] **Step 1: Update `CourtView` props and render flow**

In `src/components/CourtView.tsx`, replace the props interface and top-level component with:

```tsx
interface CourtViewProps {
  readonly match: MatchState;
  readonly onPointTeam: (teamId: TeamId) => void;
}

export function CourtView({ match, onPointTeam }: CourtViewProps) {
  return (
    <section className="court-section" aria-label="Match court">
      <div className="court">
        <CourtDiagram />
        <CourtScoreOverlay match={match} onPointTeam={onPointTeam} />
        <div className="court-players" aria-label="Player positions">
          <CourtHalf match={match} teamId="teamA" />
          <CourtHalf match={match} teamId="teamB" />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add `CourtScoreOverlay` and `CourtScoreButton`**

Add these functions below `CourtDiagram()`:

```tsx
function CourtScoreOverlay({
  match,
  onPointTeam,
}: {
  readonly match: MatchState;
  readonly onPointTeam: (teamId: TeamId) => void;
}) {
  const scoringDisabled = match.winnerTeamId !== undefined;

  return (
    <div className="court-score-overlay" aria-label="Score controls">
      <CourtScoreButton match={match} teamId="teamA" disabled={scoringDisabled} onPointTeam={onPointTeam} />
      <CourtScoreButton match={match} teamId="teamB" disabled={scoringDisabled} onPointTeam={onPointTeam} />
    </div>
  );
}

function CourtScoreButton({
  match,
  teamId,
  disabled,
  onPointTeam,
}: {
  readonly match: MatchState;
  readonly teamId: TeamId;
  readonly disabled: boolean;
  readonly onPointTeam: (teamId: TeamId) => void;
}) {
  const isServing = match.servingTeamId === teamId;
  const score = match.score[teamId];
  const teamName = match.teams[teamId].name;

  return (
    <button
      className={isServing ? `court-score-button ${teamId} is-serving` : `court-score-button ${teamId}`}
      type="button"
      aria-label={`Award point to ${teamName}, score ${score}`}
      disabled={disabled}
      data-testid={`score-${teamId}`}
      onClick={() => onPointTeam(teamId)}
    >
      <span aria-hidden="true">{score}</span>
    </button>
  );
}
```

- [ ] **Step 3: Run the focused court tests**

Run:

```bash
npm test -- src/components/CourtView.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit the component implementation**

```bash
git add src/components/CourtView.tsx src/components/CourtView.test.tsx
git commit -m "feat: add score overlay to court view"
```

## Task 3: Move App Scoring to `CourtView`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Delete: `src/components/Scoreboard.tsx`

- [ ] **Step 1: Write app-level failing expectations for no separate scoreboard details**

In `src/App.test.tsx`, update the first test from:

```tsx
    await user.click(screen.getByRole('button', { name: /Team A score/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('1');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
    expect(screen.getByText(/serving: Team A/i)).toBeInTheDocument();
    expect(screen.getByText(/server: Player 1/i)).toBeInTheDocument();
```

to:

```tsx
    await user.click(screen.getByRole('button', { name: /award point to team a, score 0/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('1');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('0');
    expect(screen.queryByText(/serving: team a/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/server: player 1/i)).not.toBeInTheDocument();
    expect(screen.getByText('Player 1').closest('.player-chip')).toHaveClass('active-server');
```

- [ ] **Step 2: Update Team B app scoring expectation**

In the Team B score test, replace the click and removed summary assertions:

```tsx
    await user.click(screen.getByRole('button', { name: /Team B score/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('0');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('1');
    expect(screen.getByText(/serving: Team B/i)).toBeInTheDocument();
    expect(screen.getByText(/server: Player 4/i)).toBeInTheDocument();
```

with:

```tsx
    await user.click(screen.getByRole('button', { name: /award point to team b, score 0/i }));

    expect(screen.getByTestId('score-teamA')).toHaveTextContent('0');
    expect(screen.getByTestId('score-teamB')).toHaveTextContent('1');
    expect(screen.queryByText(/serving: team b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/server: player 4/i)).not.toBeInTheDocument();
    expect(screen.getByText('Player 4').closest('.player-chip')).toHaveClass('active-server');
```

- [ ] **Step 3: Update all remaining score-button queries in `src/App.test.tsx`**

Replace each scoring button query:

```tsx
screen.getByRole('button', { name: /Team A score/i })
```

with:

```tsx
screen.getByRole('button', { name: /award point to team a, score \d+/i })
```

Replace each Team B scoring button query:

```tsx
screen.getByRole('button', { name: /Team B score/i })
```

with:

```tsx
screen.getByRole('button', { name: /award point to team b, score \d+/i })
```

For the disabled-after-winner test, replace:

```tsx
    expect(screen.getByRole('button', { name: /Team A score/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Team B score/i })).toBeDisabled();
```

with:

```tsx
    expect(screen.getByRole('button', { name: /award point to team a, score 21/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /award point to team b, score 0/i })).toBeDisabled();
```

- [ ] **Step 4: Update server-name tests to use court chips instead of serve summary**

In `allows first server adjustment before scoring starts`, replace:

```tsx
    expect(screen.getByText(/serving: Team B/i)).toBeInTheDocument();
    expect(screen.getByText(/server: Player 3/i)).toBeInTheDocument();
```

with:

```tsx
    expect(screen.getByText('Player 3').closest('.player-chip')).toHaveClass('active-server');
```

In `reflects an edited player name in the match serve summary immediately`, rename the test to:

```tsx
  it('reflects an edited player name in the court player chip immediately', () => {
```

and replace its assertions with:

```tsx
    expect(screen.getByText('Player 1').closest('.player-chip')).toHaveClass('active-server');

    fireEvent.change(screen.getByRole('textbox', { name: /team a player 1 name/i }), {
      target: { value: 'Alice' },
    });

    expect(screen.getByText('Alice').closest('.player-chip')).toHaveClass('active-server');
```

In `uses player names from storage when starting a new match`, replace:

```tsx
    expect(screen.getByText(/server: Alice/i)).toBeInTheDocument();
```

with:

```tsx
    expect(screen.getByText('Alice').closest('.player-chip')).toHaveClass('active-server');
```

- [ ] **Step 5: Run app tests and verify they fail against current app wiring**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL because `App` still renders `Scoreboard` and `CourtView` does not receive `onPointTeam`.

- [ ] **Step 6: Update `App.tsx` to remove `Scoreboard` and pass scoring to `CourtView`**

Remove this import:

```tsx
import { Scoreboard } from './components/Scoreboard';
```

Replace this render block:

```tsx
        <Scoreboard match={match} onPointTeam={(teamId) => dispatch({ type: 'POINT_TEAM', teamId })} />
        <CourtView match={match} />
```

with:

```tsx
        <CourtView match={match} onPointTeam={(teamId) => dispatch({ type: 'POINT_TEAM', teamId })} />
```

- [ ] **Step 7: Delete the unused `Scoreboard` component**

Delete:

```bash
src/components/Scoreboard.tsx
```

Use `apply_patch`:

```diff
*** Begin Patch
*** Delete File: /Users/arthur/Documents/Projects/badminton-score/src/components/Scoreboard.tsx
*** End Patch
```

- [ ] **Step 8: Verify no imports remain**

Run:

```bash
rg "Scoreboard|scoreboard|serve-summary|winner-banner|team-score|score-row|score-divider" src -n
```

Expected: only stale CSS matches may remain before Task 4; no TypeScript or TSX imports/references should remain.

- [ ] **Step 9: Run app tests**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit app wiring and tests**

```bash
git add src/App.tsx src/App.test.tsx src/components/Scoreboard.tsx
git commit -m "feat: make court view the scoring surface"
```

## Task 4: Update Layout and Overlay Styles

**Files:**
- Modify: `src/styles.css`
- Test: `src/components/CourtView.test.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Replace the wide app grid section**

In `src/styles.css`, replace the `@media (min-width: 960px)` `.app-layout` block near the top:

```css
@media (min-width: 960px) {
  .app-layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      "scoreboard court"
      "controls   controls"
      "status     status"
      "diagnostics diagnostics";
    width: min(100%, 1400px);
  }

  .scoreboard     { grid-area: scoreboard; }
  .court-section  { grid-area: court; }
  .controls       { grid-area: controls; }
  .status-bar     { grid-area: status; }
  .remote-diagnostics { grid-area: diagnostics; }

  .team-score {
    min-height: 230px;
    padding: 20px 12px;
  }

  .score-value {
    font-size: clamp(7rem, 14vw, 12rem);
  }
```

with:

```css
@media (min-width: 960px) {
  .app-layout {
    width: min(100%, 1400px);
  }
```

Keep the existing `.session-layout` rules inside that media query.

- [ ] **Step 2: Remove stale scoreboard selectors from the panel block**

Replace:

```css
.scoreboard,
.court-section,
.controls,
.remote-diagnostics,
.status-bar {
```

with:

```css
.court-section,
.controls,
.remote-diagnostics,
.status-bar {
```

- [ ] **Step 3: Remove the old live scoreboard CSS block**

Delete this complete old live scoreboard CSS block from `src/styles.css`:

```css
.team-score:disabled {
  cursor: not-allowed;
  filter: grayscale(0.35);
  opacity: 0.58;
}

.scoreboard {
  padding: 16px;
}

.score-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 10px;
  align-items: stretch;
}

.team-score {
  display: grid;
  gap: 8px;
  min-height: 150px;
  padding: 14px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  place-items: center;
  background: #101820;
  color: #f8fafc;
  cursor: pointer;
}

.team-score.is-serving {
  border-color: #68d391;
  box-shadow: inset 0 0 0 2px rgba(104, 211, 145, 0.28);
}

.team-label {
  margin: 0;
  color: #c8d5db;
  font-size: 0.9rem;
  font-weight: 800;
  text-transform: uppercase;
}

.score-value {
  margin: 0;
  font-size: clamp(5rem, 24vw, 9rem);
  font-weight: 900;
  line-height: 0.9;
}

.score-divider {
  display: grid;
  place-items: center;
  color: #7f949e;
  font-size: 2.5rem;
  font-weight: 900;
}

.serve-summary {
  display: grid;
  gap: 4px;
  margin-top: 12px;
  color: #e5eef2;
  font-weight: 800;
}

.serve-summary p,
.winner-banner {
  margin: 0;
}

.winner-banner {
  margin-top: 12px;
  padding: 10px;
  border-radius: 8px;
  background: #68d391;
  color: #0f1b16;
  font-weight: 900;
  text-align: center;
}
```

Do not delete `.controller-team-score`; it belongs to `src/pages/ControllerPage.tsx`.

- [ ] **Step 4: Add court overlay stacking and button styles**

In the court section, replace:

```css
.court-diagram,
.court-players {
  position: absolute;
  inset: 0;
}
```

with:

```css
.court-diagram,
.court-score-overlay,
.court-players {
  position: absolute;
  inset: 0;
}
```

Add this block after `.court-diagram`:

```css
.court-score-overlay {
  display: grid;
  grid-template-columns: 1fr 1fr;
  z-index: 1;
}

.court-score-button {
  display: grid;
  min-width: 0;
  border: 0;
  background: transparent;
  color: rgba(248, 250, 252, 0.92);
  cursor: pointer;
  place-items: center;
}

.court-score-button span {
  display: grid;
  min-width: clamp(84px, 18vw, 210px);
  min-height: clamp(72px, 13vw, 150px);
  padding: 0 18px;
  border-radius: 8px;
  place-items: center;
  background: rgba(8, 18, 22, 0.42);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
  font-size: clamp(4.4rem, 18vw, 11rem);
  font-weight: 900;
  line-height: 0.9;
}

.court-score-button.is-serving span {
  box-shadow:
    0 0 0 3px rgba(243, 211, 107, 0.5),
    0 12px 28px rgba(0, 0, 0, 0.22);
}

.court-score-button:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}
```

- [ ] **Step 5: Ensure player chips sit above the score overlay without stealing taps outside chips**

Replace:

```css
.court-players {
  pointer-events: none;
}
```

with:

```css
.court-players {
  z-index: 2;
  pointer-events: none;
}
```

- [ ] **Step 6: Replace the wide court media cleanup block**

In the later `@media (min-width: 960px)` block, delete:

```css
  .team-score {
    min-height: 190px;
  }

  .score-value {
    font-size: clamp(6rem, 12vw, 12rem);
  }
```

Keep:

```css
  .court {
    width: 100%;
  }
```

- [ ] **Step 7: Run CSS reference scan**

Run:

```bash
rg "scoreboard|serve-summary|winner-banner|team-score|score-row|score-divider|score-value|team-label" src/styles.css src -n
```

Expected: no matches except `.controller-team-score` in `src/styles.css` and `src/pages/ControllerPage.tsx`.

- [ ] **Step 8: Run focused tests**

Run:

```bash
npm test -- src/components/CourtView.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit layout and style changes**

```bash
git add src/styles.css src/components/CourtView.tsx src/App.tsx src/App.test.tsx src/components/CourtView.test.tsx
git commit -m "style: expand court score display"
```

## Task 5: Full Verification

**Files:**
- No code changes unless verification exposes a defect.

- [ ] **Step 1: Run type check**

Run:

```bash
npm run lint
```

Expected: PASS with TypeScript reporting no errors.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS for all Vitest suites.

- [ ] **Step 3: Build production bundle**

Run:

```bash
npm run build
```

Expected: PASS with `tsc` and `vite build` completing successfully.

- [ ] **Step 4: Start the dev server for visual verification**

Run:

```bash
npm run dev -- --port 5173
```

Expected: Vite reports a local URL such as `http://localhost:5173/`.

- [ ] **Step 5: Browser-check the court display**

Open the local URL in the in-app browser. Verify:

- The match screen shows one large court display at the top.
- The only visible score overlay text is the two score numbers.
- Team A's score is centered in the left half and Team B's score is centered in the right half.
- Player chips remain readable above and below the score positions.
- Tapping each score half increments the correct score.
- The court stays full-width on a phone-sized viewport and wide viewport.

- [ ] **Step 6: Stop the dev server**

Stop the running Vite process with `Ctrl-C`.

- [ ] **Step 7: Commit any verification fixes**

If verification required changes, commit them:

```bash
git add src
git commit -m "fix: polish court score overlay"
```

If no changes were needed, do not create an empty commit.
