---
title: Camera-Based Handsfree Scoring
author: arthur.kok
date: 2026-07-01
status: draft
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

- Performing the left-arm-out, right-arm-up gesture triggers `POINT_TEAM teamA`.
- Performing the right-arm-out, left-arm-up gesture triggers `POINT_TEAM teamB`.
- Performing the both-arms-up gesture triggers `UNDO`.
- A 2-second cooldown prevents rapid repeated commands after any gesture is recognized.
- First gesture wins — if both players gesture simultaneously, only one command fires.
- The camera is OFF by default; a toggle button activates it.
- When active, a small PiP camera preview shows the detected pose skeleton.
- Visual feedback (flash) confirms gesture recognition.
- Camera pauses when the page is backgrounded (Page Visibility API).
- `npm test && npm run lint && npm run build` all pass with no regressions.
- Existing input methods (touch, BLE, keyboard, gamepad, Firestore remotes) continue to work unchanged.

## Approach

### Input Connector (`src/input/poseRemote.ts`)

Follows the pattern of `keyboardRemote.ts`, `gamepadRemote.ts`, and `bluetoothRemote.ts`: exposes a `connectPoseRemote({ dispatch, onDiagnosticEvent })` function that returns `{ disconnect() }`. Internally it:

1. Receives pose landmark frames from `usePoseDetection`.
2. Classifies each detected person's arms per frame.
3. Applies debounce (gesture must persist 5 consecutive frames).
4. Applies cooldown (2s after any dispatch).
5. Dispatches `AppCommand` via the provided `dispatch` callback.

### Pose Detection (`src/hooks/usePoseDetection.ts`)

React hook wrapping `@mediapipe/tasks-vision` PoseLandmarker:

- Lazy-loads the WASM + model blob on first activation only (~2MB).
- Runs at 15fps (every 4th camera frame on a 60fps feed).
- Returns `landmarks[][]` per frame: array of detected persons, each with 33 landmarks.
- Manages camera lifecycle: `start()` / `stop()` / `isActive`.
- Handles `getUserMedia` permission flow.

### UI Component (`src/components/PoseCamera.tsx`)

- Activation toggle: camera icon button placed near the court controls.
- PiP preview: small (80x60px) video element with canvas overlay drawing skeleton wireframe.
- Visual feedback: green border flash on point gesture recognized, amber flash on undo.
- Props: `onCommand` callback wired to `dispatch` in App.tsx.

### Gesture Classification

Per detected person, per frame, classify each arm independently:

| Classification | Condition |
|---|---|
| `horizontal_out` | wrist Y within ±15% (shoulder-to-hip height) of shoulder Y, AND wrist X is outward from elbow X relative to body center |
| `vertical_up` | wrist Y at least 20% (shoulder-to-hip height) above shoulder Y, AND wrist X within ±25% (shoulder-to-hip height) of shoulder X |
| `neutral` | neither condition met |

Gesture fires when, for 5 consecutive frames:

| Gesture | Condition | Command |
|---|---|---|
| Point Team A | left arm = `horizontal_out` AND right arm = `vertical_up` | `POINT_TEAM teamA` |
| Point Team B | right arm = `horizontal_out` AND left arm = `vertical_up` | `POINT_TEAM teamB` |
| Undo | both arms = `vertical_up` | `UNDO` |

**Debounce:** 5 consecutive matching frames (~333ms at 15fps). Prevents transient arm movements during play from triggering false positives.

**Cooldown:** After any command dispatch, all gesture recognition is suppressed for 2 seconds. During cooldown, the PiP shows a countdown indicator.

**Conflict resolution:** Process detected persons left-to-right in frame. First person with a valid gesture fires the command; subsequent persons in the same frame are ignored.

### Integration

In `App.tsx`, `connectPoseRemote` is called when the pose camera is toggled on (similar to how `connectGamepadRemote` is always active on mount). The `dispatch` function is the same one used by all other input connectors.

```typescript
// In App.tsx, near other input connector setup
if (poseEnabled) {
  connectPoseRemote({ dispatch, onDiagnosticEvent });
}
```

The `PoseCamera` component renders inside `CourtView` or as a sibling, with its `onCommand` prop wired to `dispatch`.

## What Changes

| File | Change |
|---|---|
| `src/input/poseRemote.ts` | **New.** Gesture-to-command connector. `connectPoseRemote()`, arm classification, debounce, cooldown. |
| `src/hooks/usePoseDetection.ts` | **New.** React hook for MediaPipe PoseLandmarker lifecycle and camera management. |
| `src/components/PoseCamera.tsx` | **New.** PiP camera preview with skeleton overlay and activation toggle. |
| `src/App.tsx` | Wire `PoseCamera` into the court layout, connect `poseRemote` on toggle. |
| `src/styles.css` | Styles for PiP preview, skeleton canvas, toggle button, feedback flash. |
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

`.docs/input/input-remotes.md` — add a new section for "Pose Remote (Camera Gestures)" describing the MediaPipe pipeline, gesture mapping, and camera lifecycle. Update the input architecture diagram to include the camera path.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Voice commands (Web Speech API) | Ambient noise in a gym; requires language-specific recognition; privacy concern with always-on mic; less reliable than pose for "us vs them" distinction. |
| Sound/audio patterns (clapping) | Gym has ambient noise (shuttlecock hits, other courts). False positive rate too high without ML audio classification. |
| Head tilt only | Less natural during play; head movements happen during rallies (looking at shuttlecock); harder to differentiate from play movement. |
| Cloud-based video classification | Requires internet; adds latency; overengineered for 3 gestures. |
| Teachable Machine custom model | Requires training data collection; custom model maintenance burden; MediaPipe Pose is mature and already handles the landmark extraction we need. |

## Testing Strategy

- **Unit tests (`poseRemote.test.ts`):** Arm classification logic with mock landmark arrays. Verify correct classification for `horizontal_out`, `vertical_up`, `neutral`. Debounce logic (5-frame persistence). Cooldown timer (2s suppression). First-person-wins conflict resolution.
- **Hook tests (`usePoseDetection.test.ts`):** Mock `getUserMedia` and MediaPipe APIs. Verify lazy loading, start/stop lifecycle, landmark callback.
- **Component tests (`PoseCamera.test.tsx`):** Verify toggle renders/hides PiP preview. Verify flash feedback on command.
- **Integration:** Existing test suite must pass with zero regressions (`npm test`).
- **Manual:** Open scorer on phone, toggle camera on, perform gestures at court distance. Verify correct team assignment and undo.

## Verification

1. `npm test` — all existing tests pass, new tests pass.
2. `npm run lint` — no errors.
3. `npm run build` — builds successfully with new dependency.
4. Manual E2E: start match on phone, toggle camera, perform each gesture, confirm scoreboard updates correctly.

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
| False positive during rally | Medium | 5-frame debounce + 2s cooldown; asymmetric gesture is unlikely to occur naturally during play |
| Poor detection at distance | Medium | Accept reduced accuracy at >5m; PiP preview lets user adjust phone position |
| Low light on indoor courts | Low | Badminton courts are typically well-lit; MediaPipe handles moderate lighting variation |
| MediaPipe model load fails (slow network) | Low | Model loaded lazily; camera toggle shows loading state; non-blocking to rest of app |
| Camera permission denied | Medium | Graceful handling — toggle shows error state with messaging; all other input methods remain available |
| Browser doesn't support getUserMedia or WASM | Low | Feature detection before showing toggle; unsupported browsers hide the option entirely |

## Affected Components

- `src/input/poseRemote.ts` — new input connector
- `src/hooks/usePoseDetection.ts` — new MediaPipe hook
- `src/components/PoseCamera.tsx` — new UI component
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

- **Diagnostic events:** `onDiagnosticEvent` callback fires for each recognized gesture with `source: 'pose'`, gesture type, confidence scores.
- **PiP preview:** user can visually verify skeleton overlay matches their pose.
- **Flash feedback:** immediate visual confirmation when gesture is recognized.
