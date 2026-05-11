import { createGestureInterpreter } from './gestureInterpreter';
import type { AppCommand } from './commands';

interface KeyboardRemoteOptions {
  dispatch: (command: AppCommand) => void;
  target?: EventTarget;
  setInterval?: (callback: () => void, delay: number) => number;
  clearInterval?: (intervalId: number) => void;
  now?: () => number;
}

export interface KeyboardRemoteConnection {
  disconnect(): void;
}

export function isVolumeUpKeyEvent(event: KeyboardEvent): boolean {
  return event.key === 'AudioVolumeUp' || event.key === 'VolumeUp' || event.keyCode === 175;
}

export function connectKeyboardRemote(options: KeyboardRemoteOptions): KeyboardRemoteConnection {
  const target = options.target ?? window;
  const now = options.now ?? (() => performance.now());
  const setFlushInterval = options.setInterval ?? ((callback, delay) => window.setInterval(callback, delay));
  const clearFlushInterval = options.clearInterval ?? ((intervalId) => window.clearInterval(intervalId));
  const interpreter = createGestureInterpreter(options.dispatch);
  const flushIntervalId = setFlushInterval(() => {
    interpreter.flush(now());
  }, 100);

  const handleKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent) || !isVolumeUpKeyEvent(event) || event.repeat) {
      return;
    }

    event.preventDefault();
    interpreter.handlePress(now());
  };

  const handleKeyUp = (event: Event): void => {
    if (!(event instanceof KeyboardEvent) || !isVolumeUpKeyEvent(event)) {
      return;
    }

    event.preventDefault();
    interpreter.handleRelease(now());
  };

  target.addEventListener('keydown', handleKeyDown);
  target.addEventListener('keyup', handleKeyUp);

  return {
    disconnect() {
      clearFlushInterval(flushIntervalId);
      target.removeEventListener('keydown', handleKeyDown);
      target.removeEventListener('keyup', handleKeyUp);
    },
  };
}
