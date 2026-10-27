import './index.css';
import { FaceTracker } from './components/FaceTracker';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FaceData } from './types';
import { useState } from 'react';

function App() {
  const [lastUpdate, setLastUpdate] = useState<FaceData | null>(null);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <header className="bg-gray-800 border-b border-gray-700 py-6 shadow-lg">
          <div className="max-w-6xl mx-auto px-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
              🎯 Live Face Tracking System
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              Real-time facial landmark detection with 3D head pose estimation
            </p>
            {lastUpdate && (
              <p className="text-sm text-green-400 mt-2">
                Latest confidence: {(lastUpdate.confidence * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </header>

        <main className="py-8">
          <FaceTracker onDataUpdate={setLastUpdate} maxHistorySize={200} />
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
