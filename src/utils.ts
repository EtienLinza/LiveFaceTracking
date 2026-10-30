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

/**
 * Apparent head orientation from four 2D landmarks.
 *
 * This is a scaled 2D ratio heuristic, not a solved 3D pose: the z coordinate is
 * never used and no projection is inverted, so the results are not true angles.
 * Roll is the real in-plane angle between the eye corners; yaw and pitch are
 * linear rescalings of horizontal/vertical offsets. A neutral head therefore
 * does not read zero, which is why callers show the value relative to a baseline
 * captured at the start of the session. Pass eye *corners* rather than eyelids:
 * eyelids move when the user blinks.
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

/** Difference between a pose and the neutral baseline it is compared against. */
export function offsetHeadPose(pose: HeadPose, baseline: HeadPose | null): HeadPose {
  if (!baseline) return pose;

  return {
    yaw: pose.yaw - baseline.yaw,
    pitch: pose.pitch - baseline.pitch,
    roll: pose.roll - baseline.roll,
  };
}
