// Settings and preferences panel
import React, { useState } from 'react';
import { useLocalStorage } from '../hooks';

interface SettingsPanelProps {
  onClose?: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [showLandmarks, setShowLandmarks] = useLocalStorage('showLandmarks', true);
  const [showHeadPose, setShowHeadPose] = useLocalStorage('showHeadPose', true);
  const [theme, setTheme] = useLocalStorage('theme', 'dark');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Display Settings */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Display</h3>
            <div className="space-y-3">
              <ToggleSetting
                label="Show Landmarks"
                checked={showLandmarks}
                onChange={setShowLandmarks}
              />
              <ToggleSetting
                label="Show Head Pose"
                checked={showHeadPose}
                onChange={setShowHeadPose}
              />
            </div>
          </div>

          {/* Appearance Settings */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Appearance</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 text-gray-300">
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="auto">Auto</option>
                </select>
                <span>Theme</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold"
            >
              Close
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
            >
              Reset All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ToggleSettingProps {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleSetting({ label, checked, onChange }: ToggleSettingProps) {
  return (
    <label className="flex items-center gap-3 text-gray-300 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 rounded cursor-pointer"
      />
      <span>{label}</span>
    </label>
  );
}

export default SettingsPanel;
