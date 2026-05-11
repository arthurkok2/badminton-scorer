import { createGestureInterpreter } from './gestureInterpreter';

describe('gesture interpreter', () => {
  it('maps one click to point for Team A', () => {
    const commands: unknown[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command));

    interpreter.handlePress(0);
    interpreter.handleRelease(80);
    interpreter.flush(500);

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('maps double click to point for Team B', () => {
    const commands: unknown[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command));

    interpreter.handlePress(0);
    interpreter.handleRelease(70);
    interpreter.handlePress(140);
    interpreter.handleRelease(210);
    interpreter.flush(420);

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamB' }]);
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
    interpreter.handlePress(500);
    interpreter.handleRelease(560);
    interpreter.flush(970);

    expect(commands).toEqual(['POINT_TEAM', 'POINT_TEAM']);
  });

  it('dispatches a pending single click before a later hold dispatches undo', () => {
    const commands: string[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command.type));

    interpreter.handlePress(0);
    interpreter.handleRelease(80);
    interpreter.handlePress(500);
    interpreter.handleRelease(1200);
    interpreter.flush(1300);

    expect(commands).toEqual(['POINT_TEAM', 'UNDO']);
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

  it('does not flush a pending click from a duplicate press during the second click', () => {
    const commands: string[] = [];
    const interpreter = createGestureInterpreter((command) => commands.push(command.type));

    interpreter.handlePress(0);
    interpreter.handleRelease(80);
    interpreter.handlePress(150);
    interpreter.handlePress(270);
    interpreter.handleRelease(330);
    interpreter.flush(520);

    expect(commands).toEqual(['POINT_TEAM']);
  });
});
