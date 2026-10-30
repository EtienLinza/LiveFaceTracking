import { describe, expect, it } from 'vitest';
import {
  estimateHeadPoseFromPoints,
  formatTime,
  offsetHeadPose,
  type HeadPosePoints,
} from './utils';

const SYMMETRIC_FACE: HeadPosePoints = {
  leftEye: { x: 100, y: 100 },
  rightEye: { x: 200, y: 100 },
  nose: { x: 150, y: 150 },
  chin: { x: 150, y: 250 },
};

describe('formatTime', () => {
  it('formats milliseconds as minutes and seconds', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65_000)).toBe('1:05');
    expect(formatTime(3_599_000)).toBe('59:59');
  });
});

describe('estimateHeadPoseFromPoints', () => {
  it('reads a level, centred face as neutral yaw and roll', () => {
    const pose = estimateHeadPoseFromPoints(SYMMETRIC_FACE);

    expect(pose.yaw).toBeCloseTo(0);
    expect(pose.roll).toBeCloseTo(0);
  });

  it('reports a non-zero pitch for a neutral pose, which is why callers use a baseline', () => {
    // The nose tip sits between the eye line and the chin, so a resting head
    // does not read 0 degrees. This is the documented bias of the heuristic.
    expect(estimateHeadPoseFromPoints(SYMMETRIC_FACE).pitch).toBeCloseTo(10);
  });

  it('turns the face right when the nose moves right of the eye midpoint', () => {
    const pose = estimateHeadPoseFromPoints({
      ...SYMMETRIC_FACE,
      nose: { x: 175, y: 150 },
    });

    expect(pose.yaw).toBeGreaterThan(0);
  });

  it('reports roll when the eye line is tilted', () => {
    const pose = estimateHeadPoseFromPoints({
      ...SYMMETRIC_FACE,
      rightEye: { x: 200, y: 120 },
    });

    expect(pose.roll).toBeGreaterThan(0);
  });

  it('stays finite when the eye points collapse to a single pixel', () => {
    const pose = estimateHeadPoseFromPoints({
      ...SYMMETRIC_FACE,
      rightEye: { x: 100, y: 100 },
    });

    expect(Number.isFinite(pose.yaw)).toBe(true);
    expect(Number.isFinite(pose.pitch)).toBe(true);
    expect(Number.isFinite(pose.roll)).toBe(true);
  });
});

describe('offsetHeadPose', () => {
  it('returns the pose unchanged without a baseline', () => {
    const pose = { yaw: 4, pitch: 14, roll: -2 };

    expect(offsetHeadPose(pose, null)).toEqual(pose);
  });

  it('subtracts the baseline so a resting pose reads near zero', () => {
    const baseline = { yaw: 0, pitch: 14, roll: 0 };
    const pose = { yaw: 5, pitch: 15, roll: -3 };

    expect(offsetHeadPose(pose, baseline)).toEqual({ yaw: 5, pitch: 1, roll: -3 });
  });
});
