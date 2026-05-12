# Session Match Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict one-off match setup controls while a session match is being played, and allow returning to the suggestion screen before the first rally.

**Architecture:** Add explicit session-control props to `Controls` so `App` can choose which action groups render. Keep scoring, speech, undo, remote input, and match-over behavior unchanged.

**Tech Stack:** React 19, TypeScript, Testing Library, Vitest.

---

## File Structure

- Modify `src/components/Controls.tsx`: add optional props for hiding match setup controls and rendering session actions.
- Modify `src/components/Controls.test.tsx`: cover standalone control rendering in session mode.
- Modify `src/App.tsx`: pass session-specific props and return to the suggestion phase at pre-rally 0-0.
- Modify `src/App.test.tsx`: cover session match restrictions and return-to-suggestion behavior.
- Modify `docs/superpowers/specs/2026-05-11-session-scheduler-design.md`: document the behavior.

### Task 1: Controls Rendering Contract

**Files:**
- Modify: `src/components/Controls.tsx`
- Test: `src/components/Controls.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that render `Controls` with `showMatchSetupControls={false}`, `showNewMatchControl={false}`, `showSessionModeControl={false}`, `showBackToSessionSuggestion={true}`, and `onBackToSessionSuggestion`. Assert no player-name textboxes, no match mode group, no `New match`, no `Session mode`, and a working `Back to suggestion` button.

- [ ] **Step 2: Run the focused test**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/Controls.test.tsx`

Expected: FAIL because the new props do not exist and the session restrictions are not implemented.

- [ ] **Step 3: Implement minimal `Controls` props**

Add optional boolean props with default match-mode behavior:

```ts
showMatchSetupControls = true;
showNewMatchControl = true;
showSessionModeControl = true;
showBackToSessionSuggestion = false;
onBackToSessionSuggestion?: () => void;
onEndSession?: () => void;
```

Render the match mode toggle, player-name editor, first-server controls, `New match`, and `Session mode` only when their flags allow them. Render `Back to suggestion` and `End session` only when their handlers/flags indicate they should appear.

- [ ] **Step 4: Run the focused test**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/Controls.test.tsx`

Expected: PASS.

### Task 2: App Session Flow

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing app tests**

Add tests that start session mode, add four players, start the suggested match, and verify:

- player-name inputs are absent on the session scorer;
- singles/doubles controls are absent;
- `New match` and `Session mode` are absent;
- `Back to suggestion` returns to the match suggestion at 0-0;
- after scoring one rally, `Back to suggestion` is absent and `End session` remains present.

- [ ] **Step 2: Run the focused app test**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/App.test.tsx`

Expected: FAIL because `App` does not pass the new session restrictions yet.

- [ ] **Step 3: Wire session props in `App`**

Create a pre-rally boolean from the existing `hasStarted(match)` helper. In session playing mode, pass:

```tsx
showMatchSetupControls={appMode !== 'session'}
showNewMatchControl={appMode !== 'session'}
showSessionModeControl={appMode !== 'session'}
showBackToSessionSuggestion={appMode === 'session' && sessionPhase === 'playing' && !hasStarted(match)}
onBackToSessionSuggestion={() => setSessionPhase('suggestion')}
onEndSession={appMode === 'session' ? handleEndSession : undefined}
```

Keep `onPlayerNameChange` as a no-op in session mode as a defensive fallback.

- [ ] **Step 4: Run focused tests**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/App.test.tsx src/components/Controls.test.tsx`

Expected: PASS.

### Task 3: Full Verification

### Task 3: End Session Confirmation and Reset

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`
- Modify: `docs/superpowers/specs/2026-05-11-session-scheduler-design.md`

- [ ] **Step 1: Write failing app tests**

Add tests proving that clicking `End session` asks for confirmation, canceling leaves the user in the session match, and confirming clears the active session and resets the scorer to a fresh 0-0 match.

- [ ] **Step 2: Run the focused test**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/App.test.tsx -t "ending a session|confirms ending"`

Expected: FAIL until `handleEndSession` calls `window.confirm` and resets the live match.

- [ ] **Step 3: Implement confirmation and reset**

Update `handleEndSession` so it returns early when confirmation is cancelled. On confirm, archive and clear the session, clear persisted match state, clear current session play state, and reset `matchView` through the existing `RESET_MODE` path using saved preferences.

- [ ] **Step 4: Run the focused test**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/App.test.tsx -t "ending a session|confirms ending"`

Expected: PASS.

### Task 4: Full Verification

**Files:**
- No production edits unless focused verification exposes a defect.

- [ ] **Step 1: Run required project checks**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22
npm test
npm run lint
npm run build
node --check public/sw.js
```

Expected: all commands exit 0.
