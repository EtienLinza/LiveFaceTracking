/**
 * Time-aware one-euro filters for the tracking loop's *display* path.
 *
 * Raw landmarks and pose angles jitter from frame to frame — the mesh is
 * re-estimated per frame, so a resting head still moves by a few pixels. A
 * fixed low-pass would either leave the jitter or lag behind real movement.
 * The one-euro filter (Casiez, Roussel & Vogel, CHI 2012) raises its cutoff
 * with the measured speed: a slow drift is smoothed heavily, while a real head
 * turn is followed almost immediately.
 *
 * Only what is drawn on the overlay is filtered. The rows recorded for the
 * chart, the metric cards and the JSON export stay raw.
 */
import type { HeadPose } from '../types';

export interface OneEuroConfig {
  /** Base cutoff in Hz. Lower means smoother while the signal is at rest. */
  minCutoff?: number;
  /** Cutoff increase per unit of speed (deg/s for angles, px/s for points). */
  beta?: number;
  /** Cutoff of the internal speed estimate, in Hz. */
  derivativeCutoff?: number;
}

const DEFAULT_CONFIG: Required<OneEuroConfig> = {
  minCutoff: 1,
  beta: 0,
  derivativeCutoff: 1,
};

/** Guards a zero or negative delta (two samples in the same tick). */
const MIN_DT_SECONDS = 1 / 240;
/** A long gap is a dropout, not a slow signal: collapse the filter instead of lagging. */
const MAX_DT_SECONDS = 0.25;

/** First-order exponential smoothing factor for a cutoff (Hz) and a timestep. */
const smoothingAlpha = (cutoff: number, dtSeconds: number): number => {
  const timeConstant = 1 / (2 * Math.PI * Math.max(cutoff, 0.0001));
  return 1 / (1 + timeConstant / dtSeconds);
};

/**
 * One-euro low-pass filter over a scalar signal sampled at irregular times.
 * The first sample (and the first after `reset`) passes through unchanged.
 */
export class OneEuroFilter {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly derivativeCutoff: number;

  private lastValue: number | null = null;
  private lastTimestamp: number | null = null;
  private output: number | null = null;
  private speed = 0;

  constructor({
    minCutoff = DEFAULT_CONFIG.minCutoff,
    beta = DEFAULT_CONFIG.beta,
    derivativeCutoff = DEFAULT_CONFIG.derivativeCutoff,
  }: OneEuroConfig = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.derivativeCutoff = derivativeCutoff;
  }

  filter(value: number, timestampMs: number): number {
    // A non-finite sample would poison the filter for the rest of the session.
    if (!Number.isFinite(value)) return this.output ?? 0;

    if (this.output === null || this.lastValue === null || this.lastTimestamp === null) {
      this.lastValue = value;
      this.lastTimestamp = timestampMs;
      this.output = value;
      this.speed = 0;
      return value;
    }

    const dtSeconds = Math.min(
      Math.max((timestampMs - this.lastTimestamp) / 1000, MIN_DT_SECONDS),
      MAX_DT_SECONDS,
    );

    const rawSpeed = (value - this.lastValue) / dtSeconds;
    this.speed += smoothingAlpha(this.derivativeCutoff, dtSeconds) * (rawSpeed - this.speed);

    const cutoff = this.minCutoff + this.beta * Math.abs(this.speed);
    this.output += smoothingAlpha(cutoff, dtSeconds) * (value - this.output);

    this.lastValue = value;
    this.lastTimestamp = timestampMs;
    return this.output;
  }

  reset(): void {
    this.lastValue = null;
    this.lastTimestamp = null;
    this.output = null;
    this.speed = 0;
  }
}

/** Smoothes the three head-orientation angles independently. */
export class PoseSmoother {
  private readonly yaw: OneEuroFilter;
  private readonly pitch: OneEuroFilter;
  private readonly roll: OneEuroFilter;

  constructor(config?: OneEuroConfig) {
    this.yaw = new OneEuroFilter(config);
    this.pitch = new OneEuroFilter(config);
    this.roll = new OneEuroFilter(config);
  }

  next(pose: HeadPose, timestampMs: number): HeadPose {
    return {
      yaw: this.yaw.filter(pose.yaw, timestampMs),
      pitch: this.pitch.filter(pose.pitch, timestampMs),
      roll: this.roll.filter(pose.roll, timestampMs),
    };
  }

  reset(): void {
    this.yaw.reset();
    this.pitch.reset();
    this.roll.reset();
  }
}

export interface SmoothedPoint {
  x: number;
  y: number;
}

/**
 * Smooths every landmark position, keeping a filter per mesh index so the same
 * point is compared across frames. The output buffer is reused between frames —
 * callers draw it immediately, they must not keep it past the next call.
 */
export class LandmarkSmoother {
  private readonly config: OneEuroConfig;
  private readonly filters: Array<{ x: OneEuroFilter; y: OneEuroFilter } | undefined> = [];
  private readonly output: SmoothedPoint[] = [];

  constructor(config: OneEuroConfig = {}) {
    this.config = config;
  }

  smooth(points: readonly SmoothedPoint[], timestampMs: number): readonly SmoothedPoint[] {
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      let filters = this.filters[index];
      if (!filters) {
        filters = { x: new OneEuroFilter(this.config), y: new OneEuroFilter(this.config) };
        this.filters[index] = filters;
      }

      const smoothed = this.output[index] ?? (this.output[index] = { x: 0, y: 0 });
      smoothed.x = filters.x.filter(point.x, timestampMs);
      smoothed.y = filters.y.filter(point.y, timestampMs);
    }

    this.output.length = points.length;
    return this.output;
  }

  reset(): void {
    this.filters.length = 0;
    this.output.length = 0;
  }
}
