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

A camera-based pose detection input connector that lets players score points and undo using arm gestures — no touching the phone, no physical remote needed.

## Constraints

- Phone on a stand at the side of the court, camera angled to see both players.
- Works in a browser PWA (no native app dependency).
- Runs on-device only — no cloud inference, no internet required.
- Must not interfere with play (gestures performed between rallies).
- Must integrate with the existing `AppCommand` dispatch bus; zero changes to the scoring engine.

## Non-Goals

- Hand tracking or fine finger gestures.
- Player identification (which person did the gesture).
- Match setup or configuration via gestures.
- Offline model training or custom pose models.
- Gesture-based serve selection or mode switching beyond point/undo.

## Acceptance Criteria

- Extending an arm out horizontally (either arm) triggers a point command. The team is determined by the wrist's spatial position relative to body center in the camera frame. From behind the court, the player's left arm appears on the right of the image and maps to Team A; the player's right arm appears on the left and maps to Team B.
- Raising both arms vertically triggers `UNDO`.
- A 2-second cooldown prevents rapid repeated commands after any gesture is recognized.
- First gesture wins — if both players gesture simultaneously, only one command fires.
- The camera is OFF by default; a toggle button activates it.
- When active, a 160x120px PiP camera preview shows the camera feed with a skeleton wireframe overlay.
- A debug modal (expandable via button next to toggle) shows a 320x240 camera feed with skeleton, raw landmark values, arm classifications, and detection state.
- A fixed status bar at the top of the screen shows the current command being tracked and a frame progress bar. Only visible during active debounce.
- Visual feedback (green flash on toggle indicator) confirms gesture recognition.
- Camera pauses when the page is backgrounded (Page Visibility API).
- `npm test && npm run lint && npm run build` all pass with no regressions.
- Existing input methods (touch, BLE, keyboard, gamepad, Firestore remotes) continue to work unchanged.

## Approach

### Input Connector (`src/input/poseRemote.ts`)

Provides `createPoseInterpreter({ dispatch, now? })` returning `{ processLandmarks, reset, destroy }`. Internally it:

1. Receives pose landmark frames from `usePoseDetection`.
2. Classifies each detected person's arms per frame using `classifyArm`, `classifyBothArms`, and `detectGesture`.
3. Applies debounce (gesture must persist 10 consecutive frames, ~660ms at 15fps).
4. Applies cooldown (2s after any dispatch).
5. Dispatches `AppCommand` via the provided `dispatch` callback.

### Pose Detection (`src/hooks/usePoseDetection.ts`)

React hook wrapping `@mediapipe/tasks-vision` PoseLandmarker:

- Lazy-loads the WASM + model blob on first activation only (~2MB).
- Uses front-facing camera (`facingMode: 'user'`).
- Runs at 15fps (every 4th camera frame on a 60fps feed).
- Returns `{ isSupported, isActive, error, stream, start, stop }`.
- Manages camera lifecycle: `start()` / `stop()`.
- Handles `getUserMedia` permission flow.
- Creates video element and appends to a provided container for PiP display.
- Creates canvas overlay on PiP video with skeleton wireframe drawing.
- Exports `drawSkeleton()` for drawing pose landmarks on canvas.
- Page Visibility API pauses/resumes detection loop.

### UI Component (`src/components/PoseCamera.tsx`)

- Activation toggle: camera icon button (`Camera`/`CameraOff` from lucide-react) near court controls.
- PiP preview: 160x120px video element with canvas skeleton wireframe overlay.
- Expand button (`Maximize2`) opens debug modal when camera is active.
- Debug modal: 320x240 camera feed with skeleton overlay, plus diagnostic info:
  - Detection: gesture, frames (X / 10), cooldown timer, last command
  - Classification: left/right arm state, body center X, shoulder-hip DY
  - Raw landmarks: wrist, elbow, shoulder (x,y) and visibility for each arm
- Status bar: fixed at top of screen, shows "→ teamA"/"→ teamB"/"→ undo" with green progress bar filling as frames accumulate. Only visible when a gesture is actively being tracked (frames > 0).
- Visual feedback: green flash on toggle indicator when command dispatched.
- Props: `onCommand` callback wired to `dispatch` in App.tsx.

### Gesture Classification

Per detected person, per frame, classify each arm independently:

| Classification | Condition |
|---|---|
| `horizontal_out` | wrist Y within ±15% (shoulder-to-hip height) of shoulder Y, AND arm is extended (wrist farther from shoulder than elbow) |
| `vertical_up` | wrist Y at least 20% (shoulder-to-hip height) above shoulder Y, AND wrist X within ±25% (shoulder-to-hip height) of shoulder X |
| `neutral` | neither condition met |

The `horizontal_out` classification uses a direction-agnostic extension check: `Math.hypot(wrist.x - shoulder.x, wrist.y - shoulder.y) > Math.hypot(elbow.x - shoulder.x, elbow.y - shoulder.y)`. This works regardless of camera orientation.

Gesture fires when, for 10 consecutive frames:

| Gesture | Condition | Command |
|---|---|---|
| Point Team A | one arm = `horizontal_out`, other != `horizontal_out`, AND horizontal wrist X > bodyCenterX | `POINT_TEAM teamA` |
| Point Team B | one arm = `horizontal_out`, other != `horizontal_out`, AND horizontal wrist X < bodyCenterX | `POINT_TEAM teamB` |
| Undo | both arms = `vertical_up` | `UNDO` |

Team assignment uses spatial position (wrist X relative to body center) rather than MediaPipe's left/right labels. This is necessary because the camera is behind the player — the player's physical left arm appears on the right side of the camera image.

**Debounce:** 10 consecutive matching frames (~660ms at 15fps). Prevents transient arm movements during play from triggering false positives.

**Cooldown:** After any command dispatch, all gesture recognition is suppressed for 2 seconds.

**Conflict resolution:** Process detected persons left-to-right in frame. First person with a valid gesture fires the command; subsequent persons in the same frame are ignored.

### Integration

In `App.tsx`, `<PoseCamera onCommand={dispatch} />` is rendered between `<CourtView>` and `<Controls>` inside `app-layout`. The `dispatch` function is the same one used by all other input connectors.

## What Changes

| File | Change |
|---|---|
| `src/input/poseRemote.ts` | **New.** `createPoseInterpreter()`, `classifyArm`, `classifyBothArms`, `detectGesture` — gesture detection pipeline. |
| `src/input/poseRemote.test.ts` | **New.** 26 unit tests for arm classification, gesture detection, interpreter state machine. |
| `src/hooks/usePoseDetection.ts` | **New.** React hook for MediaPipe PoseLandmarker lifecycle, camera management, skeleton drawing. |
| `src/hooks/usePoseDetection.test.ts` | **New.** 8 tests for hook lifecycle, start/stop, error handling. |
| `src/components/PoseCamera.tsx` | **New.** Toggle, PiP with skeleton, debug modal, status bar, flash feedback. |
| `src/components/PoseCamera.test.tsx` | **New.** 5 tests for toggle, start/stop, error display, support detection. |
| `src/App.tsx` | Wire `<PoseCamera onCommand={dispatch} />` between CourtView and Controls. |
| `src/styles.css` | Styles for PiP, skeleton canvas, debug modal, status bar, toggle, feedback flash. |
| `package.json` | Add `@mediapipe/tasks-vision` dependency. |
| `.docs/input/input-remotes.md` | Document pose remote as a new input method. |
| `.specs/SPEC-INDEX.md` | Add this spec. |

## What Stays the Same

- `src/domain/matchEngine.ts` — no changes (scoring engine is input-agnostic).
- `src/input/commands.ts` — no changes (`AppCommand` union already covers all gesture outputs).
- `src/input/gestureInterpreter.ts` — not used (pose gestures are continuous, not click-based).
- All other input connectors (BLE, keyboard, gamepad, Firestore) — untouched.
- `src/components/Controls.tsx` — undo button stays; pose undo is additive.
- `src/components/CourtView.tsx` — score buttons stay; pose scoring is additive.

## Architecture Impact

`.docs/input/input-remotes.md` — added "Pose Remote (Camera Gestures)" section describing the MediaPipe pipeline, gesture mapping, camera lifecycle, and privacy considerations.

## Design Decisions During Implementation

| Decision | Rationale |
|---|---|
| Simplified arm classification (direction-agnostic extension check) | Original bodyCenterX-based direction check failed when camera is behind the player — the player's left arm appears on the right side of the image. The extension-distance approach works regardless of camera orientation. |
| Spatial position for team assignment (wrist X vs bodyCenterX) | More robust than relying on MediaPipe's left/right labels, which are inverted when the camera is behind the player. |
| Front-facing camera (`facingMode: 'user'`) | Originally planned `environment`, but front camera provides more intuitive mirroring for the user. |
| 10-frame debounce (was 5) | Longer hold required — ~660ms at 15fps vs ~333ms. Reduces accidental triggers during play. |
| Status bar on main screen | Provides at-a-glance feedback without opening the debug modal. Only visible during active debounce to avoid distraction. |
| Debug modal with raw landmark values | Essential for diagnosing classification issues — shows wrist/elbow/shoulder coordinates, body center, shoulder-hip DY, and visibility per arm. |

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Voice commands (Web Speech API) | Ambient noise in a gym; requires language-specific recognition; privacy concern with always-on mic; less reliable than pose for "us vs them" distinction. |
| Sound/audio patterns (clapping) | Gym has ambient noise (shuttlecock hits, other courts). False positive rate too high without ML audio classification. |
| Head tilt only | Less natural during play; head movements happen during rallies (looking at shuttlecock); harder to differentiate from play movement. |
| Cloud-based video classification | Requires internet; adds latency; overengineered for 3 gestures. |
| Teachable Machine custom model | Requires training data collection; custom model maintenance burden; MediaPipe Pose is mature and already handles the landmark extraction we need. |

## Testing Strategy

- **Unit tests (`poseRemote.test.ts`):** Arm classification logic with mock landmark arrays. Verify correct classification for `horizontal_out`, `vertical_up`, `neutral`. 10-frame debounce persistence. 2s cooldown suppression. First-person-wins conflict resolution. Spatial position team assignment.
- **Hook tests (`usePoseDetection.test.ts`):** Mock `getUserMedia` and MediaPipe APIs. Verify lazy loading, start/stop lifecycle, error handling, re-entrant start guard.
- **Component tests (`PoseCamera.test.tsx`):** Mock `usePoseDetection`. Verify toggle renders, start/stop callbacks, error display, unsupported browser bailout.
- **Integration:** Full test suite (`npm test`) — 441 tests across 46 files, zero regressions.
- **Manual:** Open scorer on phone, toggle camera, open debug modal, perform gestures, verify landmark values and team assignment.

## Verification

1. `npm test` — 441 tests pass.
2. `npm run lint` — no TypeScript errors.
3. `npm run build` — builds successfully with @mediapipe/tasks-vision.
4. Manual E2E: start match on phone, toggle camera, perform each gesture, confirm scoreboard updates correctly via debug modal.

## Performance Impact

- **Model load:** ~2MB WASM + model, lazy-loaded on first activation only. Not loaded if camera is never toggled.
- **Runtime:** ~15fps pose detection at reduced resolution. Measured ~10-15% CPU on mid-range Android devices for MediaPipe Pose.
- **Memory:** ~50-100MB additional while camera active (typical for MediaPipe).
- **Battery:** Camera + CPU for inference — noticeable drain during active use (similar to video call). Camera auto-pauses when tab is backgrounded.
- **Inactive:** Zero cost when toggle is off (no camera, no model loaded).

## Security Considerations

- `getUserMedia` requires explicit user permission per browser policy. No always-on camera.
- Camera feed never leaves the device — all processing is on-device via WASM.
- Camera is OFF by default; user must explicitly toggle it on.
- Page Visibility API pauses camera when tab is not visible.
- No video frames are stored, transmitted, or recorded.

## Risk Analysis

| Risk | Likelihood | Mitigation |
|---|---|---|
| False positive during rally | Low | 10-frame debounce (~660ms) + 2s cooldown; arm-extension gesture is unlikely to occur naturally during play |
| Poor detection at distance | Medium | Accept reduced accuracy at >5m; debug modal with raw values lets user adjust phone position and verify classification |
| Low light on indoor courts | Low | Badminton courts are typically well-lit; MediaPipe handles moderate lighting variation |
| MediaPipe model load fails (slow network) | Low | Model loaded lazily; camera toggle shows loading state; non-blocking to rest of app |
| Camera permission denied | Medium | Graceful handling — toggle shows error state with messaging; all other input methods remain available |
| Browser doesn't support getUserMedia or WASM | Low | Feature detection before showing toggle; unsupported browsers hide the option entirely |
| Left/right confusion due to camera position | Medium | Spatial position (wrist X vs bodyCenterX) used instead of MediaPipe left/right labels; debug modal shows raw values for adjustment |

## Affected Components

- `src/input/poseRemote.ts` — new gesture detection pipeline
- `src/input/poseRemote.test.ts` — 26 unit tests
- `src/hooks/usePoseDetection.ts` — MediaPipe hook + skeleton drawing
- `src/hooks/usePoseDetection.test.ts` — 8 hook tests
- `src/components/PoseCamera.tsx` — toggle, PiP, debug modal, status bar
- `src/components/PoseCamera.test.tsx` — 5 component tests
- `src/App.tsx` — integration wiring
- `src/styles.css` — new styles

## Dependencies

- `@mediapipe/tasks-vision` (npm package) — provides PoseLandmarker API
- No server-side changes, no Firestore changes, no auth changes.

## Rollback & Deployment

- Standard Vite build + Firebase Hosting deploy.
- If issues arise: toggle defaults to OFF. No model loaded unless user activates. No runtime impact when inactive.
- Rollback: remove the `PoseCamera` component from App.tsx and the dependency from package.json. All other input methods are independent.

## Observability

- **Status bar:** on-screen command indicator + frame progress bar visible during active debounce without opening any menus.
- **Debug modal:** raw landmark values, arm classifications, and detection state for diagnosing gesture recognition issues.
- **PiP preview + skeleton:** user can visually verify camera feed and skeleton overlay matches their pose.
- **Flash feedback:** green flash on toggle indicator when gesture command is dispatched.
