import type { AppCommand } from './commands';
import type { DetectionResult } from '../hooks/usePoseDetection';

export type GestureType = 'teamA' | 'teamB' | 'undo';

export interface PoseInterpreterOptions {
  dispatch: (command: AppCommand) => void;
  now?: () => number;
}

export interface PoseInterpreter {
  processResult(result: DetectionResult): void;
  reset(): void;
  destroy(): void;
}

const COOLDOWN_MS = 2000;
const DEBOUNCE_FRAMES = 10;
const CONFIDENCE_THRESHOLD = 0.6;

function detectGesture(result: DetectionResult): GestureType | null {
  const openPalmHands: string[] = [];

  for (let i = 0; i < result.gestures.length; i++) {
    const topGesture = result.gestures[i]?.[0];
    if (topGesture?.categoryName === 'Open_Palm' && topGesture.score >= CONFIDENCE_THRESHOLD) {
      const hand = result.handedness[i]?.[0]?.categoryName;
      if (hand === 'Left' || hand === 'Right') {
        openPalmHands.push(hand);
      }
    }
  }

  if (openPalmHands.length === 2) return 'undo';
  if (openPalmHands.length === 1) {
    return openPalmHands[0] === 'Left' ? 'teamA' : 'teamB';
  }
  return null;
}

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

  function processResult(result: DetectionResult): void {
    if (now() - lastDispatchTime < COOLDOWN_MS) return;

    const gestureThisFrame = detectGesture(result);

    if (gestureThisFrame === trackedGesture && gestureThisFrame !== null) {
      consecutiveFrames++;
    } else if (gestureThisFrame !== null) {
      trackedGesture = gestureThisFrame;
      consecutiveFrames = 1;
    } else {
      if (trackedGesture !== null) {
        lastDispatchTime = now();
      }
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

  return { processResult, reset, destroy };
}
