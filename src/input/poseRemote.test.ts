// src/input/poseRemote.test.ts
import { describe, it, expect } from 'vitest';
import { classifyArm, classifyBothArms, createPoseInterpreter, detectGesture } from './poseRemote';
import type { AppCommand } from './commands';
import type { Landmark } from './poseRemote';

function lm(x: number, y: number): Landmark {
  return { x, y, z: 0, visibility: 1 };
}

// Landmark indices:
// 11: left shoulder, 13: left elbow, 15: left wrist, 23: left hip
// 12: right shoulder, 14: right elbow, 16: right wrist, 24: right hip

describe('classifyArm', () => {
  const hip = lm(0.5, 0.8);

  describe('horizontal_out', () => {
    it('classifies left arm extended leftward as horizontal_out', () => {
      const shoulder = lm(0.4, 0.5);
      const elbow = lm(0.3, 0.5);
      const wrist = lm(0.1, 0.5);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).toBe('horizontal_out');
    });

    it('classifies right arm extended rightward as horizontal_out', () => {
      const shoulder = lm(0.6, 0.5);
      const elbow = lm(0.7, 0.5);
      const wrist = lm(0.9, 0.5);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, false)).toBe('horizontal_out');
    });

    it('rejects when wrist Y is too far from shoulder Y', () => {
      const shoulder = lm(0.4, 0.5);
      const elbow = lm(0.3, 0.5);
      const wrist = lm(0.1, 0.65);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).not.toBe('horizontal_out');
    });

    it('rejects when wrist is not outward from elbow', () => {
      const shoulder = lm(0.4, 0.5);
      const elbow = lm(0.1, 0.5);
      const wrist = lm(0.3, 0.5);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).not.toBe('horizontal_out');
    });
  });

  describe('vertical_up', () => {
    it('classifies arm raised straight up as vertical_up', () => {
      const shoulder = lm(0.4, 0.5);
      const elbow = lm(0.4, 0.4);
      const wrist = lm(0.4, 0.2);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).toBe('vertical_up');
    });

    it('rejects when wrist is not above shoulder', () => {
      const shoulder = lm(0.4, 0.2);
      const elbow = lm(0.4, 0.3);
      const wrist = lm(0.4, 0.5);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).not.toBe('vertical_up');
    });

    it('rejects when wrist is too far horizontally from shoulder', () => {
      const shoulder = lm(0.4, 0.5);
      const elbow = lm(0.4, 0.4);
      const wrist = lm(0.7, 0.2);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).not.toBe('vertical_up');
    });
  });

  describe('neutral', () => {
    it('returns neutral when shoulder and hip are at same Y position', () => {
      const sameLevelHip = lm(0.5, 0.5);
      const shoulder = lm(0.4, 0.5);
      const elbow = lm(0.3, 0.4);
      const wrist = lm(0.1, 0.3);
      expect(classifyArm(shoulder, elbow, wrist, sameLevelHip, 0.5, true)).toBe('neutral');
    });

    it('returns neutral for arm at rest', () => {
      const shoulder = lm(0.4, 0.5);
      const elbow = lm(0.4, 0.6);
      const wrist = lm(0.4, 0.7);
      const bodyCenterX = 0.5;

      expect(classifyArm(shoulder, elbow, wrist, hip, bodyCenterX, true)).toBe('neutral');
    });
  });
});

describe('classifyBothArms', () => {
  it('classifies both arms from full landmarks array', () => {
    const landmarks: Landmark[] = new Array(33).fill(null).map(() => lm(0.5, 0.5));
    landmarks[11] = lm(0.3, 0.5);
    landmarks[13] = lm(0.15, 0.5);
    landmarks[15] = lm(0.05, 0.5);
    landmarks[23] = lm(0.3, 0.8);
    landmarks[12] = lm(0.7, 0.5);
    landmarks[14] = lm(0.7, 0.35);
    landmarks[16] = lm(0.7, 0.15);
    landmarks[24] = lm(0.7, 0.8);

    const result = classifyBothArms(landmarks);

    expect(result.left).toBe('horizontal_out');
    expect(result.right).toBe('vertical_up');
  });

  it('returns neutral for both when landmarks are missing (visibility < 0.5)', () => {
    const landmarks: Landmark[] = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }));
    landmarks[11] = { x: 0.3, y: 0.5, z: 0, visibility: 0.3 };
    landmarks[13] = { x: 0.15, y: 0.5, z: 0, visibility: 0.3 };
    landmarks[15] = { x: 0.05, y: 0.5, z: 0, visibility: 0.3 };

    const result = classifyBothArms(landmarks);

    expect(result.left).toBe('neutral');
    expect(result.right).toBe('neutral');
  });
});

describe('detectGesture', () => {
  it('returns teamA for left horizontal_out + right vertical_up', () => {
    expect(detectGesture('horizontal_out', 'vertical_up')).toBe('teamA');
  });

  it('returns teamB for right horizontal_out + left vertical_up', () => {
    expect(detectGesture('vertical_up', 'horizontal_out')).toBe('teamB');
  });

  it('returns undo for both vertical_up', () => {
    expect(detectGesture('vertical_up', 'vertical_up')).toBe('undo');
  });

  it('returns null for both neutral', () => {
    expect(detectGesture('neutral', 'neutral')).toBeNull();
  });

  it('returns null for both horizontal_out (ambiguous)', () => {
    expect(detectGesture('horizontal_out', 'horizontal_out')).toBeNull();
  });
});

function fullBodyLandmarks(pose: {
  leftWrist?: Landmark;
  leftElbow?: Landmark;
  leftShoulder?: Landmark;
  rightWrist?: Landmark;
  rightElbow?: Landmark;
  rightShoulder?: Landmark;
}): Landmark[] {
  const arr: Landmark[] = new Array(33).fill(null).map(() => lm(0.5, 0.5));
  arr[23] = lm(0.3, 0.8);
  arr[24] = lm(0.7, 0.8);
  arr[11] = pose.leftShoulder ?? lm(0.4, 0.5);
  arr[12] = pose.rightShoulder ?? lm(0.6, 0.5);
  arr[13] = pose.leftElbow ?? lm(0.4, 0.6);
  arr[14] = pose.rightElbow ?? lm(0.6, 0.6);
  arr[15] = pose.leftWrist ?? lm(0.4, 0.7);
  arr[16] = pose.rightWrist ?? lm(0.6, 0.7);
  return arr;
}

function teamALandmarks(): Landmark[] {
  return fullBodyLandmarks({
    leftWrist: lm(0.05, 0.5),
    leftElbow: lm(0.2, 0.5),
    leftShoulder: lm(0.35, 0.5),
    rightWrist: lm(0.65, 0.15),
    rightElbow: lm(0.65, 0.3),
    rightShoulder: lm(0.65, 0.5),
  });
}

function teamBLandmarks(): Landmark[] {
  return fullBodyLandmarks({
    leftWrist: lm(0.35, 0.15),
    leftElbow: lm(0.35, 0.3),
    leftShoulder: lm(0.35, 0.5),
    rightWrist: lm(0.95, 0.5),
    rightElbow: lm(0.8, 0.5),
    rightShoulder: lm(0.65, 0.5),
  });
}

function undoLandmarks(): Landmark[] {
  return fullBodyLandmarks({
    leftWrist: lm(0.35, 0.15),
    leftElbow: lm(0.35, 0.3),
    leftShoulder: lm(0.35, 0.5),
    rightWrist: lm(0.65, 0.15),
    rightElbow: lm(0.65, 0.3),
    rightShoulder: lm(0.65, 0.5),
  });
}

describe('createPoseInterpreter', () => {
  it('dispatches POINT_TEAM teamA after 5 consecutive frames of the teamA gesture', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    const landmarks = teamALandmarks();

    for (let i = 0; i < 4; i++) {
      interpreter.processLandmarks([landmarks]);
    }
    expect(commands).toEqual([]);

    interpreter.processLandmarks([landmarks]);
    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('dispatches POINT_TEAM teamB after 5 consecutive frames', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    const landmarks = teamBLandmarks();

    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([landmarks]);
    }

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamB' }]);
  });

  it('dispatches UNDO after 5 consecutive frames', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    const landmarks = undoLandmarks();

    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([landmarks]);
    }

    expect(commands).toEqual([{ type: 'UNDO' }]);
  });

  it('resets debounce counter when gesture changes mid-stream', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    for (let i = 0; i < 2; i++) {
      interpreter.processLandmarks([teamALandmarks()]);
    }

    interpreter.processLandmarks([[lm(0.5, 0.7)]]);

    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamALandmarks()]);
    }

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('respects 2-second cooldown after dispatch', () => {
    const commands: AppCommand[] = [];
    let currentTime = 0;
    const interpreter = createPoseInterpreter({
      dispatch: (c) => commands.push(c),
      now: () => currentTime,
    });

    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamALandmarks()]);
    }
    expect(commands).toHaveLength(1);

    currentTime = 500;
    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamBLandmarks()]);
    }
    expect(commands).toHaveLength(1);

    currentTime = 2500;
    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamBLandmarks()]);
    }
    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual({ type: 'POINT_TEAM', teamId: 'teamB' });
  });

  it('first person in frame wins — second person ignored', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamALandmarks(), teamBLandmarks()]);
    }

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('reset clears internal state', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    for (let i = 0; i < 3; i++) {
      interpreter.processLandmarks([teamALandmarks()]);
    }

    interpreter.reset();

    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamALandmarks()]);
    }

    expect(commands).toEqual([{ type: 'POINT_TEAM', teamId: 'teamA' }]);
  });

  it('does not dispatch when no person has a valid gesture', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    const neutral = [lm(0.5, 0.7)];

    for (let i = 0; i < 10; i++) {
      interpreter.processLandmarks([neutral]);
    }

    expect(commands).toEqual([]);
  });

  it('skips frame when landmarks have insufficient keypoints', () => {
    const commands: AppCommand[] = [];
    const interpreter = createPoseInterpreter({ dispatch: (c) => commands.push(c) });

    const incomplete: Landmark[] = new Array(12).fill(null).map(() => lm(0.5, 0.5));

    for (let i = 0; i < 10; i++) {
      interpreter.processLandmarks([incomplete]);
    }

    expect(commands).toEqual([]);
  });

  it('destroy clears cooldown and resets state', () => {
    const commands: AppCommand[] = [];
    let currentTime = 0;
    const interpreter = createPoseInterpreter({
      dispatch: (c) => commands.push(c),
      now: () => currentTime,
    });

    // Dispatch a command (sets cooldown)
    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamALandmarks()]);
    }
    expect(commands).toHaveLength(1);

    // Still within cooldown — gestures should be ignored
    currentTime = 500;
    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamBLandmarks()]);
    }
    expect(commands).toHaveLength(1);

    // Destroy clears cooldown
    interpreter.destroy();

    // Same interpreter, same time — should now dispatch (cooldown cleared)
    // Need 5 frames of the new gesture
    for (let i = 0; i < 5; i++) {
      interpreter.processLandmarks([teamBLandmarks()]);
    }

    expect(commands).toHaveLength(2);
    expect(commands[1]).toEqual({ type: 'POINT_TEAM', teamId: 'teamB' });
  });
});
