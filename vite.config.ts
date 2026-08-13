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
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': [
            'react',
            'react-dom',
            '@tensorflow/tfjs',
            '@tensorflow-models/face-landmarks-detection',
          ],
          'chart': ['chart.js', 'react-chartjs-2'],
          'ui': ['react-webcam'],
        },
      },
    },
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
      '@supabase/supabase-js',
    ],
  },
});