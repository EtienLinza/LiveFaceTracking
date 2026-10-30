import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFaceDataHistory, useFrameMetrics, useLocalStorage } from './index';
import type { FaceData } from '../types';

const row = (timestamp: number): FaceData => ({
  timestamp,
  nose_x: 1,
  nose_y: 2,
  nose_z: 0,
  left_eye_x: 0,
  left_eye_y: 0,
  left_eye_z: 0,
  right_eye_x: 0,
  right_eye_y: 0,
  right_eye_z: 0,
  chin_x: 0,
  chin_y: 0,
  chin_z: 0,
  mouth_x: 0,
  mouth_y: 0,
  mouth_z: 0,
});

describe('useFrameMetrics', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports frames per second measured from timestamps', () => {
    const { result } = renderHook(() => useFrameMetrics());

    // Metrics publish at most twice a second, so run long enough to settle.
    act(() => {
      for (let i = 0; i < 60; i += 1) {
        result.current.recordFrame(10);
        vi.advanceTimersByTime(33);
      }
    });

    // 60 frames spread over two seconds is ~30 fps. The old implementation
    // reported the sample count, so any 60+ frames read as 60 fps.
    expect(result.current.metrics.fps).toBeGreaterThanOrEqual(28);
    expect(result.current.metrics.fps).toBeLessThanOrEqual(31);
  });

  it('keeps counting total frames beyond the one-second FPS window', () => {
    const { result } = renderHook(() => useFrameMetrics());

    act(() => {
      for (let i = 0; i < 100; i += 1) {
        result.current.recordFrame(5);
        vi.advanceTimersByTime(50);
      }
    });

    // One more frame past the publish interval, so the latest counters show up.
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.recordFrame(5);
    });

    // The FPS window only covers the last second, but the frame counter keeps
    // the whole session instead of stopping at the history cap.
    expect(result.current.metrics.totalFrames).toBe(101);
    expect(result.current.metrics.elapsedMs).toBeGreaterThanOrEqual(5000);
  });

  it('averages processing time and clears everything on reset', () => {
    const { result } = renderHook(() => useFrameMetrics());

    act(() => {
      for (let i = 0; i < 20; i += 1) {
        result.current.recordFrame(12.5);
        vi.advanceTimersByTime(100);
      }
    });

    expect(result.current.metrics.processingMs).toBeCloseTo(12.5);

    act(() => result.current.reset());

    expect(result.current.metrics).toEqual({
      fps: 0,
      processingMs: 0,
      totalFrames: 0,
      elapsedMs: 0,
    });
  });
});

describe('useFaceDataHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes a capped display window while keeping the whole session', () => {
    const { result } = renderHook(() => useFaceDataHistory(5, 200));

    act(() => {
      for (let i = 0; i < 12; i += 1) {
        result.current.addData(row(i * 100));
        vi.advanceTimersByTime(200);
      }
    });

    expect(result.current.history).toHaveLength(5);
    expect(result.current.history[0].timestamp).toBe(1100);
    expect(result.current.getSessionData()).toHaveLength(12);
  });

  it('describes the whole session in its stats, not the display window', () => {
    const { result } = renderHook(() => useFaceDataHistory(5, 200));

    act(() => {
      for (let i = 0; i < 12; i += 1) {
        result.current.addData(row(i * 100));
        vi.advanceTimersByTime(200);
      }
    });

    const stats = result.current.getStats();

    expect(stats.totalFrames).toBe(12);
    expect(stats.sessionDuration).toBe(1100);
    expect(stats.averageFps).toBeCloseTo(10);
    expect(stats.startTime).toBe(0);
    expect(stats.endTime).toBe(1100);
  });

  it('reports 0 fps for a single sample instead of Infinity', () => {
    const { result } = renderHook(() => useFaceDataHistory());

    act(() => {
      result.current.addData(row(1000));
      vi.advanceTimersByTime(200);
    });

    const stats = result.current.getStats();

    expect(stats.totalFrames).toBe(1);
    expect(stats.averageFps).toBe(0);
    expect(Number.isFinite(JSON.parse(JSON.stringify(stats)).averageFps)).toBe(true);
  });

  it('clears both the window and the session', () => {
    const { result } = renderHook(() => useFaceDataHistory(5, 200));

    act(() => {
      result.current.addData(row(0));
      vi.advanceTimersByTime(200);
    });
    act(() => result.current.clear());

    expect(result.current.history).toHaveLength(0);
    expect(result.current.getSessionData()).toHaveLength(0);
    expect(result.current.getStats().totalFrames).toBe(0);
  });
});

describe('useLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads an existing value on mount', () => {
    window.localStorage.setItem('stored-flag', 'false');

    const { result } = renderHook(() => useLocalStorage('stored-flag', true));

    expect(result.current[0]).toBe(false);
  });

  it('applies two functional updates in the same tick without stale state', () => {
    const { result } = renderHook(() => useLocalStorage('counter', 0));

    act(() => {
      result.current[1](value => value + 1);
      result.current[1](value => value + 1);
    });

    expect(result.current[0]).toBe(2);
    expect(window.localStorage.getItem('counter')).toBe('2');
  });
});
