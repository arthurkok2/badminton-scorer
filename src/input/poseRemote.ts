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
