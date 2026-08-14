import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    chunkSizeWarningLimit: 2500,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@tensorflow/tfjs',
      '@tensorflow-models/face-landmarks-detection',
      'chart.js',
      'react-chartjs-2',
      'react-webcam',
    ],
  },
});