import { HeadPose } from './types';

export function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export interface HeadPosePoint {
  x: number;
  y: number;
}

export interface HeadPosePoints {
  nose: HeadPosePoint;
  chin: HeadPosePoint;
  leftEye: HeadPosePoint;
  rightEye: HeadPosePoint;
}

const toPoint = (point?: number[]): HeadPosePoint => ({
  x: point?.[0] ?? 0,
  y: point?.[1] ?? 0,
});

export function estimateHeadPose(landmarks: number[][]): HeadPose {
  if (landmarks.length < 68) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  return estimateHeadPoseFromPoints({
    nose: toPoint(landmarks[30] ?? landmarks[1]),
    chin: toPoint(landmarks[8]),
    leftEye: toPoint(landmarks[36]),
    rightEye: toPoint(landmarks[45]),
  });
}

/**
 * Same estimation as `estimateHeadPose`, but takes only the four landmarks it
 * actually needs so a per-frame caller does not have to copy all 468 points.
 */
export function estimateHeadPoseFromPoints({
  nose,
  chin,
  leftEye,
  rightEye,
}: HeadPosePoints): HeadPose {
  const eyeDx = rightEye.x - leftEye.x;
  const eyeDy = rightEye.y - leftEye.y;
  const roll = Math.atan2(eyeDy, eyeDx) * (180 / Math.PI);

  const faceCenterX = (leftEye.x + rightEye.x) / 2;
  const eyeDistance = Math.max(Math.hypot(eyeDx, eyeDy), 1);
  const yaw = ((nose.x - faceCenterX) / eyeDistance) * 45;

  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
  const faceHeight = Math.max(Math.abs(chin.y - eyeCenterY), 1);
  const pitch = ((nose.y - eyeCenterY) / faceHeight) * 30;

  return { yaw, pitch, roll };
}

export function calculateEyeAspectRatio(eyeLandmarks: number[][]): number {
  if (eyeLandmarks.length < 6) return 0;
  const verticalA = distance(eyeLandmarks[1], eyeLandmarks[5]);
  const verticalB = distance(eyeLandmarks[2], eyeLandmarks[4]);
  const horizontal = distance(eyeLandmarks[0], eyeLandmarks[3]);
  return horizontal === 0 ? 0 : (verticalA + verticalB) / (2 * horizontal);
}

export function calculateMouthAspectRatio(mouthLandmarks: number[][]): number {
  if (mouthLandmarks.length < 4) return 0;
  const vertical = distance(mouthLandmarks[1], mouthLandmarks[3]);
  const horizontal = distance(mouthLandmarks[0], mouthLandmarks[2]);
  return horizontal === 0 ? 0 : vertical / horizontal;
}

function distance(a: number[], b: number[]): number {
  return Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0));
}
