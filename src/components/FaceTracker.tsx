import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import type { FaceLandmarksDetector } from '@tensorflow-models/face-landmarks-detection';
import { FaceData, TrackingStatus, ErrorLog } from '../types';
import { useFaceDataHistory, useFrameMetrics, useLocalStorage } from '../hooks';
import { estimateHeadPoseFromPoints, formatTime } from '../utils';

// chart.js is only needed once tracking has produced data, so it lives in its
// own chunk instead of the initial bundle.
const NoseChart = lazy(() => import('./NoseChart'));

interface FaceTrackerProps {
  onDataUpdate?: (data: FaceData) => void;
  maxHistorySize?: number;
}

type CameraInfo = MediaDeviceInfo & { isDepthCamera?: boolean };

const DEPTH_CAMERA_KEYWORDS = [
  'depth',
  'realsense',
  'kinect',
  'true depth',
  'truedepth',
  'lidar',
  'tof',
  'time-of-flight',
  'stereo',
  '3d',
];

const getLandmarkPoint = (landmark: any) => ({
  x: Number(landmark?.x ?? 0),
  y: Number(landmark?.y ?? 0),
  z: Number(landmark?.z ?? 0),
});

const isDepthCamera = (device: MediaDeviceInfo) => {
  const label = device.label.toLowerCase();
  return DEPTH_CAMERA_KEYWORDS.some(keyword => label.includes(keyword));
};

// Phones and small tablets get a smaller capture and a lower detection rate, so
// inference stays responsive and the battery/data cost stays reasonable. Larger
// screens keep the original 720p capture.
const isConstrainedDevice = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches === true || window.innerWidth < 768);

const DESKTOP_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
};

const COMPACT_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 480 },
};

const DESKTOP_TARGET_FPS = 30;
const COMPACT_TARGET_FPS = 20;

// Minimum gap between React updates driven by incoming frames.
const DATA_EMIT_INTERVAL_MS = 200;

/** Small translucent label box drawn on top of the camera feed. */
const drawOverlay = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  lines: string[],
  width = 190,
) => {
  // Keep the overlay legible whatever the capture resolution is.
  const scale = Math.max(1, canvasWidth / 640);
  const top = 16 * scale;
  const lineHeight = 22 * scale;
  const boxHeight = (38 + 22 * (lines.length - 1)) * scale;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.fillRect(top, top, width * scale, boxHeight);
  ctx.fillStyle = '#f8fafc';
  ctx.font = `600 ${Math.round(14 * scale)}px Inter, system-ui, sans-serif`;
  lines.forEach((line, index) => {
    ctx.fillText(line, top + 12 * scale, top + 24 * scale + index * lineHeight);
  });
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-xs sm:tracking-[0.18em]">
      {label}
    </p>
    <p className="mt-1.5 text-xl font-semibold text-slate-950 sm:mt-2 sm:text-2xl">{value}</p>
  </div>
);

const actionButtonClass =
  'flex min-h-[44px] items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition sm:min-h-0 sm:py-2.5';

export function FaceTracker({ onDataUpdate, maxHistorySize = 200 }: FaceTrackerProps) {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number>();
  const isDetectingRef = useRef(false);
  const lastFrameAtRef = useRef(0);
  const lastEmitRef = useRef(0);

  const constrained = useMemo(isConstrainedDevice, []);
  const targetFps = constrained ? COMPACT_TARGET_FPS : DESKTOP_TARGET_FPS;

  const [model, setModel] = useState<FaceLandmarksDetector | null>(null);
  const [status, setStatus] = useState<TrackingStatus>(TrackingStatus.Idle);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [usingDepthCamera, setUsingDepthCamera] = useState(false);

  const { history, addData, getStats, clear: clearHistory } = useFaceDataHistory(maxHistorySize);
  const { metrics, recordFrame, reset: resetMetrics } = useFrameMetrics();
  const [showLandmarks, setShowLandmarks] = useLocalStorage('showLandmarks', true);
  const [showHeadPose, setShowHeadPose] = useLocalStorage('showHeadPose', true);

  const addError = useCallback((message: string, details?: any) => {
    const error: ErrorLog = {
      timestamp: Date.now(),
      message,
      severity: 'error',
      details
    };
    setErrors(prev => [...prev, error].slice(-10)); // Keep last 10 errors
  }, []);

  // List available cameras and prefer a depth-capable one when the browser
  // exposes a recognisable label (labels are only available after permission).
  const refreshCameras = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs: CameraInfo[] = devices
      .filter(device => device.kind === 'videoinput')
      .map(device => ({ ...device, isDepthCamera: isDepthCamera(device) }));

    setCameras(videoInputs);

    const preferred = videoInputs.find(camera => camera.isDepthCamera) ?? videoInputs[0];
    if (!preferred) return;

    setSelectedCameraId(previous =>
      previous && videoInputs.some(camera => camera.deviceId === previous)
        ? previous
        : preferred.deviceId,
    );
    setUsingDepthCamera(Boolean(preferred.isDepthCamera));
  }, []);

  const videoConstraints = useMemo<MediaTrackConstraints>(
    () => ({
      ...(constrained ? COMPACT_VIDEO_CONSTRAINTS : DESKTOP_VIDEO_CONSTRAINTS),
      ...(selectedCameraId ? { deviceId: { exact: selectedCameraId } } : {}),
    }),
    [constrained, selectedCameraId],
  );

  // Initialize model on mount
  useEffect(() => {
    let cancelled = false;

    const initializeModel = async () => {
      try {
        setStatus(TrackingStatus.Initializing);

        // TensorFlow.js and the face-mesh detector are far larger than the app
        // itself, so they are loaded as separate chunks after the UI is up.
        const [tf, faceLandmarksDetection] = await Promise.all([
          import('@tensorflow/tfjs'),
          import('@tensorflow-models/face-landmarks-detection'),
        ]);

        try {
          await tf.setBackend('webgl');
        } catch {
          // No WebGL available (older/limited devices): keep the default backend.
        }
        await tf.ready();

        const loadedModel = await faceLandmarksDetection.createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          { runtime: 'tfjs', refineLandmarks: true }
        );

        if (cancelled) return;
        setModel(loadedModel);
        setStatus(TrackingStatus.Idle);
      } catch (error) {
        if (cancelled) return;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addError('Failed to initialize tracking model', errorMessage);
        setStatus(TrackingStatus.Error);
      }
    };

    initializeModel();
    refreshCameras().catch(error => addError('Could not list cameras', error));

    return () => {
      cancelled = true;
      isDetectingRef.current = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [addError, refreshCameras]);

  const drawLandmarks = useCallback((
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
  ) => {
    if (!landmarks?.length) return;

    ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
    landmarks.forEach((landmark, index) => {
      if (index % 4 !== 0 && ![1, 8, 33, 263, 13].includes(index)) return;
      const point = getLandmarkPoint(landmark);
      ctx.beginPath();
      ctx.arc(point.x, point.y, [1, 8, 33, 263, 13].includes(index) ? 3 : 1.5, 0, 2 * Math.PI);
      ctx.fill();
    });
  }, []);

  const processFaceData = useCallback((face: any): FaceData | null => {
    try {
      const landmarks = face.keypoints;
      if (!landmarks || landmarks.length < 387) return null;

      const nose = getLandmarkPoint(landmarks[1]);
      const chin = getLandmarkPoint(landmarks[152] ?? landmarks[8]);
      const leftEye = getLandmarkPoint(landmarks[159]);
      const rightEye = getLandmarkPoint(landmarks[386]);
      const mouth = getLandmarkPoint(landmarks[13]);
      const confidence = typeof face.score === 'number' ? face.score : 0.95;

      return {
        timestamp: Date.now(),
        nose_x: nose.x,
        nose_y: nose.y,
        nose_z: nose.z,
        chin_x: chin.x,
        chin_y: chin.y,
        chin_z: chin.z,
        left_eye_x: leftEye.x,
        left_eye_y: leftEye.y,
        left_eye_z: leftEye.z,
        right_eye_x: rightEye.x,
        right_eye_y: rightEye.y,
        right_eye_z: rightEye.z,
        mouth_x: mouth.x,
        mouth_y: mouth.y,
        mouth_z: mouth.z,
        confidence,
      };
    } catch (error) {
      addError('Error processing face data', error);
      return null;
    }
  }, [addError]);

  const detect = useCallback(async () => {
    if (!isDetectingRef.current || !webcamRef.current || !canvasRef.current || !model) return;

    const video = webcamRef.current.video;
    const canvas = canvasRef.current;

    if (!video || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || !video.videoWidth) {
      animationFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    // Throttle to the device's target rate instead of running every animation
    // frame — the detector can rarely keep up, and the extra ticks only burn CPU.
    const frameStart = performance.now();
    if (frameStart - lastFrameAtRef.current < 1000 / targetFps) {
      animationFrameRef.current = requestAnimationFrame(detect);
      return;
    }
    lastFrameAtRef.current = frameStart;

    const ctx = ctxRef.current ?? (ctxRef.current = canvas.getContext('2d'));
    if (!ctx) return;

    try {
      // The <video> element already paints the camera feed and shares this
      // canvas' object-cover crop, so the frame no longer has to be copied onto
      // the canvas on every tick. Only the overlay is drawn here.
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Detect faces
      const faces = await model.estimateFaces(video);

      if (faces.length > 0) {
        const face = faces[0];
        const keypoints = face.keypoints;

        if (showLandmarks) {
          drawLandmarks(ctx, keypoints);
        }

        const faceData = processFaceData(face);
        if (faceData) {
          addData(faceData);

          // The header only shows the latest confidence: emitting it on every
          // frame re-rendered the whole page at the detection rate.
          const now = performance.now();
          if (now - lastEmitRef.current >= DATA_EMIT_INTERVAL_MS) {
            lastEmitRef.current = now;
            onDataUpdate?.(faceData);
          }

          if (showHeadPose) {
            const headPose = estimateHeadPoseFromPoints({
              nose: getLandmarkPoint(keypoints[1]),
              chin: getLandmarkPoint(keypoints[152] ?? keypoints[8]),
              leftEye: getLandmarkPoint(keypoints[159]),
              rightEye: getLandmarkPoint(keypoints[386]),
            });

            drawOverlay(ctx, canvas.width, [
              `Yaw ${headPose.yaw.toFixed(1)}°`,
              `Pitch ${headPose.pitch.toFixed(1)}°`,
              `Roll ${headPose.roll.toFixed(1)}°`,
            ]);
          }
        }
      } else {
        drawOverlay(ctx, canvas.width, ['No face detected'], 180);
      }
    } catch (error) {
      addError('Detection error', error);
    } finally {
      recordFrame(performance.now() - frameStart);
      if (isDetectingRef.current) {
        animationFrameRef.current = requestAnimationFrame(detect);
      }
    }
  }, [model, targetFps, showLandmarks, showHeadPose, drawLandmarks, processFaceData, addData, onDataUpdate, addError, recordFrame]);

  const startTracking = useCallback(() => {
    if (!model) {
      addError('Model not initialized yet');
      return;
    }

    clearHistory();
    resetMetrics();
    lastFrameAtRef.current = 0;
    lastEmitRef.current = 0;
    setStartTime(Date.now());
    setStatus(TrackingStatus.Tracking);
    isDetectingRef.current = true;
    animationFrameRef.current = requestAnimationFrame(detect);
  }, [model, detect, clearHistory, resetMetrics, addError]);

  const stopTracking = useCallback(() => {
    isDetectingRef.current = false;
    setStatus(TrackingStatus.Paused);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const downloadData = useCallback(() => {
    try {
      const stats = getStats();
      const data = {
        session: {
          startTime,
          endTime: Date.now(),
          duration: stats.sessionDuration,
          totalFrames: stats.totalFrames,
          averageFps: stats.averageFps,
          depthCameraPreferred: usingDepthCamera,
        },
        landmarks: history,
      };

      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `face_tracking_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      addError('Failed to download data', error);
    }
  }, [history, startTime, getStats, usingDepthCamera, addError]);

  const sessionDuration = startTime ? Date.now() - startTime : 0;
  const isReady = status !== TrackingStatus.Initializing && Boolean(model);
  const latest = history[0] ?? null;

  const chartHistory = useMemo(() => history.slice(0, 40).reverse(), [history]);

  return (
    <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-3 sm:gap-6 sm:px-4 md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-600 sm:text-sm">
              Live tracker
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-tight text-slate-950 sm:text-2xl">
              Face tracking preview
            </h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              {usingDepthCamera ? 'Depth-capable camera preferred' : 'Standard webcam mode'} · {cameras.length || 1} camera{cameras.length === 1 ? '' : 's'} found
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 sm:py-2 sm:text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${status === TrackingStatus.Tracking ? 'bg-emerald-500' : status === TrackingStatus.Error ? 'bg-rose-500' : 'bg-amber-400'}`} />
            {status === TrackingStatus.Initializing ? 'Loading model' : status}
          </div>
        </div>

        <div className="relative aspect-video bg-slate-950">
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            onUserMedia={() => refreshCameras().catch(error => addError('Could not refresh camera list', error))}
            onUserMediaError={(error) => {
              addError('Camera permission or device error', error);
              setStatus(TrackingStatus.Error);
            }}
            className="h-full w-full object-cover"
          />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          {!isReady && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/80 px-6 text-center text-white">
              <div>
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                <p className="text-sm font-medium sm:text-base">Loading face tracking model…</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 p-4 sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:p-5">
          <button
            onClick={startTracking}
            disabled={!isReady || status === TrackingStatus.Tracking}
            className={`${actionButtonClass} bg-slate-950 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300`}
          >
            Start tracking
          </button>
          <button
            onClick={stopTracking}
            disabled={status !== TrackingStatus.Tracking}
            className={`${actionButtonClass} border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300`}
          >
            Stop
          </button>
          <button
            onClick={downloadData}
            disabled={history.length === 0}
            className={`${actionButtonClass} border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300`}
          >
            Export JSON
          </button>
          <button
            onClick={clearHistory}
            className={`${actionButtonClass} text-slate-500 hover:bg-slate-50`}
          >
            Clear
          </button>
        </div>
      </div>

      <aside className="min-w-0 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 sm:text-sm">Camera</h3>
          <select
            value={selectedCameraId}
            onChange={(event) => setSelectedCameraId(event.target.value)}
            className="mt-3 w-full min-h-[44px] rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 sm:mt-4 sm:min-h-0 sm:text-sm"
          >
            {cameras.length === 0 && <option value="">Default camera</option>}
            {cameras.map((camera, index) => (
              <option key={camera.deviceId || index} value={camera.deviceId}>
                {camera.label || `Camera ${index + 1}`}{camera.isDepthCamera ? ' · depth preferred' : ''}
              </option>
            ))}
          </select>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Depth cameras are selected by default when the browser exposes a camera label such as RealSense, Kinect, LiDAR, ToF, or TrueDepth. Browsers still provide a normal video stream, so tracking falls back automatically when depth data is unavailable.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Metric label="FPS" value={metrics.fps.toString()} />
          <Metric label="Latency" value={`${metrics.avgLatency.toFixed(0)}ms`} />
          <Metric label="Frames" value={history.length.toString()} />
          <Metric label="Duration" value={formatTime(sessionDuration)} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 sm:text-sm">Options</h3>
          <div className="mt-2 space-y-1 text-sm text-slate-700 sm:mt-4 sm:space-y-3">
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 sm:min-h-0">
              <span>Landmarks</span>
              <input type="checkbox" checked={showLandmarks} onChange={(event) => setShowLandmarks(event.target.checked)} className="h-5 w-5 accent-teal-600" />
            </label>
            <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 sm:min-h-0">
              <span>Head pose</span>
              <input type="checkbox" checked={showHeadPose} onChange={(event) => setShowHeadPose(event.target.checked)} className="h-5 w-5 accent-teal-600" />
            </label>
          </div>
        </div>

        {latest && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 sm:text-sm">Latest read</h3>
            <dl className="mt-3 space-y-2 text-sm text-slate-600 sm:mt-4">
              <div className="flex items-center justify-between gap-3"><dt>Nose</dt><dd className="truncate font-medium text-slate-900">{Math.round(latest.nose_x)}, {Math.round(latest.nose_y)}, {latest.nose_z.toFixed(2)}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt>Confidence</dt><dd className="truncate font-medium text-slate-900">{(latest.confidence * 100).toFixed(1)}%</dd></div>
              <div className="flex items-center justify-between gap-3"><dt>Updated</dt><dd className="truncate font-medium text-slate-900">{new Date(latest.timestamp).toLocaleTimeString()}</dd></div>
            </dl>
          </div>
        )}
      </aside>

      {history.length > 0 && (
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5 md:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-950 sm:text-lg">Nose position</h3>
            <span className="text-xs text-slate-400 sm:text-sm">last {Math.min(history.length, 40)} frames</span>
          </div>
          <div className="h-48 sm:h-56">
            <Suspense fallback={<div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />}>
              <NoseChart history={chartHistory} />
            </Suspense>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="min-w-0 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:rounded-3xl sm:p-5 md:col-span-2">
          <p className="font-semibold">Recent issue</p>
          <p className="mt-1 break-words">{errors[errors.length - 1].message}</p>
        </div>
      )}
    </section>
  );
}
