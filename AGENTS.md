# AGENTS.md — running this project in the Base44 sandbox

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

Useful commands:

```bash
docker compose -f docker-compose.base44.yml logs -f web            # dev server output
docker compose -f docker-compose.base44.yml exec -T web npm run type-check
docker compose -f docker-compose.base44.yml exec -T web npm run lint
docker compose -f docker-compose.base44.yml exec -T web npm run build   # tsc --noEmit + vite build
```

`npm run lint` reports one pre-existing `react-hooks/exhaustive-deps` **warning**
(suppressed intentionally in `FaceTracker.tsx`) and **no errors**. There are no tests
in this repo.

## Why the environment setup is missing from `main`

The Base44 sandbox setup once lived in commit `8257052` but the follow-up commit
`47be856` ("Exclude Base44 sandbox setup from the pull request") **deleted**
`docker-compose.base44.yml`, `.base44/environment.json` and `AGENTS.md` so they would
not land on `main`. The merge `e5c0022` therefore shipped an app with **no dev
environment definition**, which is why the update "failed to start" in the sandbox:
nothing on port 3000, and no recorded start command or preview port. The application
code itself was fine — `tsc --noEmit`, `vite build` and the dev server all pass on
that commit. Re-creating the three files (this branch) is the whole fix; do not
expect to find a source-level build error behind that failure.

## Sandbox-specific configuration

- **`vite.config.ts` — dev-server host allowlist.** Vite 5.4 rejects requests whose
  `Host` header is not localhost (the preview proxy forwards
  `<port>-<sandbox id>.<sandbox domain>`), which would return *"Blocked request.
  This host is not allowed."*. When `BASE44_PREVIEW_MODE` is exactly `"1"` the config
  appends the platform hostnames
  (`.${BASE44_SANDBOX_HOST_DOMAIN}` and `3000-${BASE44_PUBLIC_HOST_SUFFIX}`) to
  `server.allowedHosts`. With the flag unset or any other value, `allowedHosts` is
  not set at all and Vite's default behaviour is unchanged. The three variables are
  passed into the service by `docker-compose.base44.yml`; nothing is hardcoded.
- **`postcss.config.js` — required for styling.** The project has
  `tailwind.config.js` and uses Tailwind utility classes everywhere, but shipped
  without a PostCSS config, so `@tailwind` directives in `src/index.css` were served
  raw and the UI rendered unstyled. This file is ordinary application config, not
  sandbox-specific.

## Gotchas

- `src/components/FaceTracker.tsx` did not compile as imported (the merge before
  `8257052` was incomplete). Already fixed on `main`: a missing `try {` in the
  `detect` callback, `Title` missing from the `chart.js` import while being passed to
  `ChartJS.register`, and definitions that were referenced but never declared
  (`refreshCameras`, `videoConstraints`, the small `Metric` card component, and the
  `latest` value shown in the "Latest read" panel). Keep `tsc --noEmit` clean — the
  project runs with `noUnusedLocals` / `noUnusedParameters`.
- **No camera in the sandbox**: the preview browser exposes no usable video input, so
  the app shows its "Camera permission or device error" card and the video area stays
  black. The camera list, depth-camera preference, **Start tracking** and the landmark
  overlay can only be checked in a real browser with a webcam.
- Running `npm run build` writes `dist/` into the bind-mounted repo; it is gitignored.

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
- `estimateHeadPoseFromPoints` exists so a frame does not build 468 coordinate arrays;
  `estimateHeadPose` still works on landmark arrays for other callers.
- Layout: single column below `md`, two columns from `md`; grid/flex children need
  `min-w-0` or the video forces sideways scrolling. Touch targets are at least 44 px
  and form controls use `text-base` on mobile so iOS does not zoom on focus.

## How to verify it works

1. `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → `200`, and the
   HTML contains `/@vite/client` (proving the dev server serves live source, not a
   built bundle).
2. The page renders the header plus the "Face tracking preview" card.
3. `curl -s http://localhost:3000/src/index.css | grep -c 'bg-slate-950'` → non-zero
   (Tailwind actually compiled).
4. `docker compose -f docker-compose.base44.yml exec -T web npm run build` succeeds.
