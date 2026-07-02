import { describe, it, expect } from 'vitest';
import { createPoseInterpreter } from './poseRemote';
import type { AppCommand } from './commands';
import type { DetectionResult } from '../hooks/usePoseDetection';

function result(gestures: { categoryName: string; score: number }[][], handedness: string[][]): DetectionResult {
  return {
    gestures,
    handedness: handedness.map((h) => h.map((c) => ({ categoryName: c, score: 1 }))),
    handLandmarks: [],
  };
}

function leftPalm(): DetectionResult {
  return result([[{ categoryName: 'Open_Palm', score: 0.9 }]], [['Left']]);
}

function rightPalm(): DetectionResult {
  return result([[{ categoryName: 'Open_Palm', score: 0.9 }]], [['Right']]);
}

function bothPalm(): DetectionResult {
  return result([
    [{ categoryName: 'Open_Palm', score: 0.9 }],
    [{ categoryName: 'Open_Palm', score: 0.9 }],
  ], [['Left'], ['Right']]);
}

function noHands(): DetectionResult {
  return { gestures: [], handedness: [], handLandmarks: [] };
}

function closedFist(): DetectionResult {
  return result([[{ categoryName: 'Closed_Fist', score: 0.9 }]], [['Left']]);
}

describe('createPoseInterpreter', () => {
  it('dispatches POINT_TEAM teamA after 10 frames of left palm', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    for (let i = 0; i < 9; i++) interpreter.processResult(leftPalm());
    expect(commands).toEqual([]);

    interpreter.processResult(leftPalm());
    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('dispatches POINT_TEAM teamB after 10 frames of right palm', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    for (let i = 0; i < 10; i++) interpreter.processResult(rightPalm());
    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamB' }]);
  });

  it('dispatches UNDO after 10 frames of both palms', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    for (let i = 0; i < 10; i++) interpreter.processResult(bothPalm());
    expect(commands).toEqual([{ type: 'UNDO' }]);
  });

  it('resets debounce when gesture changes mid-stream', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    for (let i = 0; i < 2; i++) interpreter.processResult(leftPalm());
    interpreter.processResult(noHands());
    for (let i = 0; i < 10; i++) interpreter.processResult(leftPalm());

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('respects 2-second cooldown', () => {
    const commands: AppCommand[] = [];
    let t = 0;
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c), now: () => t });

    for (let i = 0; i < 10; i++) interpreter.processResult(leftPalm());
    expect(commands).toHaveLength(1);

    t = 500;
    for (let i = 0; i < 10; i++) interpreter.processResult(rightPalm());
    expect(commands).toHaveLength(1);

    t = 2500;
    for (let i = 0; i < 10; i++) interpreter.processResult(rightPalm());
    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual({ type: 'POINT_TEAM', teamId: 'teamB' });
  });

  it('ignores low confidence gestures', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    const lowConf = result([[{ categoryName: 'Open_Palm', score: 0.5 }]], [['Left']]);
    for (let i = 0; i < 15; i++) interpreter.processResult(lowConf);
    expect(commands).toEqual([]);
  });

  it('ignores non-Open_Palm gestures', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    for (let i = 0; i < 15; i++) interpreter.processResult(closedFist());
    expect(commands).toEqual([]);
  });

  it('reset clears internal state', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    for (let i = 0; i < 3; i++) interpreter.processResult(leftPalm());
    interpreter.reset();
    for (let i = 0; i < 10; i++) interpreter.processResult(leftPalm());

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('does not dispatch with no hands', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    for (let i = 0; i < 20; i++) interpreter.processResult(noHands());
    expect(commands).toEqual([]);
  });

  it('destroy clears cooldown and resets state', () => {
    const commands: AppCommand[] = [];
    let t = 0;
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c), now: () => t });

    for (let i = 0; i < 10; i++) interpreter.processResult(leftPalm());
    expect(commands).toHaveLength(1);

    t = 500;
    for (let i = 0; i < 10; i++) interpreter.processResult(rightPalm());
    expect(commands).toHaveLength(1);

    interpreter.destroy();
    for (let i = 0; i < 10; i++) interpreter.processResult(rightPalm());

    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual({ type: 'POINT_TEAM', teamId: 'teamB' });
  });
});
