# Court Fullscreen Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fullscreen button for both Court display modes.

**Architecture:** Introduce a small shared wrapper component inside `src/components/CourtView.tsx` that owns the section ref, Fullscreen API calls, and `fullscreenchange` state sync. Both existing display modes render their current content inside this wrapper, keeping scoring and fighter logic unchanged.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, lucide-react, CSS Fullscreen pseudo-class.

---

### Task 1: Fullscreen Control

**Files:**
- Modify: `src/components/CourtView.test.tsx`
- Modify: `src/components/CourtView.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing test**

Add a test that installs a mock Fullscreen API, clicks `Enter fullscreen court view`, verifies the Court section requested fullscreen, then clicks `Exit fullscreen court view` and verifies `document.exitFullscreen` was called. Also render `displayMode="little-fighters"` and verify the same enter button is present.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/CourtView.test.tsx`

Expected: FAIL because the fullscreen button does not exist yet.

- [ ] **Step 3: Add the shared wrapper implementation**

In `CourtView.tsx`, import `Maximize2` and `Minimize2`, add a `CourtFullscreenSection` component, and render both display modes through it. The wrapper calls `sectionRef.current?.requestFullscreen()` when entering and `document.exitFullscreen()` when exiting.

- [ ] **Step 4: Add styles**

Add `.court-fullscreen-button` styles near the Court styles and `:fullscreen` rules for `.court-section` and its court children.

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm test -- src/components/CourtView.test.tsx`

Expected: PASS.

### Task 2: Project Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run the required project checks**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22
npm test
npm run lint
npm run build
node --check public/sw.js
```

Expected: all commands exit 0.
