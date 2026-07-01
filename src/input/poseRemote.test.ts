// src/input/poseRemote.test.ts
import { describe, it, expect } from 'vitest';
import { classifyArm } from './poseRemote';
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
