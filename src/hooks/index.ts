// Custom React hooks for face tracking
import { useCallback, useRef, useEffect, useState } from 'react';
import { FaceData, SessionStats } from '../types';

/** How often the metric cards are allowed to re-render. */
const METRICS_UPDATE_INTERVAL_MS = 500;
/** FPS is the number of completed frames inside this window. */
const FPS_WINDOW_MS = 1000;
/** Processing times kept for the average shown in the UI. */
const PROCESSING_SAMPLES = 120;

export interface FrameMetrics {
  fps: number;
  processingMs: number;
  totalFrames: number;
  elapsedMs: number;
}

const EMPTY_METRICS: FrameMetrics = { fps: 0, processingMs: 0, totalFrames: 0, elapsedMs: 0 };

/**
 * Hook for frame-loop performance metrics.
 *
 * FPS is measured from frame-completion timestamps inside a one-second window,
 * so it reports the rate the loop actually achieves. `totalFrames` counts the
 * whole session and keeps growing after the chart's history window is full.
 * `processingMs` covers inference plus drawing only — camera capture latency is
 * not included.
 */
export const useFrameMetrics = () => {
  const [metrics, setMetrics] = useState<FrameMetrics>(EMPTY_METRICS);

  const stampsRef = useRef<number[]>([]);
  const processingRef = useRef<number[]>([]);
  const totalFramesRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);

  const recordFrame = useCallback((processingMs: number) => {
    const now = performance.now();
    startedAtRef.current ??= now;

    const stamps = stampsRef.current;
    stamps.push(now);
    while (stamps.length > 0 && now - stamps[0] > FPS_WINDOW_MS) {
      stamps.shift();
    }

    const processing = processingRef.current;
    processing.push(processingMs);
    if (processing.length > PROCESSING_SAMPLES) {
      processing.shift();
    }

    totalFramesRef.current += 1;

    if (now - lastUpdateRef.current < METRICS_UPDATE_INTERVAL_MS) return;
    lastUpdateRef.current = now;

    const averageProcessing =
      processing.reduce((sum, value) => sum + value, 0) / processing.length;

    setMetrics({
      fps: stamps.length,
      processingMs: Math.round(averageProcessing * 10) / 10,
      totalFrames: totalFramesRef.current,
      elapsedMs: Math.round(now - startedAtRef.current),
    });
  }, []);

  const reset = useCallback(() => {
    stampsRef.current = [];
    processingRef.current = [];
    totalFramesRef.current = 0;
    startedAtRef.current = null;
    lastUpdateRef.current = 0;
    setMetrics(EMPTY_METRICS);
  }, []);

  return { metrics, recordFrame, reset };
};

/**
 * Hook for managing face tracking data history.
 *
 * Rows are collected in a ref on every detected frame, but React state is only
 * published every `syncIntervalMs`. Re-rendering the tree at the detection rate
 * is what made the UI stutter on phones; the panel only needs a few updates a
 * second to look live.
 *
 * `history` is the newest-first display window capped at `maxSize`; the full
 * session is kept separately (oldest first, outside React state) so an export
 * covers everything captured since Start rather than the last few seconds.
 */
export const useFaceDataHistory = (maxSize: number = 100, syncIntervalMs = 200) => {
  const [history, setHistory] = useState<FaceData[]>([]);
  const windowRef = useRef<FaceData[]>([]);
  const sessionRef = useRef<FaceData[]>([]);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingSync = useCallback(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  }, []);

  const addData = useCallback((data: FaceData) => {
    sessionRef.current.push(data);
    windowRef.current = [data, ...windowRef.current].slice(0, maxSize);

    if (syncTimerRef.current) return;
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      setHistory(windowRef.current);
    }, syncIntervalMs);
  }, [maxSize, syncIntervalMs]);

  /** Whole-session rows, oldest first. */
  const getSessionData = useCallback(() => sessionRef.current, []);

  const getStats = useCallback((): SessionStats => {
    const rows = sessionRef.current;
    if (rows.length === 0) {
      return {
        totalFrames: 0,
        averageFps: 0,
        sessionDuration: 0,
        startTime: null,
        endTime: null,
      };
    }

    const startTime = rows[0].timestamp;
    const endTime = rows[rows.length - 1].timestamp;
    const sessionDuration = endTime - startTime;

    return {
      totalFrames: rows.length,
      // Guarded: a single sample has no interval, so the rate is unknown (0)
      // rather than Infinity, which JSON.stringify would turn into null.
      averageFps: sessionDuration > 0 ? ((rows.length - 1) / sessionDuration) * 1000 : 0,
      sessionDuration,
      startTime,
      endTime,
    };
  }, []);

  const clear = useCallback(() => {
    cancelPendingSync();
    windowRef.current = [];
    sessionRef.current = [];
    setHistory([]);
  }, [cancelPendingSync]);

  useEffect(() => cancelPendingSync, [cancelPendingSync]);

  return { history, addData, getSessionData, getStats, clear };
};

/**
 * Hook for storing state in localStorage.
 */
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // The updater form of setState is used so two quick updates in the same tick
  // both see the latest value instead of the `storedValue` of this render.
  const setValue = useCallback((value: T | ((previous: T) => T)) => {
    setStoredValue(previous => {
      const next = typeof value === 'function' ? (value as (previous: T) => T)(previous) : value;

      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(next));
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }

      return next;
    });
  }, [key]);

  return [storedValue, setValue] as const;
};
