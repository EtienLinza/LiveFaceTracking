/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Base44 sandbox preview: the platform proxy forwards requests with the sandbox
// host in the `Host` header, which Vite 5.4's dev-server host check rejects.
// Only when BASE44_PREVIEW_MODE is exactly "1" do we widen the allowlist to the
// platform's own hostnames; otherwise the default Vite behaviour is unchanged.
const sandboxAllowedHosts = [
  process.env.BASE44_SANDBOX_HOST_DOMAIN
    ? `.${process.env.BASE44_SANDBOX_HOST_DOMAIN}`
    : null,
  process.env.BASE44_PUBLIC_HOST_SUFFIX
    ? `3000-${process.env.BASE44_PUBLIC_HOST_SUFFIX}`
    : null,
].filter((host): host is string => Boolean(host));

const isBase44Preview =
  process.env.BASE44_PREVIEW_MODE === '1' && sandboxAllowedHosts.length > 0;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    ...(isBase44Preview ? { allowedHosts: sandboxAllowedHosts } : {}),
  },
  build: {
    outDir: 'dist',
    // Sourcemaps used to add ~17 MB to the build for no deployment benefit.
    sourcemap: false,
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
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});
