// Application constants
export const APP_NAME = 'Live Face Tracking System';
export const APP_VERSION = '2.0.0';

// Tracking Configuration
export const TRACKING_CONFIG = {
  TARGET_FPS: 30,
  MAX_HISTORY_SIZE: 200,
  MIN_CONFIDENCE: 0.5,
  DEVICE: 'cuda' as const,
};

// Landmark Indices (for 468-point MediaPipe FaceMesh)
export const LANDMARK_INDICES = {
  NOSE_TIP: 1,
  CHIN: 8,
  LEFT_EYE_START: 33,
  LEFT_EYE_END: 133,
  RIGHT_EYE_START: 362,
  RIGHT_EYE_END: 263,
  MOUTH_START: 61,
  MOUTH_END: 291,
  FOREHEAD: 10,
  LEFT_CHEEK: 123,
  RIGHT_CHEEK: 352,
  UPPER_LIP: 13,
  LOWER_LIP: 14,
};

// Eye Aspect Ratio Thresholds (for blink detection)
export const EYE_THRESHOLDS = {
  OPEN: 0.2,
  CLOSED: 0.15,
};

// Mouth Aspect Ratio Thresholds
export const MOUTH_THRESHOLDS = {
  OPEN: 0.3,
  CLOSED: 0.1,
};

// Head Pose Angle Ranges
export const HEAD_POSE_RANGES = {
  YAW: { MIN: -90, MAX: 90 },
  PITCH: { MIN: -90, MAX: 90 },
  ROLL: { MIN: -45, MAX: 45 },
};

// Database Table Names
export const DATABASE_TABLES = {
  FACE_TRACKING_DATA: 'face_tracking_data',
  SESSIONS: 'sessions',
  SESSION_ANALYTICS: 'session_analytics',
  ERROR_LOGS: 'error_logs',
};

// Error Messages
export const ERROR_MESSAGES = {
  WEBCAM_NOT_AVAILABLE: 'Webcam is not available or permissions were denied',
  MODEL_LOAD_FAILED: 'Failed to load face detection model',
  DATABASE_CONNECTION_FAILED: 'Failed to connect to database',
  INVALID_CREDENTIALS: 'Invalid API credentials',
  NETWORK_ERROR: 'Network error. Please check your connection',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  TRACKING_STARTED: 'Face tracking started successfully',
  TRACKING_STOPPED: 'Face tracking stopped',
  DATA_EXPORTED: 'Data exported successfully',
  SESSION_SAVED: 'Session saved successfully',
};

// UI Colors
export const UI_COLORS = {
  PRIMARY: '#3b82f6',
  SUCCESS: '#10b981',
  ERROR: '#ef4444',
  WARNING: '#f59e0b',
  INFO: '#06b6d4',
};

// Storage Keys
export const STORAGE_KEYS = {
  LAST_SESSION: 'lastSession',
  USER_PREFERENCES: 'userPreferences',
  CACHED_MODELS: 'cachedModels',
  SESSION_HISTORY: 'sessionHistory',
};
