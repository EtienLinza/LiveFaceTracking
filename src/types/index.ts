// Common types and interfaces used throughout the application
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
  confidence: number;
}

export interface TrackingStats {
  totalFrames: number;
  averageFps: number;
  averageLatency: number;
  facesDetected: number;
  sessionDuration: number;
}

export interface HeadPose {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface FaceMetrics {
  facePresent: boolean;
  headPose: HeadPose;
  blinkDetected: boolean;
  eyeGazeX: number;
  eyeGazeY: number;
  mouthOpen: number;
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
