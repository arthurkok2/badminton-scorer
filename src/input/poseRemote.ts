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

export function createPoseInterpreter(_options: PoseInterpreterOptions): PoseInterpreter {
  return {
    processLandmarks: () => {},
    reset: () => {},
    destroy: () => {},
  };
}

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
  if (yAbove >= yThreshold && Math.abs(wrist.x - shoulder.x) < xThreshold) {
    return 'vertical_up';
  }

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
