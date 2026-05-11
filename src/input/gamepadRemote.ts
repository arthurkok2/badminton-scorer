import { createGestureInterpreter } from './gestureInterpreter';
import type { AppCommand } from './commands';

export interface GamepadRemoteDiagnosticEvent {
  readonly source: 'gamepad';
  readonly type: 'press' | 'release';
  readonly gamepadIndex: number;
  readonly gamepadId: string;
  readonly buttonIndex: number;
}

interface GamepadRemoteOptions {
  dispatch: (command: AppCommand) => void;
  onDiagnosticEvent?: (event: GamepadRemoteDiagnosticEvent) => void;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (id: number) => void;
  getGamepads?: () => (Gamepad | null)[];
  setInterval?: (callback: () => void, delay: number) => number;
  clearInterval?: (id: number) => void;
  now?: () => number;
}

export interface GamepadRemoteConnection {
  disconnect(): void;
}

export function isGamepadSupported(nav: Navigator = navigator): boolean {
  return 'getGamepads' in nav;
}

export function connectGamepadRemote(options: GamepadRemoteOptions): GamepadRemoteConnection {
  const raf = options.requestAnimationFrame ?? ((cb) => window.requestAnimationFrame(cb));
  const caf = options.cancelAnimationFrame ?? ((id) => window.cancelAnimationFrame(id));
  const getGamepads = options.getGamepads ?? (() => {
    if (typeof navigator === 'undefined' || !('getGamepads' in navigator)) {
      return [];
    }
    return Array.from(navigator.getGamepads());
  });
  const now = options.now ?? (() => performance.now());
  const setFlushInterval = options.setInterval ?? ((cb, delay) => window.setInterval(cb, delay));
  const clearFlushInterval = options.clearInterval ?? ((id) => window.clearInterval(id));
  const interpreter = createGestureInterpreter(options.dispatch);
  const buttonStates = new Map<number, boolean[]>();
  let rafId: number | undefined;
  let disconnected = false;

  const flushIntervalId = setFlushInterval(() => {
    interpreter.flush(now());
  }, 100);

  const poll = (): void => {
    if (disconnected) {
      return;
    }

    const gamepads = getGamepads();

    for (const gamepad of gamepads) {
      if (gamepad === null) {
        continue;
      }

      const prev = buttonStates.get(gamepad.index) ?? new Array(gamepad.buttons.length).fill(false);
      const next: boolean[] = [];

      for (let i = 0; i < gamepad.buttons.length; i++) {
        const pressed = gamepad.buttons[i].pressed;
        next.push(pressed);

        if (pressed && !prev[i]) {
          options.onDiagnosticEvent?.({
            source: 'gamepad',
            type: 'press',
            gamepadIndex: gamepad.index,
            gamepadId: gamepad.id,
            buttonIndex: i,
          });
          interpreter.handlePress(now());
        } else if (!pressed && prev[i]) {
          options.onDiagnosticEvent?.({
            source: 'gamepad',
            type: 'release',
            gamepadIndex: gamepad.index,
            gamepadId: gamepad.id,
            buttonIndex: i,
          });
          interpreter.handleRelease(now());
        }
      }

      buttonStates.set(gamepad.index, next);
    }

    rafId = raf(poll);
  };

  rafId = raf(poll);

  return {
    disconnect() {
      disconnected = true;

      if (rafId !== undefined) {
        caf(rafId);
        rafId = undefined;
      }

      clearFlushInterval(flushIntervalId);
    },
  };
}
