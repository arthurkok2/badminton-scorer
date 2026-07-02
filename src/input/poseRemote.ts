// src/input/poseRemote.ts
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
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

const COOLDOWN_MS = 2000;
const DEBOUNCE_FRAMES = 10;
const MIN_KEYPOINTS = 17;

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
  let lastDispatchTime = -COOLDOWN_MS;

  function processLandmarks(allPersonLandmarks: Landmark[][]): void {
    if (now() - lastDispatchTime < COOLDOWN_MS) return;

    let gestureThisFrame: GestureType | null = null;

    for (const landmarks of allPersonLandmarks) {
      if (landmarks.length < MIN_KEYPOINTS) continue;

      const arms = classifyBothArms(landmarks);
      const bodyCenterX = (landmarks[LEFT_SHOULDER].x + landmarks[RIGHT_SHOULDER].x) / 2;
      gestureThisFrame = detectGesture(
        arms.left, arms.right,
        landmarks[LEFT_WRIST].x, landmarks[RIGHT_WRIST].x,
        bodyCenterX,
      );
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
    lastDispatchTime = -COOLDOWN_MS;
  }

  return { processLandmarks, reset, destroy };
}

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_ELBOW = 13;
const RIGHT_ELBOW = 14;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

const MIN_VISIBILITY = 0.5;

export function classifyArm(
  shoulder: Landmark,
  elbow: Landmark,
  wrist: Landmark,
  hip: Landmark,
  _bodyCenterX: number,
  _isLeft: boolean,
): ArmClassification {
  const shoulderHipDY = Math.abs(shoulder.y - hip.y);
  if (shoulderHipDY === 0) return 'neutral';

  // horizontal_out: wrist at shoulder height, arm extended (wrist farther from shoulder than elbow)
  const yTolerance = shoulderHipDY * 0.15;
  const yOk = Math.abs(wrist.y - shoulder.y) < yTolerance;
  if (yOk) {
    const wristDist = Math.hypot(wrist.x - shoulder.x, wrist.y - shoulder.y);
    const elbowDist = Math.hypot(elbow.x - shoulder.x, elbow.y - shoulder.y);
    if (wristDist > elbowDist) return 'horizontal_out';
  }

  // Check vertical_up
  const yAbove = shoulder.y - wrist.y;
  const yThreshold = shoulderHipDY * 0.20;
  const xThreshold = shoulderHipDY * 0.25;
  if (yAbove >= yThreshold && Math.abs(wrist.x - shoulder.x) < xThreshold) {
    return 'vertical_up';
  }

  return 'neutral';
}

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
  leftWristX: number,
  rightWristX: number,
  bodyCenterX: number,
): GestureType | null {
  if (leftArm === 'vertical_up' && rightArm === 'vertical_up') return 'undo';

  // Single arm horizontal: use spatial position (which side of image)
  // From behind the court, player's left arm appears on right of camera
  if (leftArm === 'horizontal_out' && rightArm !== 'horizontal_out') {
    return leftWristX > bodyCenterX ? 'teamA' : 'teamB';
  }
  if (rightArm === 'horizontal_out' && leftArm !== 'horizontal_out') {
    return rightWristX > bodyCenterX ? 'teamA' : 'teamB';
  }

  return null;
}
