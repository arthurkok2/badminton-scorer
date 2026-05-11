import type { AppCommand } from './commands';

const DOUBLE_CLICK_MS = 400;
const HOLD_MS = 650;

export interface GestureInterpreter {
  handlePress(timestamp: number): void;
  handleRelease(timestamp: number): void;
  flush(timestamp: number): void;
}

export function createGestureInterpreter(dispatch: (command: AppCommand) => void): GestureInterpreter {
  let pressStartedAt: number | undefined;
  let clickCount = 0;
  let lastReleaseAt: number | undefined;

  function dispatchPendingSingleClick(timestamp: number): void {
    if (clickCount === 1 && lastReleaseAt !== undefined && timestamp - lastReleaseAt >= DOUBLE_CLICK_MS) {
      clickCount = 0;
      lastReleaseAt = undefined;
      dispatch({ type: 'POINT_TEAM', teamId: 'teamA' });
    }
  }

  return {
    handlePress(timestamp) {
      if (pressStartedAt !== undefined) {
        return;
      }

      dispatchPendingSingleClick(timestamp);
      pressStartedAt = timestamp;
    },
    handleRelease(timestamp) {
      if (pressStartedAt === undefined) {
        return;
      }

      const duration = timestamp - pressStartedAt;
      pressStartedAt = undefined;

      if (duration >= HOLD_MS) {
        clickCount = 0;
        lastReleaseAt = undefined;
        dispatch({ type: 'UNDO' });
        return;
      }

      clickCount += 1;
      lastReleaseAt = timestamp;

      if (clickCount === 2) {
        clickCount = 0;
        lastReleaseAt = undefined;
        dispatch({ type: 'POINT_TEAM', teamId: 'teamB' });
      }
    },
    flush(timestamp) {
      dispatchPendingSingleClick(timestamp);
    },
  };
}
