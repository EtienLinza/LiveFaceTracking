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

There are no tests in this repo.

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

## Gotchas found while getting it to run

- `src/components/FaceTracker.tsx` did not compile as imported (the last commit was
  an incomplete merge). The fixes were: a missing `try {` in the `detect` callback,
  `Title` missing from the `chart.js` import while being passed to
  `ChartJS.register`, and definitions that were referenced but never declared
  (`refreshCameras`, `videoConstraints`, the small `Metric` card component, and the
  `latest` value shown in the "Latest read" panel). `npm run type-check` now passes
  with the project's `noUnusedLocals` setting.
- **No camera in the sandbox**: the preview browser reports zero video inputs, so
  the app shows its "Camera permission or device error" card and the video area stays
  black. The camera list, depth-camera preference and the actual landmark overlay can
  only be checked in a real browser with a webcam.

## How to verify it works

1. `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → `200`.
2. The page renders the header plus the "Face tracking preview" card; the loading
   overlay disappears once the FaceMesh model is fetched (status chip goes `idle`).
3. Clicking **Start tracking** flips the status chip to `tracking`; the **Landmarks**
   and **Head pose** checkboxes persist through `localStorage`.
4. `curl -s http://localhost:3000/src/index.css | grep -c 'bg-slate-950'` → non-zero
   (Tailwind actually compiled).
