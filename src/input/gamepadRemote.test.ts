import { connectGamepadRemote, isGamepadSupported } from './gamepadRemote';
import type { GamepadRemoteDiagnosticEvent } from './gamepadRemote';
import type { AppCommand } from './commands';
import { vi } from 'vitest';

function createFakeButton(pressed: boolean): GamepadButton {
  return { pressed, touched: pressed, value: pressed ? 1 : 0 };
}

function createFakeGamepad(index: number, buttonStates: boolean[]): Gamepad {
  return {
    id: `Fake Gamepad ${index}`,
    index,
    connected: true,
    timestamp: 0,
    mapping: 'standard' as GamepadMappingType,
    axes: [],
    buttons: buttonStates.map(createFakeButton),
    hapticActuators: [],
    vibrationActuator: null,
  } as unknown as Gamepad;
}

function setup(getGamepads: () => (Gamepad | null)[], timestamps: number[] = []) {
  const commands: AppCommand[] = [];
  const diagnostics: GamepadRemoteDiagnosticEvent[] = [];
  const rafCallbacks: FrameRequestCallback[] = [];
  const intervalCallbacks: Array<() => void> = [];
  const cancelAnimationFrame = vi.fn();

  const connection = connectGamepadRemote({
    dispatch: (command) => commands.push(command),
    onDiagnosticEvent: (event) => diagnostics.push(event),
    requestAnimationFrame: (cb) => { rafCallbacks.push(cb); return rafCallbacks.length; },
    cancelAnimationFrame,
    getGamepads,
    setInterval: (cb) => { intervalCallbacks.push(cb); return 1; },
    clearInterval: vi.fn(),
    now: () => timestamps.shift() ?? 999,
  });

  function tick() {
    const toRun = rafCallbacks.splice(0);
    toRun.forEach((cb) => cb(0));
  }

  return { connection, commands, diagnostics, tick, intervalCallbacks, cancelAnimationFrame };
}

describe('gamepad remote', () => {
  it('isGamepadSupported returns true only when navigator has getGamepads', () => {
    expect(isGamepadSupported({ getGamepads: () => [] } as unknown as Navigator)).toBe(true);
    expect(isGamepadSupported({} as Navigator)).toBe(false);
  });

  it('does not dispatch when no gamepads are connected', () => {
    const { commands, tick } = setup(() => []);

    tick();
    tick();

    expect(commands).toEqual([]);
  });

  it('does not dispatch when all buttons remain unpressed', () => {
    const gamepad = createFakeGamepad(0, [false, false]);
    const { commands, tick } = setup(() => [gamepad]);

    tick();
    tick();

    expect(commands).toEqual([]);
  });

  it('routes button press and release through the gesture interpreter', () => {
    let pressed = false;
    const getGamepads = () => [createFakeGamepad(0, [pressed])];
    const timestamps = [0, 80, 500];
    const { commands, tick, intervalCallbacks } = setup(getGamepads, timestamps);

    tick();
    pressed = true;
    tick();
    pressed = false;
    tick();
    intervalCallbacks[0]();

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('emits a press diagnostic event when a button transitions to pressed', () => {
    let pressed = false;
    const getGamepads = () => [createFakeGamepad(0, [pressed])];
    const { diagnostics, tick } = setup(getGamepads);

    tick();
    pressed = true;
    tick();

    expect(diagnostics).toContainEqual({
      source: 'gamepad',
      type: 'press',
      gamepadIndex: 0,
      gamepadId: 'Fake Gamepad 0',
      buttonIndex: 0,
    });
  });

  it('emits a release diagnostic event when a button transitions to unpressed', () => {
    let pressed = true;
    const getGamepads = () => [createFakeGamepad(0, [pressed])];
    const { diagnostics, tick } = setup(getGamepads);

    tick();
    pressed = false;
    tick();

    expect(diagnostics).toContainEqual({
      source: 'gamepad',
      type: 'release',
      gamepadIndex: 0,
      gamepadId: 'Fake Gamepad 0',
      buttonIndex: 0,
    });
  });

  it('tracks each button index independently', () => {
    let b0 = false;
    let b1 = false;
    const getGamepads = () => [createFakeGamepad(0, [b0, b1])];
    const { diagnostics, tick } = setup(getGamepads);

    tick();
    b1 = true;
    tick();

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].buttonIndex).toBe(1);
  });

  it('disconnect stops the poll loop', () => {
    const { connection, cancelAnimationFrame, tick } = setup(() => []);

    tick();
    connection.disconnect();

    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('returns an empty gamepad list when navigator.getGamepads is unavailable', () => {
    const { commands, tick } = setup(() => []);

    tick();

    expect(commands).toEqual([]);
  });
});
