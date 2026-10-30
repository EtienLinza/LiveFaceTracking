import { describe, expect, it } from 'vitest';
import { LandmarkSmoother, OneEuroFilter, PoseSmoother } from './smoothing';

/** One frame at the desktop 30 fps target. */
const FRAME_MS = 1000 / 30;

describe('OneEuroFilter', () => {
  it('passes the first sample through unchanged', () => {
    expect(new OneEuroFilter({ minCutoff: 2 }).filter(42, 0)).toBe(42);
  });

  it('holds a constant signal exactly', () => {
    const filter = new OneEuroFilter({ minCutoff: 2 });

    let value = 0;
    for (let frame = 0; frame < 30; frame += 1) {
      value = filter.filter(5, frame * FRAME_MS);
    }

    expect(value).toBe(5);
  });

  it('attenuates a one-frame spike instead of drawing it', () => {
    const filter = new OneEuroFilter({ minCutoff: 1, derivativeCutoff: 1 });

    filter.filter(0, 0);
    const atSpike = filter.filter(10, FRAME_MS);
    const afterSpike = filter.filter(0, 2 * FRAME_MS);

    expect(atSpike).toBeGreaterThan(0);
    expect(atSpike).toBeLessThan(3);
    expect(afterSpike).toBeLessThan(atSpike);
    expect(afterSpike).toBeGreaterThanOrEqual(0);
  });

  it('converges to a sustained step', () => {
    const filter = new OneEuroFilter({ minCutoff: 2 });

    for (let frame = 0; frame < 30; frame += 1) {
      filter.filter(0, frame * FRAME_MS);
    }

    let value = 0;
    for (let frame = 30; frame < 120; frame += 1) {
      value = filter.filter(10, frame * FRAME_MS);
    }

    expect(value).toBeGreaterThan(9.5);
  });

  it('follows a fast change sooner when beta is set', () => {
    const resting = new OneEuroFilter({ minCutoff: 1, beta: 0 });
    const moving = new OneEuroFilter({ minCutoff: 1, beta: 0.2 });

    resting.filter(0, 0);
    moving.filter(0, 0);

    expect(moving.filter(20, FRAME_MS)).toBeGreaterThan(resting.filter(20, FRAME_MS));
  });

  it('restarts from the first sample after reset', () => {
    const filter = new OneEuroFilter({ minCutoff: 1 });

    for (let frame = 0; frame < 10; frame += 1) {
      filter.filter(frame, frame * FRAME_MS);
    }
    filter.reset();

    expect(filter.filter(100, 10 * FRAME_MS)).toBe(100);
  });

  it('keeps its last output when a non-finite sample arrives', () => {
    const filter = new OneEuroFilter();

    filter.filter(7, 0);

    expect(filter.filter(Number.NaN, FRAME_MS)).toBe(7);
  });
});

describe('LandmarkSmoother', () => {
  it('passes the first frame through and preserves the point count', () => {
    const smoother = new LandmarkSmoother({ minCutoff: 3 });

    const points = smoother.smooth(
      [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
      0,
    );

    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({ x: 10, y: 20 });
    expect(points[1]).toEqual({ x: 30, y: 40 });
  });

  it('shrinks frame-to-frame jitter around a fixed position', () => {
    const smoother = new LandmarkSmoother({ minCutoff: 3 });
    // The detector wobbling ±8 px around a resting landmark.
    const samples = [100, 108, 92, 108, 92, 108, 92, 108, 92, 108];

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    samples.forEach((x, frame) => {
      const [point] = smoother.smooth([{ x, y: 0 }], frame * FRAME_MS);
      min = Math.min(min, point.x);
      max = Math.max(max, point.x);
    });

    // The raw swing is 16 px; the smoothed signal must stay well inside it and
    // still be centred on the true position.
    expect(max - min).toBeLessThan(16);
    expect((min + max) / 2).toBeGreaterThan(99);
    expect((min + max) / 2).toBeLessThan(101);
  });

  it('snaps to the new position after reset', () => {
    const smoother = new LandmarkSmoother({ minCutoff: 3 });

    smoother.smooth([{ x: 0, y: 0 }], 0);
    smoother.reset();

    expect(smoother.smooth([{ x: 500, y: 0 }], FRAME_MS)[0].x).toBe(500);
  });
});

describe('PoseSmoother', () => {
  it('smooths each angle independently and snaps after reset', () => {
    const smoother = new PoseSmoother({ minCutoff: 1 });

    expect(smoother.next({ yaw: 10, pitch: -5, roll: 2 }, 0)).toEqual({
      yaw: 10,
      pitch: -5,
      roll: 2,
    });

    const moved = smoother.next({ yaw: 20, pitch: -5, roll: 2 }, FRAME_MS);

    expect(moved.yaw).toBeGreaterThan(10);
    expect(moved.yaw).toBeLessThan(20);
    expect(moved.pitch).toBeCloseTo(-5);
    expect(moved.roll).toBeCloseTo(2);

    smoother.reset();

    expect(smoother.next({ yaw: 90, pitch: 0, roll: 0 }, 10 * FRAME_MS).yaw).toBe(90);
  });
});
