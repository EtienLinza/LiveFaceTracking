# Live Face Tracking - Complete Setup Guide

This project has two ways to run face tracking:

1. **Recommended web app** - runs in your browser at `http://localhost:5173` using React, Vite, TensorFlow.js, and your webcam.
2. **Optional Python desktop script** - opens an OpenCV window and uses the `face-alignment` Python package.

Most users should run the **web app** first. The Python script is separate and is not required for the browser app.

---

## 1. Requirements

### Web app requirements

- Node.js 18 or newer. Node 20 LTS is a good choice.
- npm. It is installed with Node.js.
- A webcam.
- A modern browser such as Chrome, Edge, Firefox, or Safari.

### Optional Python script requirements

- Python **3.10 or 3.11** is recommended.
- Do **not** use Python 3.13 for the current pinned Python requirements. Several pinned scientific/ML packages do not provide compatible wheels there, so pip may try to build packages from source and fail.
- A webcam.

---

## 2. Web App Setup on Windows

Open PowerShell, then run:

```powershell
cd C:\path\to\LiveFaceTracking
npm install
npm run dev
```

When Vite prints a local URL, open it in your browser:

```text
http://localhost:5173/
```

Keep the PowerShell window open while using the app. Closing it or pressing `q` in the Vite terminal stops the local development server.

---

## 3. Web App Setup on macOS/Linux

```bash
cd /path/to/LiveFaceTracking
npm install
npm run dev
```

Then open:

```text
http://localhost:5173/
```

---

## 4. How to Use the Web App

1. Open `http://localhost:5173/` while `npm run dev` is still running.
2. Allow camera access when the browser asks.
3. Wait for the status to finish initializing.
4. Click **Start tracking**.
5. Keep your face visible and well lit.
6. Click **Stop** when finished.
7. Click **Export JSON** if you want a JSON export of the whole session's landmark data.
8. The **Clear** button empties the session buffer.

---

## 5. Fixing `http://localhost:5173/` 404

The message:

```text
This localhost page can’t be found
No webpage was found for the web address: http://localhost:5173/
HTTP ERROR 404
```

usually means the browser reached something on port `5173`, but that server did not have the requested page. In this project, the browser app needs two root files:

- `index.html`
- `src/main.tsx`

Those files are now included. If you still see a 404:

1. Make sure `npm run dev` is still running.
2. Make sure you opened the exact URL Vite printed. If port `5173` is busy, Vite may use another port such as `5174`.
3. Stop and restart Vite:

```powershell
# In the terminal running Vite, press q then Enter.
npm run dev
```

4. Hard refresh the browser with `Ctrl+F5`.
5. Make sure you ran `npm run dev` from the project folder, not from `C:\WINDOWS\System32`.

---

## 6. Explanation of the npm Output You Posted

### `npm --version` showed `11.17.0`

That confirms npm is installed.

### `npm install` said `up to date`

That means npm found the dependencies already installed in `node_modules`.

### `8 vulnerabilities`

That is npm's audit report for packages in the JavaScript dependency tree. The app can still run, but you should review it with:

```powershell
npm audit
```

Use this first if npm says safe fixes are available:

```powershell
npm audit fix
```

Avoid `npm audit fix --force` unless you are ready to test breaking dependency upgrades.

### `npm warn allow-scripts`

Your npm configuration is blocking or requiring approval for package install scripts. Two packages were mentioned:

- `core-js`
- `esbuild`

For this app, `esbuild` is important because Vite uses it. Review and approve pending scripts with:

```powershell
npm approve-scripts --allow-scripts-pending
```

If npm asks interactively, approve trusted project dependencies, especially `esbuild`.

### `Failed to resolve dependency: @supabase/supabase-js, present in 'optimizeDeps.include'`

The Vite config listed `@supabase/supabase-js` as a dependency to pre-bundle, but this project does not install or use Supabase in the current browser app. That incorrect entry has been removed from `vite.config.ts`.

---

## 7. Optional Python Script Setup

The browser app does not need Python. Only follow this section if you specifically want to run the desktop script.

### Install Python 3.11

On Windows, install Python 3.11 from https://www.python.org/downloads/release/python-3119/ or with winget:

```powershell
winget install Python.Python.3.11
```

Then create a virtual environment inside the project:

```powershell
cd C:\path\to\LiveFaceTracking
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
python live_face_tracking.py
```

### Why your Python command failed

You were using Python 3.13 from the Microsoft Store path:

```text
PythonSoftwareFoundation.Python.3.13...
```

The pinned `numpy==1.24.3` dependency is not compatible with Python 3.13 wheels, so pip tried to build it and failed with:

```text
Cannot import 'setuptools.build_meta'
```

Because `pip install -r requirements.txt` failed before installing `face-alignment`, this later command also failed:

```text
ModuleNotFoundError: No module named 'face_alignment'
```

That second error is a result of the failed install, not a separate code problem.

---

## 8. Common Commands

```powershell
npm install          # Install web dependencies
npm run dev          # Start local web app
npm run build        # Verify TypeScript and production build
npm run preview      # Preview the production build after npm run build
npm audit            # Review JavaScript dependency audit report
```

Optional Python:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
python live_face_tracking.py
```
