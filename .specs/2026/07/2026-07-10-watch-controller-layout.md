---
title: Watch Controller Layout for Galaxy Watch 8
author: arthur.kok
date: 2026-07-10
status: implemented
tags: [ui, remote, watch]
domain: ui
---

# Watch Controller Layout for Galaxy Watch 8

## Problem

The current `/controller` page renders a desktop/phone card layout — scores side-by-side, a 2x2 command grid, header bar, settings modals. On a Galaxy Watch 8 (~480×480 circular display) in Samsung Internet Browser, this layout is cramped, corners get clipped by the circular bezel, and touch targets are too small for on-court use by a player holding a racket.

## Goal

Adapt the controller page to render a watch-optimized layout when a narrow, near-square viewport is detected (matching the Galaxy Watch 8 form factor). The watch layout uses a circular safe area, large touch targets, and a simplified vertical flow limited to the must-have controls: room code join, score display, Point A/B buttons, and undo.

## Constraints

- Same `/controller` route — no new URL. Auto-detection via viewport media query.
- Same `useControllerClient` hook and Firestore service layer — no data changes.
- No user agent sniffing.
- Existing phone/desktop controller layout must remain untouched.
- Galaxy Watch 8 runs Samsung Internet Browser (Chromium-based). No Wear OS native SDK involved.
- Player uses the watch one-handed on court between rallies.

## Non-Goals

- Announce button, leave button, settings modals, winner banner — hidden on watch branch.
- Radial/arc-shaped buttons or SVG-based layout (approach C, rejected for complexity).
- Back link to scorer — watch browser's back gesture handles navigation.
- Support for rectangular smartwatches (Apple Watch, etc.) — circular only.

## Acceptance Criteria

1. Opening `/controller` on a viewport ≤400px wide and ≤420px tall renders the watch layout.
2. Opening `/controller` on any larger viewport renders the existing controller layout unchanged.
3. Watch join state: centered room code input + Join button, no back link.
4. Watch active state: team names + serving dot (top bar), scores centered below, two large Point buttons side-by-side, smaller Undo button at bottom center.
5. All content stays within a circular safe area — no content clipped by the watch bezel.
6. Touch targets (point buttons) are ≥56px tall.
7. Existing controller tests continue to pass.
8. New tests cover watch detection and watch JSX rendering.

## Alternatives Considered

| Approach | Verdict | Rationale |
|----------|---------|-----------|
| A: CSS-only media query adaptation | Rejected | Still looks like a shrunken phone page; no layout restructuring possible in pure CSS without changing the DOM |
| B: Conditional watch JSX branch (chosen) | Accepted | Best balance of UX improvement and implementation effort; same data layer, no new route |
| C: Radial watch face with arc buttons | Rejected | Beautiful but overengineered for a web browser; fragile CSS; hard to test without a physical device |

## Approach

### Watch Detection

New hook `useWatchLayout()` in `src/hooks/useWatchLayout.ts`:

```ts
export function useWatchLayout(): boolean {
  const [isWatch, setIsWatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 480px) and (max-height: 480px)');
    setIsWatch(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsWatch(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isWatch;
}
```

Uses `(max-width: 480px) and (max-height: 480px)` as the heuristic. Galaxy Watch 8 physical resolution is ~480×480 but Samsung Internet viewport is typically 360–396px after browser chrome. The 420px height cap avoids matching phones in landscape.

### JSX Branching in ControllerPage

`ControllerPage.tsx` calls `useWatchLayout()`. When `isWatch` is true and `status` is `disconnected`/`joining`, it renders the watch join layout. When `isWatch` is true and `status` is `active`, it renders the watch active layout. Otherwise, existing layout renders exactly as before.

No controller logic changes — `join()`, `sendCommand()`, `leave()` all work identically.

### Watch Join Layout

```
┌──────────────────┐
│                  │
│   ENTER CODE     │
│  [   ABCD   ]    │  centered input, large font (1.4rem, letter-spacing 0.15em)
│  [   Join   ]    │  full-width button, 56px min-height
│                  │
└──────────────────┘
```

- No `.controller-back-link` — browser back gesture suffices.
- Input auto-capitalizes, same trimming logic as existing join form.

### Watch Active Layout

```
┌──────────────────────┐
│  TeamA  ●  :  TeamB  │  team names + serving dot
│   Serving: Player 1  │  serving player name in green
│                      │
│      21  :  18      │  scores centered
│                      │
│  ┌────────┬────────┐  │
│  │ ● P2   │   P3   │  │  ← vertical net divider
│  │        │        │  │  ← left half = Team A, right half = Team B
│  │   P1   │   P4   │  │  ← players stacked per courtPositions
│  └────────┴────────┘  │     ● = green dot on serving player
│                      │
│       [ Undo ]       │
└──────────────────────┘
```

### Circular Safe Area

The watch container (`.watch-controller`) uses `padding: max(16px, 8vw)` and a large `border-radius: 24px` for subtle visual cue. A `max-width: 360px; margin: 0 auto` centers the layout. Content is naturally rectangular within the circular screen — no `clip-path` or SVG arcs. The safe area padding ensures no content touches the bezel edge.

### CSS Namespace

All watch styles use `.watch-controller`, `.watch-*` class names in a dedicated `/* ── Watch Controller ── */` section of `src/styles.css`. No `.controller-*` class overrides — zero risk of breaking the existing controller layout.

## What Changes

| File | Change |
|------|--------|
| `src/hooks/useWatchLayout.ts` | **New** — watch detection hook |
| `src/pages/ControllerPage.tsx` | **Modify** — add `useWatchLayout()` call and conditional JSX branches for watch join/active states |
| `src/styles.css` | **Modify** — append `/* ── Watch Controller ── */` CSS section with `.watch-*` classes |

## What Stays the Same

- `useControllerClient` hook — unchanged
- `firestoreControllerService.ts` — unchanged
- `firestoreRemoteTypes.ts` — unchanged
- `firestoreRemoteService.ts` — unchanged
- `useWatchRemoteHost.ts` — unchanged
- All existing `.controller-*` CSS classes — untouched
- Main scorer page (`/`) — no changes
- Firestore room protocol — no changes

## Architecture Impact

### Docs to update

| Doc | Change |
|-----|--------|
| `.docs/ui/ui-architecture.md` | Add watch layout branch to ControllerPage description |
| `.docs/input/input-remotes.md` | Mention watch browser support in remote controller section |

## Testing Strategy

### Unit tests

- **`src/hooks/useWatchLayout.test.ts`** — mock `window.matchMedia`; verify returns false for desktop viewport, true for watch viewport, responds to `change` events.
- **`src/pages/ControllerPage.test.tsx`** — add watch-specific tests: mock `useWatchLayout` to return true, verify watch JSX renders for disconnected/active states, verify point buttons render with team names, verify undo button present, verify back link not rendered.

### Integration

- Existing controller tests must pass unchanged (watch detection default = false).

### Manual

- Load `/controller` on Galaxy Watch 8 Samsung Internet Browser. Verify join flow, scoring, undo. Verify no content clipped.
- Load in Chrome DevTools device toolbar with 360×360 viewport.

## Verification

```bash
npm test
npm run lint
npm run build
```

## Performance Impact

Negligible. One media query listener per controller page load. No additional network requests, no extra Firestore listeners. Watch CSS is ~60 lines.

## Security Considerations

None. No new inputs, no new data flows. Room code input is the same component, same `join()` logic.

## Risk Analysis

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Media query false-positive on a small phone browser window | Low | 420px max-height is below most phone viewports even when resized |
| Samsung Internet viewport differs from expected 360-396px | Medium | Test on physical device; widen media query if needed (trivial CSS change) |
| Circular bezel clips text despite safe area padding | Low | Generous 8vw padding handles varying viewport sizes; test on device |

## Rollback & Deployment

Standard Vite build + Firebase Hosting deploy. No database migrations, no API changes. To roll back, revert the three changed files.

## Observability

- Watch layout usage detectable via analytics if added later (not in scope).
- Visual verification on physical device is the primary signal.

## Affected Components

- `ControllerPage` — new JSX branch
- `useWatchLayout` — new hook
- `styles.css` — new CSS section

## Dependencies

None. No new npm packages. No changes to other features or stories.

## Reviewer Context

The Galaxy Watch 8 has a ~480×480 circular AMOLED display. Samsung Internet Browser on Tizen/Wear OS renders web pages within a rectangular viewport inscribed in the circle — typical usable area is 360–396px. The browser supports standard CSS, media queries, and JavaScript. No Wear OS Web API extensions are available or needed.
