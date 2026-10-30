import './index.css';
import { FaceTracker } from './components/FaceTracker';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FaceData } from './types';
import { useState } from 'react';

function App() {
  const [lastUpdate, setLastUpdate] = useState<FaceData | null>(null);

  return (
    <ErrorBoundary>
      <div className="flex min-h-[100dvh] flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <header className="bg-gray-800 border-b border-gray-700 px-3 py-4 shadow-lg sm:px-4 sm:py-6">
          <div className="mx-auto max-w-6xl">
            <h1 className="text-xl font-bold leading-tight text-white sm:text-2xl md:text-3xl">
              🎯 Live Face Tracking System
            </h1>
            <p className="mt-1 text-xs text-gray-400 sm:text-sm md:text-base">
              Real-time facial landmark detection with 3D head pose estimation
            </p>
            {lastUpdate && (
              <p className="mt-1.5 text-xs text-green-400 sm:text-sm">
                Latest confidence: {(lastUpdate.confidence * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </header>

        <main className="flex-1 py-4 sm:py-8">
          <FaceTracker onDataUpdate={setLastUpdate} maxHistorySize={200} />
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
