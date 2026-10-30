# Live Face Tracking System

A browser-based demo that draws facial landmarks from your webcam and reports an
**approximate head orientation indicator**. Everything runs on the device: no
backend, no uploads, no database.

Face detection uses MediaPipe FaceMesh through TensorFlow.js
(`@tensorflow-models/face-landmarks-detection`, `refineLandmarks: true`). Model
weights are downloaded from the TensorFlow model CDN at runtime, so the first
load needs network access; video frames never leave the browser.

This is a prototype. It is not production ready, and it was never load tested on
a real camera session.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173, allow camera access, then press **Start tracking**.

Requires Node.js 22.12 or newer (Vite 8 and Vitest 5 both need it) and a webcam.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload on port 5173 |
| `npm run build` | `tsc --noEmit` then a production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run type-check` | TypeScript only |
| `npm run lint` | ESLint over `src` |
| `npm test` | Vitest run (unit tests for the metric and storage hooks plus the pose math) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run clean` | Delete `dist/` |

CI (`.github/workflows/ci.yml`) runs type-check, lint, tests and the build on
every push and pull request.

## What the app reports

Each metric is measured from actual frame completions, not estimated:

- **FPS** — number of completed detection frames inside the last second. It
  drops as the loop slows down; it is not a target value.
- **Processing** — average time per frame for inference plus overlay drawing.
  Camera capture and browser compositing time are **not** included, so this is
  not true end-to-end latency.
- **Frames** — detected frames in the current session. It keeps counting past
  the size of the chart window.
- **Duration** — elapsed session time, from the first tracked frame.

The head-pose readout is an **indicator, not a measurement**: roll is the real
in-plane angle between the eye corners, while yaw and pitch are scaled 2D
offsets with no 3D solve (no PnP, no transformation matrix). A resting head does
not read zero, so the overlay shows values relative to the first frame of the
session. Blinks no longer perturb it because the eye *corners* (landmarks 33 and
263) are used rather than the upper eyelids.

The detector does not report a confidence score, so the app no longer shows one.

## Data export

**Export JSON** downloads everything captured since **Start**, not just the
portion visible in the chart:

```json
{
  "session": {
    "totalFrames": 742,
    "averageFps": 29.6,
    "sessionDuration": 25100,
    "startTime": 1793419200123,
    "endTime": 1793419225223,
    "generatedAt": "2026-10-31T00:14:10.123Z"
  },
  "landmarks": [
    {
      "timestamp": 1793419200156,
      "nose_x": 641.2, "nose_y": 358.4, "nose_z": -12.5,
      "chin_x": 639.8, "chin_y": 522.1, "chin_z": 3.4,
      "left_eye_x": 700.4, "left_eye_y": 300.2, "left_eye_z": -8.1,
      "right_eye_x": 580.9, "right_eye_y": 299.4, "right_eye_z": -7.7,
      "mouth_x": 641.0, "mouth_y": 456.7, "mouth_z": -6.9
    }
  ]
}
```

Coordinates are in video pixels, `*_z` is the detector's relative depth. Face
geometry can count as biometric data under regulations such as the GDPR: the
file is generated locally and never uploaded by this app. **Clear** empties the
session buffer.

## Cameras

The camera picker is filled in after the browser grants permission (browsers
hide labels and device IDs until then) and refreshes when a camera is plugged in
or removed. The selected device is requested as a preference (`ideal`), so if it
disappears the browser falls back to the default camera instead of failing.

## Known limitations

- Head orientation is a 2D heuristic, as described above. Do not treat the
  numbers as degrees of rotation.
- The app needs WebGL for acceptable speed. Without it TensorFlow.js falls back
  to a slower backend (no WASM backend is installed).
- Model weights come from `tfhub.dev` (and `storage.googleapis.com`) at runtime;
  self-hosting them is not implemented.
- No test covers the live camera loop. The unit tests cover the metric hooks,
  the pose math and the storage hook; the camera path needs a real device.
- The session buffer that the export writes grows with the session (roughly a
  couple of hundred bytes per frame). For very long sessions use **Export JSON**
  and then **Clear**, which empties it.
- The Vite dev server is a development tool. Build with `npm run build` and
  serve `dist/` from a static host with a Content-Security-Policy that permits
  the model hosts if you expose the app publicly.

## Optional Python desktop script

`live_face_tracking.py` is a separate OpenCV window based on the
[`face-alignment`](https://github.com/1adrianb/face-alignment) package. It is not
used by the web app, needs Python 3.10 or 3.11 (because of the pinned `numpy`),
and a webcam on the machine running it.

```bash
python3.11 -m venv .venv
source .venv/bin/activate      # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python live_face_tracking.py   # press q in the window to exit
```

Defaults: CPU device unless CUDA is available, one 3D landmark pass per frame,
a bounded in-memory history, and **no** landmark saving. Set
`FACE_TRACKING_SAVE_LANDMARKS=true` to write `landmarks_data/landmarks_*.json`
on exit, and `FACE_TRACKING_LOG_LEVEL=DEBUG` for per-frame coordinates in the
log. Note that the first run downloads model weights from `adrianbulat.com`.

## License

MIT — see [LICENSE](LICENSE).
