# Live Face Tracking - Quick Setup Guide

## Prerequisites

- **Node.js 16+** - Download from https://nodejs.org/
- **Webcam** - Built-in or external
- **Modern browser** - Chrome, Firefox, Safari, or Edge

## Installation (3 Steps)

### Step 1: Install Dependencies
```bash
cd c:\Users\Work\Desktop\LiveFaceTracking
npm install
```

### Step 2: Run Application
```bash
npm run dev
```

### Step 3: Open Browser
Visit: **http://localhost:5173**

That's it! 🎉

## Using the App

1. **Allow Webcam Access** - Click "Allow" when prompted
2. **Click "Start Tracking"** - Begin real-time face detection
3. **View Stats** - See FPS, latency, and performance metrics
4. **Download Data** - Export tracking data to JSON
5. **Click "Stop Tracking"** - End the session

## Settings

- **Show Landmarks** - Display facial points
- **Show Head Pose** - Show rotation angles (yaw, pitch, roll)
- **Theme** - Dark/Light/Auto modes

## Troubleshooting

**App doesn't load?**
- Make sure you're at http://localhost:5173 (not 5174, 5175, etc.)
- Check that `npm run dev` is still running in your terminal

**Webcam not working?**
- Check browser permissions (camera access)
- Try a different browser
- Make sure no other app is using the webcam

**Low FPS?**
- Close other applications
- Try refreshing the page (F5)
- Use a simpler background

## Python Script (Optional)

If you want the standalone Python version:
```bash
pip install -r requirements.txt
python live_face_tracking.py
```

---

**That's all you need!** The app runs entirely in your browser with no server or database required.
