# AGENTS.md — working on this project (Base44 sandbox notes)

Live Face Tracking is a **browser-only** app: Vite + React + TypeScript, with face
detection running client-side through TensorFlow.js / MediaPipe FaceMesh. There is
no backend, no database and **no external credentials** — model weights are fetched
publicly at runtime from the TensorFlow model CDN. The optional Python script
(`live_face_tracking.py`, `requirements.txt`) is a separate desktop tool and is
deliberately **not** part of the preview environment.

## Run it

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

- Single service `web` (image `node:22-bookworm`), repo bind-mounted at `/app`.
- Dependencies are installed on container start from `package-lock.json`
  (`npm ci`) into a named volume `web_node_modules`, so the bind-mounted repo
  stays clean and edits are picked up by Vite's dev server immediately.
- Vite dev server listens on `5173`, published to host port **3000** (the preview
  entry point). Live reload works; dependency changes need `up -d` again.
- Healthcheck probes `http://127.0.0.1:5173/` with Node's global `fetch`.

Stack versions that matter: Node **22.12+** (Vite 8 and Vitest 5 both require it),
Vite 8 (Rolldown-based — do not pass `build.minify: 'esbuild'`, the `esbuild`
package is no longer bundled), Vitest 5, ESLint 8 with `@typescript-eslint` 8.

## Checks

```bash
docker compose -f docker-compose.base44.yml exec -T web npm run type-check
docker compose -f docker-compose.base44.yml exec -T web npm run lint
docker compose -f docker-compose.base44.yml exec -T web npm test
docker compose -f docker-compose.base44.yml exec -T web npm run build   # tsc --noEmit + vite build
```

All four are expected to pass with **no output** from type-check/lint and 17
passing tests. `npm audit` reports **0 vulnerabilities**; do not reintroduce the
old advisories (Vite ≤6.4, esbuild, old typescript-eslint, glob/minimatch).

Tests live next to the code (`src/utils.test.ts`,
`src/hooks/index.test.ts`) and run in jsdom through Vitest. They cover the metric
hooks, the history/session split, `useLocalStorage`, and the head-pose math.
Nothing exercises the live camera loop — no automation in the sandbox can, see
"No camera in the sandbox" below.

CI (`.github/workflows/ci.yml`) runs install, type-check, lint, test and build.

## What the app measures (keep these honest)

- `useFrameMetrics` derives FPS from frame-completion timestamps inside a
  one-second window and counts the whole session in `totalFrames`; it publishes
  to React at most twice a second.
- `useFaceDataHistory` keeps a capped, newest-first display window for the chart
  and a separate oldest-first `sessionRef` buffer that is what **Export JSON**
  writes. `getStats()` describes the session, not the window.
- There is no confidence score: the detector's `Face` type is only
  `{ keypoints, box }`, and the old `0.95` fallback was fabricated. Do not add one
  back.
- `estimateHeadPoseFromPoints` is a 2D landmark-ratio heuristic, not a solved 3D
  pose. The UI shows it relative to a baseline captured on the first frame of the
  session and calls it an indicator. If you change the math, keep the label
  truthful and update the comment plus `src/utils.test.ts`.

## Sandbox-specific configuration

- **`vite.config.ts` — dev-server host allowlist.** Vite rejects requests whose
  `Host` header is not allowlisted (the preview proxy forwards
  `<port>-<sandbox id>.<sandbox domain>`), which would return *"Blocked request.
  This host is not allowed."*. When `BASE44_PREVIEW_MODE` is exactly `"1"` the
  config appends the platform hostnames
  (`.${BASE44_SANDBOX_HOST_DOMAIN}` and `3000-${BASE44_PUBLIC_HOST_SUFFIX}`) to
  `server.allowedHosts`. With the flag unset or any other value, `allowedHosts` is
  not set at all and Vite's default behaviour is unchanged. The variables are
  passed into the service by `docker-compose.base44.yml`; nothing is hardcoded.
- The compose command also publishes `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`,
  which Vite ≥6.1 appends to `allowedHosts` itself. The service must keep binding
  `0.0.0.0` — the preview proxy reaches it from outside the container.
- **`postcss.config.js` — required for styling.** The project has
  `tailwind.config.js` and uses Tailwind utility classes everywhere; without a
  PostCSS config the `@tailwind` directives are served raw and the UI renders
  unstyled. This file is ordinary application config, not sandbox-specific.

## Gotchas

- **No camera in the sandbox**: the preview browser exposes no usable video
  input, so the app legitimately shows its "Camera permission or device error"
  card and the video area stays black. The camera list, Start tracking, the
  landmark overlay and the pose readout can only be checked in a real browser
  with a webcam. Verify the rest (layout, options, metrics cards, export button
  state, error card) in the preview and say so.
- `src/components/FaceTracker.tsx` keeps the detection loop outliving React
  renders: options are read through refs (`showLandmarksRef`, `showHeadPoseRef`)
  and `loopIdRef` invalidates an in-flight iteration after Stop, so a stale loop
  cannot re-queue itself. Keep that structure — reading options from the
  `useCallback` closure is exactly the bug that made the checkboxes inert.
- The model is disposed in the init effect's cleanup and when the component
  unmounts while weights are still loading. React StrictMode double-mounts in
  dev, so a missing `dispose()` leaks a full model per mount.
- `npm run build` writes `dist/` into the bind-mounted repo; it is gitignored.
  Do not commit build output or `node_modules` (an old `node_modules/.vite`
  cache was once committed — that is why the repo had 78 tracked files under
  `node_modules/`).

## Performance & responsive behaviour (keep when editing)

- `@tensorflow/tfjs` and `@tensorflow-models/face-landmarks-detection` are imported
  dynamically inside the model-init effect, and `chart.js` lives in
  `src/components/NoseChart.tsx` behind `React.lazy`. The app shell is ~55 kB gzip;
  do not convert these back to static imports (that put ~2 MB in the initial bundle).
- `useFaceDataHistory` collects rows in a ref and only publishes React state every
  200 ms, and `onDataUpdate` is throttled the same way. Rendering at the detection
  rate is what made phones stutter.
- The detection loop is throttled to `desktop 30 / compact 20` fps, captures 720p on
  large screens and 640x480 on coarse-pointer/small screens, and no longer copies the
  video frame onto the canvas (`<video>` and `<canvas>` share the same `object-cover`
  crop; only landmarks/overlay are drawn). Canvas 2D context is cached in a ref.
- Layout: single column below `md`, two columns from `md`; grid/flex children need
  `min-w-0` or the video forces sideways scrolling. Touch targets are at least 44 px
  and form controls use `text-base` on mobile so iOS does not zoom on focus.
- Sourcemaps are off in the production build (they were ~17 MB of dead weight).

## How to verify it works

1. `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → `200`, and the
   HTML contains `/@vite/client` (proving the dev server serves live source, not a
   built bundle).
2. The page renders the header plus the "Face tracking preview" card.
3. `curl -s http://localhost:3000/src/index.css | grep -c 'bg-slate-950'` → non-zero
   (Tailwind actually compiled).
4. `npm run type-check`, `npm run lint`, `npm test`, `npm run build` all pass inside
   the `web` service.
