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
});
