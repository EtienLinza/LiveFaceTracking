import { HeadPose } from './types';

export function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function estimateHeadPose(landmarks: number[][]): HeadPose {
  if (landmarks.length < 68) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  const usesMediaPipeMesh = landmarks.length > 263;
  const nose = usesMediaPipeMesh ? landmarks[1] : landmarks[30];
  const chin = usesMediaPipeMesh ? landmarks[152] : landmarks[8];
  const leftEye = usesMediaPipeMesh ? landmarks[33] : landmarks[36];
  const rightEye = usesMediaPipeMesh ? landmarks[263] : landmarks[45];

  const eyeDx = rightEye[0] - leftEye[0];
  const eyeDy = rightEye[1] - leftEye[1];
  const roll = Math.atan2(eyeDy, eyeDx) * (180 / Math.PI);

  const faceCenterX = (leftEye[0] + rightEye[0]) / 2;
  const eyeDistance = Math.max(Math.hypot(eyeDx, eyeDy), 1);
  const yaw = ((nose[0] - faceCenterX) / eyeDistance) * 45;

  const eyeCenterY = (leftEye[1] + rightEye[1]) / 2;
  const faceHeight = Math.max(Math.abs(chin[1] - eyeCenterY), 1);
  const pitch = ((nose[1] - eyeCenterY) / faceHeight) * 30;

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
