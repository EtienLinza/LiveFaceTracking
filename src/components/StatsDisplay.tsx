// Statistics and visualization panel component
import React from 'react';
import { TrackingStats, FaceData } from '../types';
import { formatTime } from '../lib/utils';

interface StatsDisplayProps {
  stats?: TrackingStats;
  recentData?: FaceData[];
  sessionDuration?: number;
}

export function StatsDisplay({ stats, recentData, sessionDuration = 0 }: StatsDisplayProps) {
  if (!stats) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg text-gray-400">
        <p>No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          label="FPS" 
          value={stats.averageFps.toFixed(1)} 
          unit="fps"
        />
        <MetricCard 
          label="Latency" 
          value={stats.averageLatency.toFixed(1)} 
          unit="ms"
        />
        <MetricCard 
          label="Frames" 
          value={stats.totalFrames.toString()} 
          unit="frames"
        />
        <MetricCard 
          label="Duration" 
          value={formatTime(sessionDuration)} 
          unit=""
        />
      </div>

      {/* Detailed Stats */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-xl font-bold mb-4">Session Statistics</h3>
        <div className="space-y-2 text-sm">
          <StatRow label="Total Frames" value={stats.totalFrames} />
          <StatRow label="Faces Detected" value={stats.facesDetected} />
          <StatRow label="Average FPS" value={stats.averageFps.toFixed(2)} />
          <StatRow label="Average Latency" value={`${stats.averageLatency.toFixed(2)}ms`} />
          <StatRow label="Session Duration" value={formatTime(sessionDuration)} />
        </div>
      </div>

      {/* Recent Data Preview */}
      {recentData && recentData.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-xl font-bold mb-4">Latest Reading</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Nose Position:</span>
              <span className="text-green-400">
                ({Math.round(recentData[0].nose_x)}, {Math.round(recentData[0].nose_y)}, {recentData[0].nose_z.toFixed(2)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Confidence:</span>
              <span className={recentData[0].confidence > 0.8 ? 'text-green-400' : 'text-yellow-400'}>
                {(recentData[0].confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Timestamp:</span>
              <span className="text-blue-400">
                {new Date(recentData[0].timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  unit: string;
}

function MetricCard({ label, value, unit }: MetricCardProps) {
  return (
    <div className="bg-gray-800 p-4 rounded-lg text-center">
      <p className="text-gray-400 text-sm mb-2">{label}</p>
      <p className="text-3xl font-bold text-green-400">{value}</p>
      {unit && <p className="text-gray-500 text-xs mt-1">{unit}</p>}
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: string | number;
}

function StatRow({ label, value }: StatRowProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );
}

export default StatsDisplay;
