// Custom React hooks for face tracking
import { useCallback, useRef, useEffect, useState } from 'react';
import { FaceData, TrackingStats } from '../types';

/**
 * Hook for managing frame processing performance metrics
 */
export const useFrameMetrics = () => {
  const [metrics, setMetrics] = useState({
    fps: 0,
    avgLatency: 0,
    totalFrames: 0
  });
  
  const frameTimesRef = useRef<number[]>([]);
  const frameCountRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());

  const recordFrame = useCallback((latency: number) => {
    frameTimesRef.current.push(latency);
    
    // Keep only last 60 frames for FPS calculation
    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift();
    }
    
    frameCountRef.current++;
    
    // Update metrics every second
    const now = Date.now();
    if (now - lastUpdateRef.current >= 1000) {
      const avgLatency = frameTimesRef.current.length > 0
        ? frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length
        : 0;
      
      setMetrics({
        fps: frameTimesRef.current.length,
        avgLatency: Math.round(avgLatency * 100) / 100,
        totalFrames: frameCountRef.current
      });
      
      lastUpdateRef.current = now;
    }
  }, []);

  const reset = useCallback(() => {
    frameTimesRef.current = [];
    frameCountRef.current = 0;
    lastUpdateRef.current = Date.now();
  }, []);

  return { metrics, recordFrame, reset };
};

/**
 * Hook for managing face tracking data history
 */
export const useFaceDataHistory = (maxSize: number = 100) => {
  const [history, setHistory] = useState<FaceData[]>([]);
  const historyRef = useRef<FaceData[]>([]);

  const addData = useCallback((data: FaceData) => {
    historyRef.current = [data, ...historyRef.current].slice(0, maxSize);
    setHistory([...historyRef.current]);
  }, [maxSize]);

  const getLatest = useCallback(() => historyRef.current[0], []);

  const getStats = useCallback((): TrackingStats => {
    if (historyRef.current.length === 0) {
      return { totalFrames: 0, averageFps: 0, averageLatency: 0, facesDetected: 0, sessionDuration: 0 };
    }

    const timestamps = historyRef.current.map(d => d.timestamp);
    const duration = timestamps[0] - timestamps[timestamps.length - 1];
    
    return {
      totalFrames: historyRef.current.length,
      averageFps: (historyRef.current.length / duration) * 1000,
      averageLatency: 0, // Would need to track this separately
      facesDetected: historyRef.current.length,
      sessionDuration: duration
    };
  }, []);

  const clear = useCallback(() => {
    historyRef.current = [];
    setHistory([]);
  }, []);

  return { history, addData, getLatest, getStats, clear };
};

/**
 * Hook for managing async operations with loading and error states
 */
export const useAsync = <T, E = string>(
  asyncFunction: () => Promise<T>,
  immediate = true
) => {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<E | null>(null);

  const execute = useCallback(async () => {
    setStatus('pending');
    setData(null);
    setError(null);
    
    try {
      const response = await asyncFunction();
      setData(response);
      setStatus('success');
      return response;
    } catch (error) {
      setError(error as E);
      setStatus('error');
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { execute, status, data, error };
};

/**
 * Hook for detecting double click
 */
export const useDoubleClick = (onDoubleClick: () => void, delay = 300) => {
  const clickCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(() => {
    clickCountRef.current++;
    
    if (clickCountRef.current === 1) {
      timeoutRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, delay);
    } else if (clickCountRef.current === 2) {
      clearTimeout(timeoutRef.current);
      onDoubleClick();
      clickCountRef.current = 0;
    }
  }, [delay, onDoubleClick]);
};

/**
 * Hook for debouncing values
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook for throttling callbacks
 */
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const lastRanRef = useRef(Date.now());

  return useCallback(
    (...args: any[]) => {
      const now = Date.now();
      if (now - lastRanRef.current >= delay) {
        callback(...args);
        lastRanRef.current = now;
      }
    },
    [callback, delay]
  ) as T;
};

/**
 * Hook for storing state in localStorage
 */
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue] as const;
};
