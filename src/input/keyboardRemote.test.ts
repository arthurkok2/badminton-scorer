import { connectKeyboardRemote, isVolumeUpKeyEvent } from './keyboardRemote';
import type { AppCommand } from './commands';

describe('keyboard remote adapter', () => {
  it('recognizes standard and legacy volume-up key events', () => {
    expect(isVolumeUpKeyEvent(new KeyboardEvent('keydown', { key: 'AudioVolumeUp' }))).toBe(true);
    expect(isVolumeUpKeyEvent(new KeyboardEvent('keydown', { key: 'VolumeUp' }))).toBe(true);
    expect(isVolumeUpKeyEvent(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false);
  });

  it('routes volume-up keydown, keyup, and flush events through the gesture interpreter', () => {
    const target = new EventTarget();
    const commands: AppCommand[] = [];
    const intervalCallbacks: Array<() => void> = [];
    const timestamps = [0, 80, 260];

    connectKeyboardRemote({
      dispatch: (command) => commands.push(command),
      target,
      now: () => timestamps.shift() ?? 260,
      setInterval: (callback) => {
        intervalCallbacks.push(callback);
        return 7;
      },
      clearInterval: () => undefined,
    });

    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'AudioVolumeUp' }));
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    target.dispatchEvent(new KeyboardEvent('keyup', { key: 'AudioVolumeUp' }));
    intervalCallbacks[0]();

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('reports keyboard event details for remote diagnostics', () => {
    const target = new EventTarget();
    const diagnostics: Array<{
      type: string;
      key: string;
      code: string;
      keyCode: number;
      which: number;
      repeat: boolean;
    }> = [];

    connectKeyboardRemote({
      dispatch: () => undefined,
      target,
      onDiagnosticEvent: (event) => diagnostics.push(event),
    });

    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Camera',
        code: 'F24',
        keyCode: 135,
        which: 135,
        repeat: true,
      }),
    );

    expect(diagnostics).toEqual([
      {
        type: 'keydown',
        key: 'Camera',
        code: 'F24',
        keyCode: 135,
        which: 135,
        repeat: true,
      },
    ]);
  });

  it('ignores repeated volume-up keydown events from key auto-repeat', () => {
    const target = new EventTarget();
    const commands: AppCommand[] = [];
    const intervalCallbacks: Array<() => void> = [];
    const timestamps = [0, 80, 260];

    connectKeyboardRemote({
      dispatch: (command) => commands.push(command),
      target,
      now: () => timestamps.shift() ?? 260,
      setInterval: (callback) => {
        intervalCallbacks.push(callback);
        return 7;
      },
      clearInterval: () => undefined,
    });

    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'AudioVolumeUp' }));
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'AudioVolumeUp', repeat: true }));
    target.dispatchEvent(new KeyboardEvent('keyup', { key: 'AudioVolumeUp' }));
    intervalCallbacks[0]();

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('cleans up key listeners and the flush interval on disconnect', () => {
    const target = new EventTarget();
    const commands: AppCommand[] = [];
    const clearedIntervals: number[] = [];
    const connection = connectKeyboardRemote({
      dispatch: (command) => commands.push(command),
      target,
      setInterval: () => 42,
      clearInterval: (intervalId) => {
        clearedIntervals.push(intervalId);
      },
    });

    connection.disconnect();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'AudioVolumeUp' }));
    target.dispatchEvent(new KeyboardEvent('keyup', { key: 'AudioVolumeUp' }));

    expect(clearedIntervals).toEqual([42]);
    expect(commands).toEqual([]);
  });
});
