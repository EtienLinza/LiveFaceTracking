// Common types and interfaces used throughout the application

/**
 * One detected frame. Only values the detector actually produces are stored:
 * MediaPipe FaceMesh's tfjs runtime does not report a confidence score, so
 * there is no such field here.
 */
export interface FaceData {
  timestamp: number;
  nose_x: number;
  nose_y: number;
  nose_z: number;
  left_eye_x: number;
  left_eye_y: number;
  left_eye_z: number;
  right_eye_x: number;
  right_eye_y: number;
  right_eye_z: number;
  chin_x: number;
  chin_y: number;
  chin_z: number;
  mouth_x: number;
  mouth_y: number;
  mouth_z: number;
}

/** Whole-session summary, independent of the displayed history window. */
export interface SessionStats {
  totalFrames: number;
  averageFps: number;
  sessionDuration: number;
  startTime: number | null;
  endTime: number | null;
}

/**
 * Apparent head orientation in the image plane. Produced by a 2D landmark-ratio
 * heuristic, not by a solved 3D pose, so the values are an indicator rather than
 * measured angles.
 */
export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export enum TrackingStatus {
  Idle = 'idle',
  Initializing = 'initializing',
  Tracking = 'tracking',
  Error = 'error',
  Paused = 'paused'
}

export interface ErrorLog {
  timestamp: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  details?: unknown;
}
