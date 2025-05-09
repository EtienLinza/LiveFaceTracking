import { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { SupportedModels, loadFaceLandmarksDetection, FaceLandmarksDetector } from '@tensorflow-models/face-landmarks-detection';
import * as tf from '@tensorflow/tfjs';
import { supabase } from '../lib/supabase';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface FaceData {
  timestamp: number;
  nose_x: number;
  nose_y: number;
  left_eye_x: number;
  left_eye_y: number;
  right_eye_x: number;
  right_eye_y: number;
}

export function FaceTracker() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<FaceLandmarksDetector | null>(null);
  const [faceData, setFaceData] = useState<FaceData[]>([]);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    const loadModel = async () => {
      await tf.ready();
      const model = await loadFaceLandmarksDetection(SupportedModels.MediaPipeFaceMesh);
      setModel(model);
    };
    loadModel();
  }, []);

  const startTracking = () => {
    setIsTracking(true);
    requestAnimationFrame(detect);
  };

  const stopTracking = () => {
    setIsTracking(false);
  };

  const detect = async () => {
    if (!isTracking) return;
    
    if (webcamRef.current && canvasRef.current && model) {
      const video = webcamRef.current.video;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video && video.readyState === 4 && ctx) {
        const faces = await model.estimateFaces(video);

        if (faces.length > 0) {
          const face = faces[0];
          const landmarks = face.keypoints;

          // Get key points
          const nose = landmarks[1];
          const leftEye = landmarks[159];
          const rightEye = landmarks[386];

          const newFaceData: FaceData = {
            timestamp: Date.now(),
            nose_x: nose[0],
            nose_y: nose[1],
            left_eye_x: leftEye[0],
            left_eye_y: leftEye[1],
            right_eye_x: rightEye[0],
            right_eye_y: rightEye[1]
          };

          // Store face data
          await supabase
            .from('face_tracking_data')
            .insert([newFaceData]);

          setFaceData(prev => [...prev, newFaceData].slice(-50));

          // Draw face landmarks
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#FF0000';
          landmarks.forEach(point => {
            ctx.beginPath();
            ctx.arc(point[0], point[1], 1, 0, 3 * Math.PI);
            ctx.fill();
          });
        }
      }
    }

    if (isTracking) {
      requestAnimationFrame(detect);
    }
  };

  const chartData = {
    labels: faceData.map((_, i) => i.toString()),
    datasets: [
      {
        label: 'Nose X Position',
        data: faceData.map(d => d.nose_x),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      },
      {
        label: 'Nose Y Position',
        data: faceData.map(d => d.nose_y),
        borderColor: 'rgb(53, 162, 235)',
        tension: 0.1
      }
    ]
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="relative">
        <Webcam
          ref={webcamRef}
          mirrored
          className="rounded-lg"
          width={640}
          height={480}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0"
          width={640}
          height={480}
        />
      </div>

      <div className="flex gap-4">
        <button
          onClick={startTracking}
          disabled={!model || isTracking}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
        >
          Start Tracking
        </button>
        <button
          onClick={stopTracking}
          disabled={!isTracking}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-400"
        >
          Stop Tracking
        </button>
      </div>

      <div className="w-full max-w-3xl bg-white p-4 rounded-lg shadow">
        <Line data={chartData} />
      </div>
    </div>
  );
}