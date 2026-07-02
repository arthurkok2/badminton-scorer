---
title: Camera-Based Handsfree Scoring
author: arthur.kok
date: 2026-07-01
status: implemented
tags: [input, camera, handsfree]
domain: input
---

# Camera-Based Handsfree Scoring

## Problem

Players on court cannot touch the phone (on a stand at the side of the court) to score points or undo. Existing hardware remotes (BLE button, keyboard, gamepad) still require a physical device in hand. There is no handsfree input method for players holding a racket during play.

## Goal

A camera-based gesture recognition input connector that lets players score points and undo using hand gestures — no touching the phone, no physical remote needed.

## Constraints

- Phone on a stand at the side of the court, camera angled to see both players.
- Works in a browser PWA (no native app dependency).
- Runs on-device only — no cloud inference, no internet required.
- Must not interfere with play (gestures performed between rallies).
- Must integrate with the existing `AppCommand` dispatch bus; zero changes to the scoring engine.

## Non-Goals

- Finger-level gesture distinction beyond canned MediaPipe gestures.
- Player identification (which person did the gesture).
- Match setup or configuration via gestures.
- Custom gesture model training.
- Gesture-based serve selection or mode switching beyond point/undo.

## Acceptance Criteria

- Showing an open palm with the left hand triggers `POINT_TEAM teamA`.
- Showing an open palm with the right hand triggers `POINT_TEAM teamB`.
- Showing open palms with both hands triggers `UNDO`.
- After a command dispatches, the gesture must be fully dropped (hands removed from frame) before a new gesture can accumulate. Holding a gesture does not produce repeated commands.
- A 2-second cooldown prevents rapid repeated commands after any gesture is dropped.
- The camera is OFF by default; a toggle button activates it.
- When active, a 160x120px PiP camera preview shows the camera feed with a hand skeleton wireframe overlay.
- A debug modal shows a 320x240 camera feed with skeleton, per-hand gesture classifications with detection and handedness confidence scores, and cooldown/frame state.
- A fixed status bar at the top of the screen shows the current command being tracked and a frame progress bar. Only visible during active debounce.
- Visual feedback (green flash on toggle indicator) confirms gesture recognition.
- Camera pauses when the page is backgrounded (Page Visibility API).
- `npm test && npm run lint && npm run build` all pass with no regressions.
- Existing input methods (touch, BLE, keyboard, gamepad, Firestore remotes) continue to work unchanged.

## Approach

### Gesture Recognition (`src/hooks/usePoseDetection.ts`)

React hook wrapping `@mediapipe/tasks-vision` GestureRecognizer:

- Lazy-loads the WASM + model on first activation only.
- Front-facing camera (`facingMode: 'user'`), 640x480 resolution.
- CPU delegate for mobile/tablet reliability.
- Detection at ~15fps (every 4th rAF frame at 60fps).
- Detection thresholds: `minHandDetectionConfidence: 0.3`, `minHandPresenceConfidence: 0.3`, `minTrackingConfidence: 0.3`.
- Returns `{ isSupported, isActive, error, stream, start, stop }`.
- Fires `onResult` callback every detection frame — even when no hands are detected (prevents stale state).
- Creates video element appended to a container div for PiP display.
- Creates canvas overlay on PiP video with 21-point hand skeleton wireframe drawing.
- Exports `drawSkeleton()` for drawing hand landmarks on canvas using standard MediaPipe hand connections.
- Page Visibility API pauses/resumes detection loop.

### Gesture Model

Uses MediaPipe GestureRecognizer with the `gesture_recognizer.task` model bundle:

- **Model input:** 192x192 or 224x224
- **Canned gestures:** `None`, `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Down`, `Thumb_Up`, `Victory`, `ILoveYou`
- **Output:** per-hand gesture categories with confidence scores, handedness (`Left`/`Right`) with confidence, and 21 hand landmarks

The `DetectionResult` interface normalizes the GestureRecognizer output:
```typescript
interface DetectionResult {
  gestures: { categoryName: string; score: number }[][];
  handedness: { categoryName: string; score: number }[][];
  handLandmarks: NormalizedLandmark[][];
}
```

### Gesture Interpreter (`src/input/poseRemote.ts`)

Provides `createPoseInterpreter({ dispatch, now? })` returning `{ processResult, reset, destroy }`. Internally:

1. Receives `DetectionResult` frames from `usePoseDetection`.
2. Calls `detectGesture(result)` which maps gesture categories to commands:
   - One hand `Open_Palm` with score ≥ 0.5 → `teamA` (Left hand) or `teamB` (Right hand)
   - Both hands `Open_Palm` with score ≥ 0.5 → `undo`
   - Otherwise → `null`
3. Applies 10-frame debounce (~660ms at 15fps).
4. On dispatch: sets `mustDrop = true`. All subsequent non-null gestures are ignored until a frame with no gesture is processed (forces the user to drop their hand between commands).
5. On gesture drop (trackedGesture goes from non-null to null): starts a 2-second cooldown (prevents rapid re-triggering).
6. 2-second cooldown also applies after any dispatch.
7. `reset()` clears all internal state including `mustDrop`.

### UI Component (`src/components/PoseCamera.tsx`)

- Activation toggle: camera icon button (`Camera`/`CameraOff` from lucide-react) near court controls.
- PiP preview: 160x120px video element with canvas hand skeleton wireframe overlay.
- Expand button (`Maximize2`) opens debug modal when camera is active.
- Debug modal shows:
  - **Detection:** gesture (teamA/teamB/undo), frames (X / 10), cooldown timer, last command
  - **Gestures:** per-hand gesture name + detection confidence + handedness + presence confidence (e.g., `Open_Palm (0.85) Left (0.98)`)
- Status bar: fixed at top of screen, shows "→ teamA"/"→ teamB"/"→ undo" with green progress bar. Only visible when a gesture is actively being tracked (frames > 0). Suppressed after dispatch until gesture is fully dropped (`justFired` flag).
- Status bar has its own polling interval (always runs when camera active, independent of debug modal).
- Visual feedback: green flash on toggle indicator when command dispatched.
- Props: `onCommand` callback wired to `dispatch` in App.tsx.

### Gesture State Machine

```
IDLE → (gesture detected, score ≥ 0.5) → TRACKING [frames: 1..9]
TRACKING → (gesture continues) → TRACKING [frames++]
TRACKING → (gesture drops) → COOLDOWN (2s)
TRACKING → (frames = 10) → DISPATCH → MUST_DROP
MUST_DROP → (gesture continues) → MUST_DROP (blocked)
MUST_DROP → (no gesture) → COOLDOWN (2s)
COOLDOWN → (timer expires) → IDLE
```

### Integration

In `App.tsx`, `<PoseCamera onCommand={dispatch} />` is rendered between `<CourtView>` and `<Controls>` inside `app-layout`. The `dispatch` function is the same one used by all other input connectors.

## What Changes

| File | Change |
|---|---|
| `src/input/poseRemote.ts` | **New.** `createPoseInterpreter()`, `detectGesture` — gesture state machine with debounce, cooldown, mustDrop. |
| `src/input/poseRemote.test.ts` | **New.** 10 unit tests for gesture detection, debounce, cooldown, drop behavior, confidence thresholding. |
| `src/hooks/usePoseDetection.ts` | **New.** React hook for GestureRecognizer lifecycle, camera management, hand skeleton drawing. |
| `src/hooks/usePoseDetection.test.ts` | **New.** 8 tests for hook lifecycle, start/stop, error handling. |
| `src/components/PoseCamera.tsx` | **New.** Toggle, PiP with hand skeleton, debug modal with gesture+handedness confidence, status bar, flash feedback, justFired display suppression. |
| `src/components/PoseCamera.test.tsx` | **New.** 5 tests for toggle, start/stop, error display, support detection. |
| `src/App.tsx` | Wire `<PoseCamera onCommand={dispatch} />` between CourtView and Controls. |
| `src/styles.css` | Styles for PiP, skeleton canvas, debug modal, status bar, toggle, feedback flash. |
| `package.json` | Add `@mediapipe/tasks-vision` dependency. |
| `.docs/input/input-remotes.md` | Document gesture remote as a new input method. |
| `.specs/SPEC-INDEX.md` | Add this spec. |

## What Stays the Same

- `src/domain/matchEngine.ts` — no changes (scoring engine is input-agnostic).
- `src/input/commands.ts` — no changes (`AppCommand` union already covers all gesture outputs).
- `src/input/gestureInterpreter.ts` — not used.
- All other input connectors (BLE, keyboard, gamepad, Firestore) — untouched.
- `src/components/Controls.tsx` — undo button stays; gesture undo is additive.
- `src/components/CourtView.tsx` — score buttons stay; gesture scoring is additive.

## Design Decisions During Implementation

| Decision | Rationale |
|---|---|
| GestureRecognizer over PoseLandmarker | Built-in ML gesture classification (`Open_Palm`) is more reliable than custom arm geometry heuristics. Handedness from the model eliminates left/right confusion. |
| `mustDrop` flag forcing gesture release between commands | Without this, holding an open palm continuously would fire repeated commands every 10 frames. |
| Cooldown on gesture drop (not just dispatch) | Prevents frame-count stacking across multiple brief gestures. A full 2s cooldown starts whenever the hand leaves the frame. |
| `onResult` always called (even with no hands) | Prevents frozen status bar when hands leave frame — the debug state and UI always know when detection has stopped. |
| `justFired` flag in debug display | Suppresses gesture display after dispatch until a null frame passes, preventing confusing "teamB still showing" during transition. |
| Separate polling intervals for status bar vs debug | Status bar always polls when camera active; debug only polls when modal open. Avoids coupling. |
| Front-facing camera | Mirrored image is more intuitive for users (left is left). |
| CPU delegate over GPU | More reliable on mobile/tablet — GPU WebGL support varies across devices. |
| Low detection thresholds (0.3) | Needed for reliable detection at court distance where hands appear small. Gesture confidence threshold (0.5) prevents false positives from low-quality detections. |
| 10-frame debounce at ~15fps (~660ms hold) | Long enough to prevent accidental triggers during play, short enough to feel responsive. |
| Hand skeleton wireframe | 21 landmarks per hand with standard MediaPipe connections (thumb, fingers, palm). Drawn without visibility filtering for more reliable display. |

## Architecture Impact

`.docs/input/input-remotes.md` — added "Gesture Remote (Camera)" section describing the MediaPipe GestureRecognizer pipeline, gesture mapping, handedness, and camera lifecycle.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| PoseLandmarker with custom arm geometry | Initial implementation. Arm classification was unreliable at distance and confused by camera position (left/right inversion). |
| Voice commands (Web Speech API) | Ambient noise in a gym; language-specific; privacy concerns. |
| Sound/audio patterns (clapping) | Gym ambient noise causes false positives. |
| Cloud-based video classification | Requires internet; adds latency; overengineered. |

## Testing Strategy

- **Unit tests (`poseRemote.test.ts`):** 10 tests covering gesture-to-command mapping for left/right/both Open_Palm, 10-frame debounce, 2s cooldown, mustDrop flag requiring gesture release between dispatches, cooldown on gesture drop, low confidence rejection (< 0.5), non-Open_Palm rejection, reset, and destroy.
- **Hook tests (`usePoseDetection.test.ts`):** 8 tests mocking getUserMedia and GestureRecognizer. Verify support detection, start/stop lifecycle, error handling, re-entrant start guard.
- **Component tests (`PoseCamera.test.tsx`):** 5 tests mocking usePoseDetection. Verify toggle renders, start/stop callbacks, error display, unsupported browser bailout.
- **Integration:** Full test suite (`npm test`) — 425 tests across 46 files, zero regressions.

## Verification

1. `npm test` — 425 tests pass.
2. `npm run lint` — no TypeScript errors.
3. `npm run build` — builds successfully with @mediapipe/tasks-vision.
4. Manual E2E: start match on phone, toggle camera, open debug modal, show open palms, verify gesture classification and team assignment.

## Performance Impact

- **Model load:** ~2MB WASM + gesture_recognizer.task, lazy-loaded on first activation only.
- **Runtime:** ~15fps gesture recognition at 640x480. GestureRecognizer runs palm detection + hand landmarks + gesture classification (~16ms CPU latency on Pixel 6).
- **Memory:** ~50-100MB additional while camera active.
- **Battery:** Camera + inference drain during active use. Auto-pauses when tab is backgrounded.
- **Inactive:** Zero cost when toggle is off.

## Security Considerations

- `getUserMedia` requires explicit user permission. No always-on camera.
- All processing on-device via WASM. No cloud.
- Camera OFF by default.
- Page Visibility API pauses camera when tab is not visible.
- No video frames stored, transmitted, or recorded.

## Risk Analysis

| Risk | Likelihood | Mitigation |
|---|---|---|
| False positive during rally | Low | 10-frame debounce + mustDrop + 2s cooldown on drop |
| Poor detection at distance | Medium | Low detection thresholds (0.3); debug modal shows confidence scores for diagnostics |
| Low light on indoor courts | Low | Badminton courts are well-lit; MediaPipe handles moderate variation |
| Model load fails (slow network) | Low | Lazy-loaded; non-blocking |
| Camera permission denied | Medium | Error state with messaging; all other inputs remain available |
| Browser doesn't support getUserMedia or WASM | Low | Feature detection hides toggle |
| Handedness confusion | Low | GestureRecognizer provides handedness directly; debug shows confidence |

## Affected Components

- `src/input/poseRemote.ts` — gesture interpreter state machine
- `src/input/poseRemote.test.ts` — 10 unit tests
- `src/hooks/usePoseDetection.ts` — GestureRecognizer hook + hand skeleton drawing
- `src/hooks/usePoseDetection.test.ts` — 8 hook tests
- `src/components/PoseCamera.tsx` — toggle, PiP, debug modal, status bar
- `src/components/PoseCamera.test.tsx` — 5 component tests
- `src/App.tsx` — integration wiring
- `src/styles.css` — new styles

## Dependencies

- `@mediapipe/tasks-vision` (npm package) — provides GestureRecognizer API
- `gesture_recognizer.task` model (loaded from Google CDN at runtime)
- No server-side changes, no Firestore changes, no auth changes.

## Rollback & Deployment

- Standard Vite build + Firebase Hosting deploy.
- Toggle defaults to OFF. No model loaded unless user activates.
- Rollback: remove PoseCamera from App.tsx and dependency from package.json. All other inputs independent.

## Observability

- **Status bar:** on-screen command + frame progress bar during active debounce. Suppressed after dispatch until drop.
- **Debug modal:** per-hand gesture name + detection confidence + handedness + presence confidence. Cooldown and frame state.
- **PiP + hand skeleton:** visual verification of camera feed and hand landmark detection.
- **Flash feedback:** green flash on toggle when command dispatched.
