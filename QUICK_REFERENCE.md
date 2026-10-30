# Live Face Tracking System — Quick Reference

## Start the web app

```bash
npm install
npm run dev
```

Then open http://localhost:5173 and allow camera access.

Optional desktop script (separate tool, not part of the web app):

```bash
pip install -r requirements.txt
python live_face_tracking.py
```

## Commands

```bash
npm run dev          # Dev server with hot reload
npm run build        # Type-check + production build into dist/
npm run type-check   # TypeScript only
npm run lint         # ESLint
npm test             # Unit tests (Vitest)
npm run format       # Prettier
```

## What it does

- Detect 468 face landmarks from the webcam in the browser (TensorFlow.js +
  MediaPipe FaceMesh).
- Draw landmarks and a head orientation overlay on the video.
- Report FPS, per-frame processing time, frame count and session duration.
- Export the full session's landmark readings as JSON.

Head orientation is an **approximate indicator** relative to the first frame of
the session, not a measured 3D pose. The detector does not report a confidence
score, so none is shown.

## Privacy

Video stays in the browser. The only network requests are the model weights from
`tfhub.dev` and `storage.googleapis.com`. The JSON export is generated locally.

## Troubleshooting

**No camera / permission error**
- Allow camera access for the page, close other apps using the camera, and try
  another browser. The camera list only fills in after permission is granted.

**Low FPS**
- The processing figure covers inference plus drawing. Close other GPU-heavy
  tabs; on phones the app already captures 640×480 at a 20 fps target.

**Model never finishes loading**
- The weights are fetched from `tfhub.dev` on first use; check that the network
  allows it.

## Documentation

- `README.md` — what the app does, metric definitions, export format, limits
- `SETUP_GUIDE_SIMPLE.md` — step-by-step setup help
- `AGENTS.md` — notes for working on this repo
- `src/` — source code with comments

## Deploying

`npm run build` writes static files to `dist/`. Serve that directory from any
static host. Do not expose the Vite dev server publicly.
