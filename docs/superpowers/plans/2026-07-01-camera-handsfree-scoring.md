# Camera-Based Handsfree Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add camera-based pose detection that lets players score points and undo using arm gestures — left-arm-out/right-arm-up for Team A, right-arm-out/left-arm-up for Team B, both-arms-up for undo.

**Architecture:** Three new files: `poseRemote.ts` (pure gesture-to-command state machine), `usePoseDetection.ts` (React hook wrapping MediaPipe PoseLandmarker + getUserMedia), `PoseCamera.tsx` (PiP camera preview with skeleton overlay and toggle). Wired into `App.tsx` via the existing `dispatch(command)` callback — zero changes to the scoring engine or command bus.

**Tech Stack:** `@mediapipe/tasks-vision` (PoseLandmarker, WASM, on-device), React 19, TypeScript, Vitest, existing AppCommand dispatch pattern.

---

### Task 1: Install dependency and scaffold files

**Files:**
- Modify: `package.json`
- Create: `src/input/poseRemote.ts`
- Create: `src/hooks/usePoseDetection.ts`
- Create: `src/components/PoseCamera.tsx`

- [ ] **Step 1: Add @mediapipe/tasks-vision dependency**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm install @mediapipe/tasks-vision`
Expected: package added to node_modules and package.json.

- [ ] **Step 2: Scaffold poseRemote.ts with empty exports**

```typescript
// src/input/poseRemote.ts
import type { AppCommand } from './commands';

export type ArmClassification = 'horizontal_out' | 'vertical_up' | 'neutral';

export type GestureType = 'teamA' | 'teamB' | 'undo';

export interface PoseInterpreterOptions {
  dispatch: (command: AppCommand) => void;
  now?: () => number;
}

export interface PoseInterpreter {
  processLandmarks(allPersonLandmarks: NormalizedLandmark[][]): void;
  reset(): void;
  destroy(): void;
}

// NormalizedLandmark matches MediaPipe's format
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export function createPoseInterpreter(_options: PoseInterpreterOptions): PoseInterpreter {
  return {
    processLandmarks: () => {},
    reset: () => {},
    destroy: () => {},
  };
}

export function classifyArm(
  _shoulder: Landmark,
  _elbow: Landmark,
  _wrist: Landmark,
  _hip: Landmark,
  _bodyCenterX: number,
  _isLeft: boolean,
): ArmClassification {
  return 'neutral';
}

export function classifyBothArms(
  landmarks: Landmark[],
): { left: ArmClassification; right: ArmClassification } {
  return { left: 'neutral', right: 'neutral' };
}

export function detectGesture(
  leftArm: ArmClassification,
  rightArm: ArmClassification,
): GestureType | null {
  return null;
}
```

- [ ] **Step 3: Scaffold usePoseDetection.ts with empty hook**

```typescript
// src/hooks/usePoseDetection.ts
export interface UsePoseDetectionResult {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function usePoseDetection(): UsePoseDetectionResult {
  return {
    isSupported: false,
    isActive: false,
    error: null,
    start: async () => {},
    stop: () => {},
  };
}
```

- [ ] **Step 4: Scaffold PoseCamera.tsx with empty component**

```typescript
// src/components/PoseCamera.tsx
import type { AppCommand } from '../input/commands';

interface PoseCameraProps {
  readonly onCommand: (command: AppCommand) => void;
}

export function PoseCamera(_props: PoseCameraProps) {
  return null;
}
```

- [ ] **Step 5: Verify build compiles with scaffolded files**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/input/poseRemote.ts src/hooks/usePoseDetection.ts src/components/PoseCamera.tsx
git commit -m "chore: scaffold pose remote files and add @mediapipe/tasks-vision"
```

---

### Task 2: poseRemote.ts — Arm classification (TDD)

**Files:**
- Create: `src/input/poseRemote.test.ts`
- Modify: `src/input/poseRemote.ts`

- [ ] **Step 1: Write tests for classifyArm**

```typescript
// src/input/poseRemote.test.ts
import { describe, it, expect } from 'vitest';
import { classifyArm } from './poseRemote';
import type { Landmark } from './poseRemote';

function lm(x: number, y: number): Landmark {
  return { x, y, z: 0, visibility: 1 };
}

// Landmark indices:
// 11: left shoulder, 13: left elbow, 15: left wrist, 23: left hip
// 12: right shoulder, 14: right elbow, 16: right wrist, 24: right hip

describe('classifyArm', () => {
  const hip = lm(0.5, 0.8);

  describe('horizontal_out', () => {
    it('classifies left arm extended leftward as horizontal_out', () => {
      const shoulder = lm(0.4, 0.5);
      const elbow = lm(0.3, 0.5);
      const wrist = lm(0.1, 0.5);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).toBe('horizontal_out');
    });

    it('classifies right arm extended rightward as horizontal_out', () => {
      const shoulder = lm(0.6, 0.5);
      const elbow = lm(0.7, 0.5);
      const wrist = lm(0.9, 0.5);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, false)).toBe('horizontal_out');
    });

    it('rejects when wrist Y is too far from shoulder Y', () => {
      const shoulder = lm(0.4, 0.5);
      const elbow = lm(0.3, 0.5);
      const wrist = lm(0.1, 0.65);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).not.toBe('horizontal_out');
    });

    it('rejects when wrist is not outward from elbow', () => {
      const shoulder = lm(0.4, 0.5);
      const elbow = lm(0.1, 0.5);
      const wrist = lm(0.3, 0.5);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).not.toBe('horizontal_out');
    });
  });

  describe('vertical_up', () => {
    it('classifies arm raised straight up as vertical_up', () => {
      const shoulder = lm(0.4, 0.5);
      const elbow = lm(0.4, 0.4);
      const wrist = lm(0.4, 0.2);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).toBe('vertical_up');
    });

    it('rejects when wrist is not above shoulder', () => {
      const shoulder = lm(0.4, 0.2);
      const elbow = lm(0.4, 0.3);
      const wrist = lm(0.4, 0.5);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).not.toBe('vertical_up');
    });

    it('rejects when wrist is too far horizontally from shoulder', () => {
      const shoulder = lm(0.4, 0.5);
      const elbow = lm(0.4, 0.4);
      const wrist = lm(0.7, 0.2);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).not.toBe('vertical_up');
    });
  });

  describe('neutral', () => {
    it('returns neutral for arm at rest', () => {
      const shoulder = lm(0.4, 0.5);
      const elbow = lm(0.4, 0.6);
      const wrist = lm(0.4, 0.7);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).toBe('neutral');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/input/poseRemote.test.ts`
Expected: All classifyArm tests FAIL (returns 'neutral' for everything).

- [ ] **Step 3: Implement classifyArm**

Replace the stub in `src/input/poseRemote.ts`:

```typescript
export function classifyArm(
  shoulder: Landmark,
  elbow: Landmark,
  wrist: Landmark,
  hip: Landmark,
  bodyCenterX: number,
  isLeft: boolean,
): ArmClassification {
  const shoulderHipDY = Math.abs(shoulder.y - hip.y);
  if (shoulderHipDY === 0) return 'neutral';

  // Check horizontal_out
  const yTolerance = shoulderHipDY * 0.15;
  const yOk = Math.abs(wrist.y - shoulder.y) < yTolerance;
  if (yOk) {
    const outwardOk = isLeft
      ? wrist.x < bodyCenterX && wrist.x < elbow.x
      : wrist.x > bodyCenterX && wrist.x > elbow.x;
    if (outwardOk) return 'horizontal_out';
  }

  // Check vertical_up
  const yAbove = shoulder.y - wrist.y;
  const yThreshold = shoulderHipDY * 0.20;
  const xThreshold = shoulderHipDY * 0.25;
  if (yAbove > yThreshold && Math.abs(wrist.x - shoulder.x) < xThreshold) {
    return 'vertical_up';
  }

  return 'neutral';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/input/poseRemote.test.ts`
Expected: All classifyArm tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/input/poseRemote.test.ts src/input/poseRemote.ts
git commit -m "test: add arm classification for pose detection"
```

---

### Task 3: poseRemote.ts — Gesture detection + debounce + cooldown (TDD)

**Files:**
- Modify: `src/input/poseRemote.test.ts`
- Modify: `src/input/poseRemote.ts`

- [ ] **Step 1: Write tests for detectGesture and classifyBothArms**

Add to `src/input/poseRemote.test.ts`:

```typescript
import { detectGesture, classifyBothArms } from './poseRemote';

// ... after existing tests

describe('classifyBothArms', () => {
  it('classifies both arms from full landmarks array', () => {
    const landmarks: Landmark[] = new Array(33).fill(null).map(() => lm(0.5, 0.5));
    // Left shoulder (11), elbow (13), wrist (15), hip (23)
    landmarks[11] = lm(0.3, 0.5);
    landmarks[13] = lm(0.15, 0.5);
    landmarks[15] = lm(0.05, 0.5);
    landmarks[23] = lm(0.3, 0.8);
    // Right shoulder (12), elbow (14), wrist (16), hip (24)
    landmarks[12] = lm(0.7, 0.5);
    landmarks[14] = lm(0.7, 0.35);
    landmarks[16] = lm(0.7, 0.15);
    landmarks[24] = lm(0.7, 0.8);

    const result = classifyBothArms(landmarks);

    expect(result.left).toBe('horizontal_out');
    expect(result.right).toBe('vertical_up');
  });

  it('returns neutral for both when landmarks are missing (visibility < 0.5)', () => {
    const landmarks: Landmark[] = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }));
    landmarks[11] = { x: 0.3, y: 0.5, z: 0, visibility: 0.3 };
    landmarks[13] = { x: 0.15, y: 0.5, z: 0, visibility: 0.3 };
    landmarks[15] = { x: 0.05, y: 0.5, z: 0, visibility: 0.3 };

    const result = classifyBothArms(landmarks);

    expect(result.left).toBe('neutral');
    expect(result.right).toBe('neutral');
  });
});

describe('detectGesture', () => {
  it('returns teamA for left horizontal_out + right vertical_up', () => {
    expect(detectGesture('horizontal_out', 'vertical_up')).toBe('teamA');
  });

  it('returns teamB for right horizontal_out + left vertical_up', () => {
    expect(detectGesture('vertical_up', 'horizontal_out')).toBe('teamB');
  });

  it('returns undo for both vertical_up', () => {
    expect(detectGesture('vertical_up', 'vertical_up')).toBe('undo');
  });

  it('returns null for both neutral', () => {
    expect(detectGesture('neutral', 'neutral')).toBeNull();
  });

  it('returns null for both horizontal_out (ambiguous)', () => {
    expect(detectGesture('horizontal_out', 'horizontal_out')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/input/poseRemote.test.ts`
Expected: classifyBothArms and detectGesture tests FAIL.

- [ ] **Step 3: Implement classifyBothArms and detectGesture**

Replace stubs in `src/input/poseRemote.ts`:

```typescript
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_ELBOW = 13;
const RIGHT_ELBOW = 14;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

const MIN_VISIBILITY = 0.5;

export function classifyBothArms(
  landmarks: Landmark[],
): { left: ArmClassification; right: ArmClassification } {
  const leftShoulder = landmarks[LEFT_SHOULDER];
  const leftElbow = landmarks[LEFT_ELBOW];
  const leftWrist = landmarks[LEFT_WRIST];
  const leftHip = landmarks[LEFT_HIP];
  const rightShoulder = landmarks[RIGHT_SHOULDER];
  const rightElbow = landmarks[RIGHT_ELBOW];
  const rightWrist = landmarks[RIGHT_WRIST];
  const rightHip = landmarks[RIGHT_HIP];

  if (
    leftWrist.visibility < MIN_VISIBILITY ||
    leftElbow.visibility < MIN_VISIBILITY ||
    leftShoulder.visibility < MIN_VISIBILITY ||
    rightWrist.visibility < MIN_VISIBILITY ||
    rightElbow.visibility < MIN_VISIBILITY ||
    rightShoulder.visibility < MIN_VISIBILITY
  ) {
    return { left: 'neutral', right: 'neutral' };
  }

  const bodyCenterX = (leftShoulder.x + rightShoulder.x) / 2;

  return {
    left: classifyArm(leftShoulder, leftElbow, leftWrist, leftHip, bodyCenterX, true),
    right: classifyArm(rightShoulder, rightElbow, rightWrist, rightHip, bodyCenterX, false),
  };
}

export function detectGesture(
  leftArm: ArmClassification,
  rightArm: ArmClassification,
): GestureType | null {
  if (leftArm === 'horizontal_out' && rightArm === 'vertical_up') return 'teamA';
  if (rightArm === 'horizontal_out' && leftArm === 'vertical_up') return 'teamB';
  if (leftArm === 'vertical_up' && rightArm === 'vertical_up') return 'undo';
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/input/poseRemote.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/input/poseRemote.test.ts src/input/poseRemote.ts
git commit -m "feat: add gesture detection from classified arms"
```

---

### Task 4: poseRemote.ts — Full interpreter with debounce, cooldown, conflict resolution (TDD)

**Files:**
- Modify: `src/input/poseRemote.test.ts`
- Modify: `src/input/poseRemote.ts`

- [ ] **Step 1: Write tests for createPoseInterpreter**

Add to `src/input/poseRemote.test.ts`:

```typescript
import { createPoseInterpreter } from './poseRemote';
import type { AppCommand } from './commands';

function fullBodyLandmarks(pose: {
  leftWrist?: { x: number; y: number };
  leftElbow?: { x: number; y: number };
  leftShoulder?: { x: number; y: number };
  rightWrist?: { x: number; y: number };
  rightElbow?: { x: number; y: number };
  rightShoulder?: { x: number; y: number };
}): Landmark[] {
  const arr: Landmark[] = new Array(33).fill(null).map(() => lm(0.5, 0.5));
  // Set hips for shoulder-hip height calculation
  arr[23] = lm(0.3, 0.8);
  arr[24] = lm(0.7, 0.8);
  // Shoulders
  arr[11] = pose.leftShoulder ?? lm(0.4, 0.5);
  arr[12] = pose.rightShoulder ?? lm(0.6, 0.5);
  // Elbows
  arr[13] = pose.leftElbow ?? lm(0.4, 0.6);
  arr[14] = pose.rightElbow ?? lm(0.6, 0.6);
  // Wrists
  arr[15] = pose.leftWrist ?? lm(0.4, 0.7);
  arr[16] = pose.rightWrist ?? lm(0.6, 0.7);
  return arr;
}

// Helper: create landmarks for teamA gesture (left horizontal_out, right vertical_up)
function teamALandmarks(): Landmark[] {
  return fullBodyLandmarks({
    leftWrist: lm(0.05, 0.5),
    leftElbow: lm(0.2, 0.5),
    leftShoulder: lm(0.35, 0.5),
    rightWrist: lm(0.65, 0.15),
    rightElbow: lm(0.65, 0.3),
    rightShoulder: lm(0.65, 0.5),
  });
}

// Helper: create landmarks for teamB gesture (right horizontal_out, left vertical_up)
function teamBLandmarks(): Landmark[] {
  return fullBodyLandmarks({
    leftWrist: lm(0.35, 0.15),
    leftElbow: lm(0.35, 0.3),
    leftShoulder: lm(0.35, 0.5),
    rightWrist: lm(0.95, 0.5),
    rightElbow: lm(0.8, 0.5),
    rightShoulder: lm(0.65, 0.5),
  });
}

// Helper: create landmarks for undo gesture (both vertical_up)
function undoLandmarks(): Landmark[] {
  return fullBodyLandmarks({
    leftWrist: lm(0.35, 0.15),
    leftElbow: lm(0.35, 0.3),
    leftShoulder: lm(0.35, 0.5),
    rightWrist: lm(0.65, 0.15),
    rightElbow: lm(0.65, 0.3),
    rightShoulder: lm(0.65, 0.5),
  });
}

describe('createPoseInterpreter', () => {
  it('dispatches POINT_TEAM teamA after 5 consecutive frames of the teamA gesture', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    const landmarks = teamALandmarks();

    // frames 1-4: no dispatch
    for (let i = 0; i < 4; i++) {
      interpreter.processLandmarks([landmarks]);
    }
    expect(commands).toEqual([]);

    // frame 5: dispatch
    interpreter.processLandmarks([landmarks]);
    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('dispatches POINT_TEAM teamB after 5 consecutive frames', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    const landmarks = teamBLandmarks();

    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([landmarks]);
    }

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamB' }]);
  });

  it('dispatches UNDO after 5 consecutive frames', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    const landmarks = undoLandmarks();

    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([landmarks]);
    }

    expect(commands).toEqual([{ type: 'UNDO' }]);
  });

  it('resets debounce counter when gesture changes mid-stream', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    // 2 frames of teamA
    for (let i = 0; i < 2; i++) {
      interpreter.processLandmarks([teamALandmarks()]);
    }

    // 1 frame of neutral (reset)
    interpreter.processLandmarks([[lm(0.5, 0.7)]]);

    // 5 frames of teamA again (fresh count)
    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamALandmarks()]);
    }

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('respects 2-second cooldown after dispatch', () => {
    const commands: AppCommand[] = [];
    let currentTime = 0;
    const interpreter = createPoseInterpreter({
      dispatch: (c) => commands.push(c),
      now: () => currentTime,
    });

    // First gesture: dispatch at t=0
    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamALandmarks()]);
    }
    expect(commands).toHaveLength(1);

    // Immediately after, another gesture — should be ignored (cooldown)
    currentTime = 500;
    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamBLandmarks()]);
    }
    expect(commands).toHaveLength(1); // still 1

    // After cooldown, gesture works again
    currentTime = 2500;
    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamBLandmarks()]);
    }
    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual({ type: 'POINT_TEAM', teamId: 'teamB' });
  });

  it('first person in frame wins — second person ignored', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    // Person 0 does teamA, Person 1 does teamB — teamA should win
    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamALandmarks(), teamBLandmarks()]);
    }

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('reset clears internal state', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    // 3 frames of teamA
    for (let i = 0; i < 3; i++) {
      interpreter.processLandmarks([teamALandmarks()]);
    }

    interpreter.reset();

    // 5 more frames — should need full 5 again
    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamALandmarks()]);
    }

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('does not dispatch when no person has a valid gesture', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    const neutral = [lm(0.5, 0.7)]; // single dummy landmark

    for (let i = 0; i < 10; i++) {
      interpreter.processLandmarks([neutral]);
    }

    expect(commands).toEqual([]);
  });

  it('skips frame when landmarks have insufficient keypoints', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    // Fewer than 17 landmarks (no hips)
    const incomplete: Landmark[] = new Array(12).fill(null).map(() => lm(0.5, 0.5));

    for (let i = 0; i < 10; i++) {
      interpreter.processLandmarks([incomplete]);
    }

    expect(commands).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/input/poseRemote.test.ts`
Expected: createPoseInterpreter tests FAIL (processLandmarks is a no-op stub).

- [ ] **Step 3: Implement createPoseInterpreter**

Replace the stub in `src/input/poseRemote.ts`:

```typescript
const COOLDOWN_MS = 2000;
const DEBOUNCE_FRAMES = 5;
const MIN_KEYPOINTS = 17; // Need at least up to hip landmarks

function gestureToCommand(gesture: GestureType): AppCommand {
  switch (gesture) {
    case 'teamA':
      return { type: 'POINT_TEAM', teamId: 'teamA' };
    case 'teamB':
      return { type: 'POINT_TEAM', teamId: 'teamB' };
    case 'undo':
      return { type: 'UNDO' };
  }
}

export function createPoseInterpreter(options: PoseInterpreterOptions): PoseInterpreter {
  const now = options.now ?? (() => Date.now());
  let trackedGesture: GestureType | null = null;
  let consecutiveFrames = 0;
  let lastDispatchTime = 0;

  function processLandmarks(allPersonLandmarks: Landmark[][]): void {
    if (now() - lastDispatchTime < COOLDOWN_MS) return;

    let gestureThisFrame: GestureType | null = null;

    for (const landmarks of allPersonLandmarks) {
      if (landmarks.length < MIN_KEYPOINTS) continue;

      const arms = classifyBothArms(landmarks);
      gestureThisFrame = detectGesture(arms.left, arms.right);
      if (gestureThisFrame !== null) break;
    }

    if (gestureThisFrame === trackedGesture && gestureThisFrame !== null) {
      consecutiveFrames++;
    } else if (gestureThisFrame !== null) {
      trackedGesture = gestureThisFrame;
      consecutiveFrames = 1;
    } else {
      trackedGesture = null;
      consecutiveFrames = 0;
    }

    if (consecutiveFrames >= DEBOUNCE_FRAMES && trackedGesture !== null) {
      options.dispatch(gestureToCommand(trackedGesture));
      lastDispatchTime = now();
      trackedGesture = null;
      consecutiveFrames = 0;
    }
  }

  function reset(): void {
    trackedGesture = null;
    consecutiveFrames = 0;
  }

  function destroy(): void {
    reset();
    lastDispatchTime = 0;
  }

  return { processLandmarks, reset, destroy };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/input/poseRemote.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/input/poseRemote.test.ts src/input/poseRemote.ts
git commit -m "feat: add pose interpreter with debounce, cooldown, and conflict resolution"
```

---

### Task 5: usePoseDetection.ts — MediaPipe hook (TDD)

**Files:**
- Create: `src/hooks/usePoseDetection.test.ts`
- Modify: `src/hooks/usePoseDetection.ts`

- [ ] **Step 1: Write tests for usePoseDetection**

```typescript
// src/hooks/usePoseDetection.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePoseDetection } from './usePoseDetection';

// Mock getUserMedia
const mockGetUserMedia = vi.fn();
const mockMediaStream = {
  getTracks: vi.fn(() => [{ stop: vi.fn() }]),
  getVideoTracks: vi.fn(() => [{ stop: vi.fn() }]),
} as unknown as MediaStream;

beforeEach(() => {
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia },
    writable: true,
  });
  mockGetUserMedia.mockResolvedValue(mockMediaStream);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Stubbed MediaPipe loader for tests
function createStubPoseLandmarker() {
  return {
    detectForVideo: vi.fn().mockReturnValue({ landmarks: [] }),
    close: vi.fn(),
  };
}

describe('usePoseDetection', () => {
  it('isSupported is true when getUserMedia exists', () => {
    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker: vi.fn() }));
    expect(result.current.isSupported).toBe(true);
  });

  it('isSupported is false when getUserMedia is missing', () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', { value: undefined, writable: true });
    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker: vi.fn() }));
    expect(result.current.isSupported).toBe(false);
  });

  it('isActive is false initially', () => {
    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker: vi.fn() }));
    expect(result.current.isActive).toBe(false);
  });

  it('isActive becomes true after start() succeeds', async () => {
    const loadPoseLandmarker = vi.fn().mockResolvedValue(createStubPoseLandmarker());
    const onLandmarks = vi.fn();
    const { result } = renderHook(() => usePoseDetection({ onLandmarks, loadPoseLandmarker }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isActive).toBe(true);
  });

  it('sets error when getUserMedia is denied', async () => {
    mockGetUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    const loadPoseLandmarker = vi.fn().mockResolvedValue(createStubPoseLandmarker());

    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker }));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBe('Camera permission denied');
    expect(result.current.isActive).toBe(false);
  });

  it('stop sets isActive to false', async () => {
    const loadPoseLandmarker = vi.fn().mockResolvedValue(createStubPoseLandmarker());

    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker }));

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.isActive).toBe(false);
  });

  it('does not throw when stop is called before start', () => {
    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker: vi.fn() }));

    expect(() => {
      act(() => {
        result.current.stop();
      });
    }).not.toThrow();
  });

  it('does not throw when start is called while already active', async () => {
    const loadPoseLandmarker = vi.fn().mockResolvedValue(createStubPoseLandmarker());

    const { result } = renderHook(() => usePoseDetection({ loadPoseLandmarker }));

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isActive).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/hooks/usePoseDetection.test.ts`
Expected: Tests FAIL — stub hook returns fixed values.

- [ ] **Step 3: Implement usePoseDetection**

Replace stub in `src/hooks/usePoseDetection.ts`:

```typescript
import { useState, useRef, useCallback, useEffect } from 'react';

export interface UsePoseDetectionOptions {
  onLandmarks?: (landmarks: NormalizedLandmark[][]) => void;
  loadPoseLandmarker?: () => Promise<any>;
}

export interface UsePoseDetectionResult {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

async function defaultLoadPoseLandmarker() {
  const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  );
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 2,
  });
}

export function usePoseDetection(options: UsePoseDetectionOptions = {}): UsePoseDetectionResult {
  const { onLandmarks, loadPoseLandmarker = defaultLoadPoseLandmarker } = options;
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported] = useState(() => {
    return typeof navigator !== 'undefined' &&
           'mediaDevices' in navigator &&
           'getUserMedia' in (navigator.mediaDevices ?? {});
  });

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const poseLandmarkerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const onLandmarksRef = useRef(onLandmarks);
  onLandmarksRef.current = onLandmarks;

  const stop = useCallback(() => {
    isActiveRef.current = false;
    setIsActive(false);

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (poseLandmarkerRef.current) {
      poseLandmarkerRef.current.close();
      poseLandmarkerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      isActiveRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
      }
    };
  }, []);

  const start = useCallback(async () => {
    if (isActiveRef.current) return;

    setError(null);

    try {
      poseLandmarkerRef.current = await loadPoseLandmarker();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      streamRef.current = stream;

      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.srcObject = stream;
      await video.play();
      videoRef.current = video;

      isActiveRef.current = true;
      setIsActive(true);

      let frameCount = 0;
      const detect = () => {
        if (!isActiveRef.current || !poseLandmarkerRef.current) return;

        frameCount++;
        if (frameCount % 4 !== 0) {
          rafRef.current = requestAnimationFrame(detect);
          return;
        }

        try {
          const results = poseLandmarkerRef.current.detectForVideo(video, performance.now());
          if (results.landmarks && results.landmarks.length > 0 && onLandmarksRef.current) {
            onLandmarksRef.current(results.landmarks);
          }
        } catch {
          // Detection can fail if video isn't ready yet
        }

        rafRef.current = requestAnimationFrame(detect);
      };

      rafRef.current = requestAnimationFrame(detect);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Camera permission denied');
      } else {
        setError('Failed to start camera');
      }
    }
  }, [loadPoseLandmarker]);

  // Pause detection when page is hidden, resume when visible
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden && isActiveRef.current) {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else if (!document.hidden && isActiveRef.current && rafRef.current === null && videoRef.current) {
        let frameCount = 0;
        const detect = () => {
          if (!isActiveRef.current || !poseLandmarkerRef.current) return;

          frameCount++;
          if (frameCount % 4 !== 0) {
            rafRef.current = requestAnimationFrame(detect);
            return;
          }

          try {
            const results = poseLandmarkerRef.current.detectForVideo(videoRef.current!, performance.now());
            if (results.landmarks && results.landmarks.length > 0 && onLandmarksRef.current) {
              onLandmarksRef.current(results.landmarks);
            }
          } catch {
            // ignore
          }

          rafRef.current = requestAnimationFrame(detect);
        };
        rafRef.current = requestAnimationFrame(detect);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return { isSupported, isActive, error, start, stop };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/hooks/usePoseDetection.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePoseDetection.test.ts src/hooks/usePoseDetection.ts
git commit -m "feat: add usePoseDetection hook with MediaPipe PoseLandmarker"
```

---

### Task 6: PoseCamera.tsx — UI component with toggle, PiP, skeleton, flash feedback

**Files:**
- Create: `src/components/PoseCamera.test.tsx`
- Modify: `src/components/PoseCamera.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write component tests**

```typescript
// src/components/PoseCamera.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PoseCamera } from './PoseCamera';
import type { AppCommand } from '../input/commands';

// Mock usePoseDetection
vi.mock('../hooks/usePoseDetection', () => ({
  usePoseDetection: vi.fn(() => ({
    isSupported: true,
    isActive: false,
    error: null,
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

import { usePoseDetection } from '../hooks/usePoseDetection';

describe('PoseCamera', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders toggle button when supported', () => {
    render(<PoseCamera onCommand={vi.fn()} />);
    const button = screen.getByRole('button', { name: /camera/i });
    expect(button).toBeInTheDocument();
  });

  it('does not render when not supported', () => {
    (usePoseDetection as ReturnType<typeof vi.fn>).mockReturnValue({
      isSupported: false,
      isActive: false,
      error: null,
      start: vi.fn(),
      stop: vi.fn(),
    });

    render(<PoseCamera onCommand={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls start when toggle is clicked while inactive', () => {
    const mockStart = vi.fn();
    (usePoseDetection as ReturnType<typeof vi.fn>).mockReturnValue({
      isSupported: true,
      isActive: false,
      error: null,
      start: mockStart,
      stop: vi.fn(),
    });

    render(<PoseCamera onCommand={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /camera/i }));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('calls stop when toggle is clicked while active', () => {
    const mockStop = vi.fn();
    (usePoseDetection as ReturnType<typeof vi.fn>).mockReturnValue({
      isSupported: true,
      isActive: true,
      error: null,
      start: vi.fn(),
      stop: mockStop,
    });

    render(<PoseCamera onCommand={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /camera/i }));
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('shows error message when error is set', () => {
    (usePoseDetection as ReturnType<typeof vi.fn>).mockReturnValue({
      isSupported: true,
      isActive: false,
      error: 'Camera permission denied',
      start: vi.fn(),
      stop: vi.fn(),
    });

    render(<PoseCamera onCommand={vi.fn()} />);
    expect(screen.getByText('Camera permission denied')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/components/PoseCamera.test.tsx`
Expected: Tests FAIL — component returns null.

- [ ] **Step 3: Implement PoseCamera**

Replace stub in `src/components/PoseCamera.tsx`:

```typescript
import { useCallback, useRef, useEffect } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import { usePoseDetection } from '../hooks/usePoseDetection';
import { createPoseInterpreter } from '../input/poseRemote';
import type { AppCommand } from '../input/commands';

interface PoseCameraProps {
  readonly onCommand: (command: AppCommand) => void;
}

export function PoseCamera({ onCommand }: PoseCameraProps) {
  const interpreterRef = useRef(createPoseInterpreter({ dispatch: onCommand }));
  const feedbackRef = useRef<HTMLDivElement>(null);

  const handleLandmarks = useCallback((landmarks: NormalizedLandmark[][]) => {
    interpreterRef.current.processLandmarks(landmarks);
  }, []);

  const { isSupported, isActive, error, start, stop } = usePoseDetection({
    onLandmarks: handleLandmarks,
  });

  useEffect(() => {
    return () => {
      interpreterRef.current.destroy();
    };
  }, []);

  useEffect(() => {
    // Listen for commands to show visual feedback
    const originalDispatch = onCommand;
    interpreterRef.current = createPoseInterpreter({
      dispatch: (command) => {
        feedbackRef.current?.classList.add('pose-feedback-flash');
        setTimeout(() => {
          feedbackRef.current?.classList.remove('pose-feedback-flash');
        }, 300);
        originalDispatch(command);
      },
    });
  }, [onCommand]);

  if (!isSupported) return null;

  return (
    <div className="pose-camera-controls">
      <button
        className={`icon-button ${isActive ? 'pose-camera-active' : ''}`}
        type="button"
        onClick={isActive ? stop : start}
        aria-label={isActive ? 'Disable camera gestures' : 'Enable camera gestures'}
        title={isActive ? 'Disable camera gestures' : 'Enable camera gestures'}
      >
        {isActive ? <CameraOff size={22} aria-hidden="true" /> : <Camera size={22} aria-hidden="true" />}
      </button>
      <div ref={feedbackRef} className="pose-feedback" aria-live="polite" />
      {error && <div className="pose-camera-error" role="alert">{error}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run src/components/PoseCamera.test.tsx`
Expected: All tests PASS.

- [ ] **Step 5: Add CSS styles**

Add to `src/styles.css`:

```css
/* Pose Camera */
.pose-camera-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pose-camera-active {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.15);
}

.pose-feedback {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;
  transition: background 0.15s ease;
}

.pose-feedback-flash {
  background: #4ade80;
}

.pose-camera-error {
  color: #f87171;
  font-size: 12px;
  white-space: nowrap;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/PoseCamera.test.tsx src/components/PoseCamera.tsx src/styles.css
git commit -m "feat: add PoseCamera UI component with toggle and feedback"
```

---

### Task 7: Integration — Wire PoseCamera into App.tsx

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add PoseCamera to the controls section**

In `src/App.tsx`, add the import:

```typescript
import { PoseCamera } from './components/PoseCamera';
```

Add to the imports section (near line 1-30 where other component imports are).

- [ ] **Step 2: Add PoseCamera inside the utility-controls div in Controls.tsx**

Actually, it's cleaner to add it to `Controls.tsx` as a prop rather than modifying the component structure. Let's add it in `App.tsx` alongside the Controls component.

In `src/App.tsx`, find the Controls usage around line 937:

```tsx
<Controls
  onUndo={() => dispatch({ type: 'UNDO' })}
  onAnnounce={() => speakAnnouncement(match, preferencesRef.current.announcementMode)}
  showBackToSessionSuggestion={canReturnToSessionSuggestion}
  onBackToSessionSuggestion={handleBackToSessionSuggestion}
  onEndSession={isSessionPlaying ? handleEndSession : undefined}
/>
```

Add `PoseCamera` as a sibling inside the controls section:

```tsx
<section className="controls" aria-label="Match controls">
  <div className="utility-controls live-utility-controls">
    <PoseCamera onCommand={dispatch} />
    <button className="icon-button" type="button" onClick={() => dispatch({ type: 'UNDO' })} aria-label="Undo last point">
      <RotateCcw size={22} aria-hidden="true" />
    </button>
    <button className="icon-button" type="button" onClick={() => speakAnnouncement(match, preferencesRef.current.announcementMode)} aria-label="Announce score">
      <Megaphone size={22} aria-hidden="true" />
    </button>
  </div>
  {/* session actions unchanged */}
</section>
```

Wait — actually, the Controls component wraps all of this with its own internal structure. Let me not modify Controls.tsx (avoid changing existing component). Instead, I'll add PoseCamera in App.tsx directly inside the `app-layout`.

Let me think about where. The current structure is:
```
<div className="app-layout">
  <CourtView ... />
  <Controls ... />
  ...
</div>
```

I'll add PoseCamera as a separate element next to or above Controls:

```tsx
<div className="app-layout">
  <CourtView ... />
  <div className="controls-row">
    <PoseCamera onCommand={dispatch} />
  </div>
  <Controls ... />
  ...
</div>
```

Actually, the simplest approach that requires the least change: add PoseCamera directly in the `utility-controls` inside App.tsx. But Controls.tsx has the `utility-controls` div hardcoded internally.

The cleanest approach: modify `Controls.tsx` to accept an optional `children` or a `poseCamera` slot. But the spec says to minimize changes to existing components.

Simplest approach: Add the `PoseCamera` as a new prop to `Controls` called `poseCameraSlot` or just render it separately in App.tsx next to Controls.

Let me just add it in App.tsx before the Controls component:

```tsx
<Controls ... />
```

becomes:

```tsx
<div className="camera-control-row">
  <PoseCamera onCommand={dispatch} />
</div>
<Controls ... />
```

Actually, let me look at App.tsx more carefully to find the exact spot.

Looking at lines 926-959:
```tsx
<main className="app-shell">
  <AccountBar ... />
  <div className="app-layout">
    <CourtView ... />
    <Controls ... />
    ...
  </div>
</main>
```

The simplest: Add PoseCamera as a child of `app-layout` before Controls. Let me just modify the plan step to be explicit.

- [ ] **Step 2: Add PoseCamera to App.tsx layout**

In `src/App.tsx`, find the Controls component usage (after `<CourtView>`):

```tsx
<CourtView
  match={match}
  displayMode={preferences.displayMode}
  onPointTeam={(teamId) => dispatch({ type: 'POINT_TEAM', teamId })}
  fighterSprites={fighterSprites}
  onPlayerSpriteClick={setActiveSpritePickerPlayerId}
/>
<Controls
```

Insert `PoseCamera` between `CourtView` and `Controls`:

```tsx
<CourtView
  match={match}
  displayMode={preferences.displayMode}
  onPointTeam={(teamId) => dispatch({ type: 'POINT_TEAM', teamId })}
  fighterSprites={fighterSprites}
  onPlayerSpriteClick={setActiveSpritePickerPlayerId}
/>
<PoseCamera onCommand={dispatch} />
<Controls
```

- [ ] **Step 3: Verify build passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run lint`
Expected: No errors.

- [ ] **Step 4: Run full test suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm test`
Expected: All tests pass, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate camera-based handsfree scoring"
```

---

### Task 8: Documentation

**Files:**
- Modify: `.docs/input/input-remotes.md`

- [ ] **Step 1: Read current input-remotes.md**

Read the file at `.docs/input/input-remotes.md` to understand its structure and where to add the new section.

- [ ] **Step 2: Add Pose Remote section**

Add a new section in the input methods documentation describing:
- Camera-based pose detection via MediaPipe
- Gesture mapping (left-arm-out+right-up = Team A, right-arm-out+left-up = Team B, both-up = Undo)
- Activation toggle and PiP preview
- Cooldown and debounce behavior
- On-device processing (no cloud dependency)

- [ ] **Step 3: Commit**

```bash
git add .docs/input/input-remotes.md
git commit -m "docs: document camera-based pose remote input"
```

---

### Task 9: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm test
```

Expected: All tests pass, zero failures.

- [ ] **Step 2: Run lint**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run lint
```

Expected: No TypeScript errors.

- [ ] **Step 3: Run build**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Validate service worker syntax**

```bash
source ~/.nvm/nvm.sh && nvm use 22 && node --check public/sw.js
```

Expected: No syntax errors.

- [ ] **Step 5: Commit if changes remain**

```bash
git add -A
git diff --cached --stat
# Only commit if verification changes were needed
git commit -m "chore: final verification adjustments"
```
