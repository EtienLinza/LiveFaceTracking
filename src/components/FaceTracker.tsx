import { useRef, useEffect, useState, useCallback } from 'react';
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
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { FaceData, TrackingStatus, ErrorLog } from '../types';
import { useFrameMetrics, useFaceDataHistory, useLocalStorage } from '../hooks';
import { 
  estimateHeadPose, 
  formatTime 
} from '../utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface FaceTrackerProps {
  onDataUpdate?: (data: FaceData) => void;
  maxHistorySize?: number;
}

export function FaceTracker({ 
  onDataUpdate,
  maxHistorySize = 200 
}: FaceTrackerProps) {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  
  // State management
  const [model, setModel] = useState<FaceLandmarksDetector | null>(null);
  const [status, setStatus] = useState<TrackingStatus>(TrackingStatus.Idle);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  
  // Data management
  const { history, addData, getStats, clear: clearHistory } = useFaceDataHistory(maxHistorySize);
  const { metrics } = useFrameMetrics();
  
  // Preferences
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

  // Initialize model on mount
  useEffect(() => {
    const initializeModel = async () => {
      try {
        setStatus(TrackingStatus.Initializing);
        await tf.ready();
        const loadedModel = await faceLandmarksDetection.createDetector(
          SupportedModels.MediaPipeFaceMesh,
          { runtime: 'tfjs', refineLandmarks: true }
        );
        setModel(loadedModel);
        setStatus(TrackingStatus.Idle);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addError('Failed to initialize model', errorMessage);
        setStatus(TrackingStatus.Error);
      }
    };

    initializeModel();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [addError]);

  const drawLandmarks = useCallback((
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    videoWidth: number,
    videoHeight: number
  ) => {
    if (!landmarks) return;

    // Draw circles for each landmark
    landmarks.forEach((landmark, index) => {
      const x = (landmark.x || 0) * videoWidth;
      const y = (landmark.y || 0) * videoHeight;

      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();

      // Draw key landmark labels
      if ([1, 8, 33, 133, 362, 263].includes(index)) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        const labels: { [key: number]: string } = {
          1: 'Nose',
          8: 'Chin',
          33: 'L Eye',
          133: 'L Eye',
          362: 'R Eye',
          263: 'R Eye'
        };
        if (labels[index]) {
          ctx.fillText(labels[index], x + 5, y - 5);
        }
      }
    });
  }, []);

  const processFaceData = useCallback(async (
    face: any,
    videoWidth: number,
    videoHeight: number
  ): Promise<FaceData | null> => {
    try {
      const landmarks = face.keypoints;
      if (!landmarks || landmarks.length === 0) return null;

      // Extract key landmarks
      const nose = landmarks[1];
      const chin = landmarks[8];
      const leftEye = landmarks[159];
      const rightEye = landmarks[386];
      const mouth = landmarks[13];

      // Get 2D and 3D coordinates
      const getData = (lm: any) => {
        const x = (lm.x || 0) * videoWidth;
        const y = (lm.y || 0) * videoHeight;
        const z = (lm.z || 0);
        return { x, y, z };
      };

      const noseData = getData(nose);
      const chinData = getData(chin);
      const leftEyeData = getData(leftEye);
      const rightEyeData = getData(rightEye);
      const mouthData = getData(mouth);

      // Calculate additional metrics
      const confidence = face.probability ? face.probability[0] : 0.95;

      const faceData: FaceData = {
        timestamp: Date.now(),
        nose_x: noseData.x,
        nose_y: noseData.y,
        nose_z: noseData.z,
        chin_x: chinData.x,
        chin_y: chinData.y,
        chin_z: chinData.z,
        left_eye_x: leftEyeData.x,
        left_eye_y: leftEyeData.y,
        left_eye_z: leftEyeData.z,
        right_eye_x: rightEyeData.x,
        right_eye_y: rightEyeData.y,
        right_eye_z: rightEyeData.z,
        mouth_x: mouthData.x,
        mouth_y: mouthData.y,
        mouth_z: mouthData.z,
        confidence
      };

      return faceData;
    } catch (error) {
      addError('Error processing face data', error);
      return null;
    }
  }, [addError]);

  const detect = useCallback(async () => {
    if (status !== TrackingStatus.Tracking) return;
    if (!webcamRef.current || !canvasRef.current || !model) {
      animationFrameRef.current = requestAnimationFrame(detect);
      return;
    }

    try {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!video || video.readyState !== 4 || !ctx) {
        animationFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      // Set canvas dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Detect faces
      const faces = await model.estimateFaces(video);

      if (faces.length > 0) {
        const face = faces[0];
        
        // Draw landmarks
        if (showLandmarks) {
          drawLandmarks(ctx, face.keypoints, canvas.width, canvas.height);
        }

        // Process face data
        const faceData = await processFaceData(face, canvas.width, canvas.height);

        if (faceData) {
          addData(faceData);
          onDataUpdate?.(faceData);

          // Draw head pose if enabled
          if (showHeadPose && face.keypoints.length >= 50) {
            // Convert landmarks to 2D points for head pose estimation
            const landmarks2D = face.keypoints.slice(0, 68).map(kp => [
              (kp.x || 0) * canvas.width,
              (kp.y || 0) * canvas.height,
              (kp.z || 0)
            ]);
            
            const headPose = estimateHeadPose(landmarks2D);
            
            // Draw head pose info
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px Arial';
            ctx.fillText(`Head Pose - Yaw: ${headPose.yaw.toFixed(1)}°`, 10, 30);
            ctx.fillText(`Pitch: ${headPose.pitch.toFixed(1)}°`, 10, 50);
            ctx.fillText(`Roll: ${headPose.roll.toFixed(1)}°`, 10, 70);
          }

          // Draw metrics
          ctx.fillStyle = '#00ff00';
          ctx.font = '12px Arial';
          ctx.fillText(`FPS: ${metrics.fps}`, 10, canvas.height - 20);
          ctx.fillText(`Confidence: ${(faceData.confidence * 100).toFixed(1)}%`, 10, canvas.height - 5);
        }
      }

      animationFrameRef.current = requestAnimationFrame(detect);
    } catch (error) {
      addError('Detection error', error);
      animationFrameRef.current = requestAnimationFrame(detect);
    }
  }, [status, model, showLandmarks, showHeadPose, metrics, drawLandmarks, processFaceData, addData, onDataUpdate, addError]);

  const startTracking = useCallback(() => {
    if (!model) {
      addError('Model not initialized');
      return;
    }
    setStatus(TrackingStatus.Tracking);
    setStartTime(Date.now());
    clearHistory();
    animationFrameRef.current = requestAnimationFrame(detect);
  }, [model, detect, clearHistory, addError]);

  const stopTracking = useCallback(() => {
    setStatus(TrackingStatus.Paused);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  const downloadData = useCallback(async () => {
    try {
      const stats = getStats();
      const data = {
        session: {
          startTime,
          endTime: Date.now(),
          duration: stats.sessionDuration,
          totalFrames: stats.totalFrames,
          averageFps: stats.averageFps
        },
        landmarks: history
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
  }, [history, startTime, getStats, addError]);

  const sessionDuration = startTime ? Date.now() - startTime : 0;

  // Prepare chart data
  const noseXData = history.slice(-50).map(d => Math.round(d.nose_x));
  const noseYData = history.slice(-50).map(d => Math.round(d.nose_y));

  const chartData = {
    labels: history.slice(-50).map((_, i) => i),
    datasets: [
      {
        label: 'Nose X Position',
        data: noseXData,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
      {
        label: 'Nose Y Position',
        data: noseYData,
        borderColor: 'rgb(153, 102, 255)',
        tension: 0.1,
      }
    ]
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 bg-gray-900 text-white rounded-lg">
      <h1 className="text-3xl font-bold mb-6">Live Face Tracker</h1>

      {/* Status Indicator */}
      <div className={`p-4 rounded mb-4 ${
        status === TrackingStatus.Error 
          ? 'bg-red-500' 
          : status === TrackingStatus.Tracking 
          ? 'bg-green-500' 
          : 'bg-yellow-500'
      }`}>
        <p className="font-bold">Status: {status.toUpperCase()}</p>
        {startTime && <p>Session Duration: {formatTime(sessionDuration)}</p>}
      </div>

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="bg-red-900 border border-red-500 p-4 rounded mb-4">
          <p className="font-bold mb-2">Recent Errors:</p>
          {errors.slice(-3).map((error, idx) => (
            <p key={idx} className="text-sm mb-1">
              {error.message}
            </p>
          ))}
        </div>
      )}

      {/* Webcam and Canvas */}
      <div className="relative mb-6 bg-black rounded-lg overflow-hidden">
        <Webcam
          ref={webcamRef}
          className="w-full hidden"
          videoConstraints={{ width: 640, height: 480 }}
        />
        <canvas
          ref={canvasRef}
          className="w-full h-auto bg-black"
        />
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <button
          onClick={startTracking}
          disabled={status === TrackingStatus.Tracking || status === TrackingStatus.Initializing}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded font-bold"
        >
          Start Tracking
        </button>
        <button
          onClick={stopTracking}
          disabled={status !== TrackingStatus.Tracking}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded font-bold"
        >
          Stop Tracking
        </button>
        <button
          onClick={downloadData}
          disabled={history.length === 0}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded font-bold"
        >
          Download Data
        </button>
        <button
          onClick={clearHistory}
          className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 rounded font-bold"
        >
          Clear History
        </button>
      </div>

      {/* Settings */}
      <div className="mb-6 flex gap-6 flex-wrap">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showLandmarks}
            onChange={(e) => setShowLandmarks(e.target.checked)}
            className="w-4 h-4"
          />
          Show Landmarks
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showHeadPose}
            onChange={(e) => setShowHeadPose(e.target.checked)}
            className="w-4 h-4"
          />
          Show Head Pose
        </label>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-gray-400 text-sm">FPS</p>
          <p className="text-2xl font-bold">{metrics.fps}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-gray-400 text-sm">Frames</p>
          <p className="text-2xl font-bold">{history.length}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-gray-400 text-sm">Avg Latency</p>
          <p className="text-2xl font-bold">{metrics.avgLatency.toFixed(1)}ms</p>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <p className="text-gray-400 text-sm">Duration</p>
          <p className="text-2xl font-bold">{formatTime(sessionDuration)}</p>
        </div>
      </div>

      {/* Chart */}
      {history.length > 0 && (
        <div className="bg-gray-800 p-6 rounded mb-6">
          <h2 className="text-xl font-bold mb-4">Nose Position Tracking</h2>
          <Line data={chartData} options={{ responsive: true, maintainAspectRatio: true }} />
        </div>
      )}

      {/* Recent Data Table */}
      {history.length > 0 && (
        <div className="bg-gray-800 p-6 rounded">
          <h2 className="text-xl font-bold mb-4">Recent Landmarks (Last 5)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2">Timestamp</th>
                  <th className="text-left p-2">Nose</th>
                  <th className="text-left p-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(-5).reverse().map((data, idx) => (
                  <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700">
                    <td className="p-2">{new Date(data.timestamp).toLocaleTimeString()}</td>
                    <td className="p-2">
                      ({Math.round(data.nose_x)}, {Math.round(data.nose_y)}, {data.nose_z.toFixed(2)})
                    </td>
                    <td className="p-2">{(data.confidence * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
