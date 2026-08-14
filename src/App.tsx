import './index.css';
import { FaceTracker } from './components/FaceTracker';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FaceData } from './types';
import { useState } from 'react';

function App() {
  const [lastUpdate, setLastUpdate] = useState<FaceData | null>(null);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 text-slate-950">
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-teal-600">LiveFaceTracking</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                Minimal real-time face tracking
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Browser-based facial landmarks, head pose, and capture stats with automatic preference for depth-capable cameras when available.
              </p>
            </div>
            {lastUpdate && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Latest confidence <span className="font-semibold text-slate-950">{(lastUpdate.confidence * 100).toFixed(1)}%</span>
              </div>
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
