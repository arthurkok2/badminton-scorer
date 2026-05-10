import { createGestureInterpreter } from './gestureInterpreter';

describe('gesture interpreter', () => {
  it('maps one click to point for serving team', () => {
    const commands: string[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command.type));

    interpreter.handlePress(0);
    interpreter.handleRelease(80);
    interpreter.flush(260);

    expect(commands).toEqual(['POINT_SERVING']);
  });

  it('maps double click to point for receiving team', () => {
    const commands: string[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command.type));

    interpreter.handlePress(0);
    interpreter.handleRelease(70);
    interpreter.handlePress(140);
    interpreter.handleRelease(210);
    interpreter.flush(420);

    expect(commands).toEqual(['POINT_RECEIVING']);
  });

  it('maps hold to undo', () => {
    const commands: string[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command.type));

    interpreter.handlePress(0);
    interpreter.handleRelease(850);
    interpreter.flush(900);

    expect(commands).toEqual(['UNDO']);
  });

  it('maps two clicks outside the double-click window to two serving-team points', () => {
    const commands: string[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command.type));

    interpreter.handlePress(0);
    interpreter.handleRelease(80);
    interpreter.handlePress(300);
    interpreter.handleRelease(360);
    interpreter.flush(540);

    expect(commands).toEqual(['POINT_SERVING', 'POINT_SERVING']);
  });

  it('dispatches a pending single click before a later hold dispatches undo', () => {
    const commands: string[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command.type));

    interpreter.handlePress(0);
    interpreter.handleRelease(80);
    interpreter.handlePress(300);
    interpreter.handleRelease(1000);
    interpreter.flush(1100);

    expect(commands).toEqual(['POINT_SERVING', 'UNDO']);
  });

  it('ignores release without press', () => {
    const commands: string[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command.type));

    interpreter.handleRelease(80);
    interpreter.flush(260);

    expect(commands).toEqual([]);
  });

  it('ignores duplicate press while already pressed', () => {
    const commands: string[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command.type));

    interpreter.handlePress(0);
    interpreter.handlePress(400);
    interpreter.handleRelease(700);
    interpreter.flush(900);

    expect(commands).toEqual(['UNDO']);
  });
});
