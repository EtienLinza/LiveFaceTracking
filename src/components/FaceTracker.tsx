import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Webcam from 'react-webcam';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import { SupportedModels, FaceLandmarksDetector } from '@tensorflow-models/face-landmarks-detection';
import * as tf from '@tensorflow/tfjs';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js';
import { FaceData, TrackingStatus, ErrorLog } from '../types';
import { useFrameMetrics, useFaceDataHistory, useLocalStorage } from '../hooks';
import { estimateHeadPose, formatTime } from '../utils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

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

export function FaceTracker({ onDataUpdate, maxHistorySize = 200 }: FaceTrackerProps) {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const isDetectingRef = useRef(false);

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

  const addError = useCallback((message: string, details?: unknown) => {
    setErrors(prev => [
      ...prev,
      {
        timestamp: Date.now(),
        message,
        severity: 'error' as const,
        details,
      },
    ].slice(-5));
  }, []);

  const refreshCameras = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices
      .filter(device => device.kind === 'videoinput')
      .map(device => ({ ...device, isDepthCamera: isDepthCamera(device) }));

    setCameras(videoInputs);

    const preferredCamera = videoInputs.find(device => device.isDepthCamera) ?? videoInputs[0];
    if (preferredCamera && !selectedCameraId) {
      setSelectedCameraId(preferredCamera.deviceId);
      setUsingDepthCamera(Boolean(preferredCamera.isDepthCamera));
    }
  }, [selectedCameraId]);

  useEffect(() => {
    const initializeModel = async () => {
      try {
        setStatus(TrackingStatus.Initializing);
        await tf.setBackend('webgl');
        await tf.ready();
        const loadedModel = await faceLandmarksDetection.createDetector(
          SupportedModels.MediaPipeFaceMesh,
          { runtime: 'tfjs', refineLandmarks: true, maxFaces: 1 }
        );
        setModel(loadedModel);
        setStatus(TrackingStatus.Idle);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addError('Failed to initialize tracking model', errorMessage);
        setStatus(TrackingStatus.Error);
      }
    };

    initializeModel();
    refreshCameras().catch(error => addError('Could not list cameras', error));

    return () => {
      isDetectingRef.current = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [addError, refreshCameras]);

  useEffect(() => () => {
    model?.dispose();
  }, [model]);

  useEffect(() => {
    const selected = cameras.find(camera => camera.deviceId === selectedCameraId);
    setUsingDepthCamera(Boolean(selected?.isDepthCamera));
  }, [cameras, selectedCameraId]);

  const videoConstraints = useMemo<MediaTrackConstraints>(() => ({
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 60 },
    ...(selectedCameraId
      ? { deviceId: { exact: selectedCameraId } }
      : { facingMode: 'user' }),
  }), [selectedCameraId]);

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

    const frameStart = performance.now();
    const video = webcamRef.current.video;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!video || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || !ctx) {
      animationFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    try {
      const faces = await model.estimateFaces(video, { flipHorizontal: false });

      if (faces.length > 0) {
        const face = faces[0];

        if (showLandmarks) {
          drawLandmarks(ctx, face.keypoints);
        }

        const faceData = processFaceData(face);
        if (faceData) {
          addData(faceData);
          onDataUpdate?.(faceData);

          if (showHeadPose) {
            const landmarks2D = face.keypoints.map(point => {
              const landmark = getLandmarkPoint(point);
              return [landmark.x, landmark.y, landmark.z];
            });
            const headPose = estimateHeadPose(landmarks2D);

            ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
            ctx.fillRect(16, 16, 190, 82);
            ctx.fillStyle = '#f8fafc';
            ctx.font = '600 14px Inter, system-ui, sans-serif';
            ctx.fillText(`Yaw ${headPose.yaw.toFixed(1)}°`, 28, 40);
            ctx.fillText(`Pitch ${headPose.pitch.toFixed(1)}°`, 28, 62);
            ctx.fillText(`Roll ${headPose.roll.toFixed(1)}°`, 28, 84);
          }
        }
      } else {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
        ctx.fillRect(16, 16, 180, 42);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 14px Inter, system-ui, sans-serif';
        ctx.fillText('No face detected', 28, 43);
      }
    } catch (error) {
      addError('Detection error', error);
    } finally {
      recordFrame(performance.now() - frameStart);
      if (isDetectingRef.current) {
        animationFrameRef.current = requestAnimationFrame(detect);
      }
    }
  }, [model, showLandmarks, showHeadPose, drawLandmarks, processFaceData, addData, onDataUpdate, addError, recordFrame]);

  const startTracking = useCallback(() => {
    if (!model) {
      addError('Model not initialized yet');
      return;
    }

    clearHistory();
    resetMetrics();
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

  const latest = history[0];
  const sessionDuration = startTime ? Date.now() - startTime : 0;
  const isReady = status !== TrackingStatus.Initializing && Boolean(model);

  const chartData = {
    labels: history.slice(0, 40).reverse().map((_, i) => i),
    datasets: [
      {
        label: 'Nose X',
        data: history.slice(0, 40).reverse().map(d => Math.round(d.nose_x)),
        borderColor: '#14b8a6',
        backgroundColor: 'rgba(20, 184, 166, 0.12)',
        tension: 0.35,
        pointRadius: 0,
      },
      {
        label: 'Nose Y',
        data: history.slice(0, 40).reverse().map(d => Math.round(d.nose_y)),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
        tension: 0.35,
        pointRadius: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#64748b', boxWidth: 10 } },
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.12)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
  };

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-600">Live tracker</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">Face tracking preview</h2>
            <p className="mt-1 text-sm text-slate-500">
              {usingDepthCamera ? 'Depth-capable camera preferred' : 'Standard webcam mode'} · {cameras.length || 1} camera{cameras.length === 1 ? '' : 's'} found
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
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
            <div className="absolute inset-0 grid place-items-center bg-slate-950/80 text-center text-white">
              <div>
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                <p className="font-medium">Loading face tracking model…</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 p-5">
          <button
            onClick={startTracking}
            disabled={!isReady || status === TrackingStatus.Tracking}
            className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Start tracking
          </button>
          <button
            onClick={stopTracking}
            disabled={status !== TrackingStatus.Tracking}
            className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Stop
          </button>
          <button
            onClick={downloadData}
            disabled={history.length === 0}
            className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Export JSON
          </button>
          <button
            onClick={clearHistory}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Camera</h3>
          <select
            value={selectedCameraId}
            onChange={(event) => setSelectedCameraId(event.target.value)}
            className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
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

        <div className="grid grid-cols-2 gap-3">
          <Metric label="FPS" value={metrics.fps.toString()} />
          <Metric label="Latency" value={`${metrics.avgLatency.toFixed(0)}ms`} />
          <Metric label="Frames" value={history.length.toString()} />
          <Metric label="Duration" value={formatTime(sessionDuration)} />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Options</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <label className="flex items-center justify-between gap-3">
              <span>Landmarks</span>
              <input type="checkbox" checked={showLandmarks} onChange={(event) => setShowLandmarks(event.target.checked)} className="h-4 w-4 accent-teal-600" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Head pose</span>
              <input type="checkbox" checked={showHeadPose} onChange={(event) => setShowHeadPose(event.target.checked)} className="h-4 w-4 accent-teal-600" />
            </label>
          </div>
        </div>

        {latest && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Latest read</h3>
            <dl className="mt-4 space-y-2 text-sm text-slate-600">
              <div className="flex justify-between"><dt>Nose</dt><dd className="font-medium text-slate-900">{Math.round(latest.nose_x)}, {Math.round(latest.nose_y)}, {latest.nose_z.toFixed(2)}</dd></div>
              <div className="flex justify-between"><dt>Confidence</dt><dd className="font-medium text-slate-900">{(latest.confidence * 100).toFixed(1)}%</dd></div>
              <div className="flex justify-between"><dt>Updated</dt><dd className="font-medium text-slate-900">{new Date(latest.timestamp).toLocaleTimeString()}</dd></div>
            </dl>
          </div>
        )}
      </aside>

      {history.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-950">Nose position</h3>
            <span className="text-sm text-slate-400">last {Math.min(history.length, 40)} frames</span>
          </div>
          <div className="h-56">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 md:col-span-2">
          <p className="font-semibold">Recent issue</p>
          <p className="mt-1">{errors[errors.length - 1].message}</p>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
