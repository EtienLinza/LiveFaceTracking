"""
README for Live Face Tracking System

A comprehensive real-time face tracking application with 3D head pose estimation,
advanced analytics, and data persistence.
"""

# Live Face Tracking System v2.0

# Live Face Tracking System v2.0

## Overview

Live Face Tracking is a modern web application for real-time facial landmark detection with 3D head pose estimation and comprehensive performance analytics.

### Key Features

- **Real-Time Face Tracking**: Detect and track facial landmarks at 30+ FPS
- **3D Head Pose Estimation**: Calculate yaw, pitch, and roll angles in real-time
- **Live Analytics**: Track FPS, latency, confidence scores, and more
- **Performance Monitoring**: Real-time metrics and statistics display
- **Data Export**: Export tracking data in JSON format
- **Web Dashboard**: React-based UI with Tailwind CSS
- **Error Handling**: Comprehensive error logging and recovery
- **Browser-Based**: No backend server required

## Project Structure

```
LiveFaceTracking/
├── src/                          # React frontend
│   ├── components/               # React components
│   │   ├── FaceTracker.tsx       # Main tracking component
│   │   ├── ErrorBoundary.tsx     # Error handling
│   │   ├── StatsDisplay.tsx      # Statistics display
│   │   └── SettingsPanel.tsx     # User settings
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utilities and helpers
│   │   └── utils.ts              # Math utilities
│   ├── types/                    # TypeScript types
│   ├── constants.ts              # Application constants
│   ├── App.tsx                   # Main app component
│   ├── index.css                 # Tailwind styles
│   └── main.tsx                  # Entry point
├── live_face_tracking_improved.py # Optional Python script
├── live_face_tracking.py         # Optional Python entry point
├── requirements.txt              # Python dependencies
├── package.json                  # NPM dependencies
├── vite.config.ts                # Vite configuration
├── tsconfig.json                 # TypeScript configuration
├── .env.example                  # Environment variables example
└── supabase/                     # Database migrations
```

## Installation & Setup

### Prerequisites

- Node.js 16+ and npm
- Webcam

### Quick Start

1. **Install dependencies**
```bash
npm install
```

2. **Run the application**
```bash
npm run dev
```

3. **Open in browser**
Visit http://localhost:5173

## Features in Detail

### Face Tracking
- Detects up to 468 facial landmarks using MediaPipe FaceMesh
- Tracks landmarks in real-time with confidence scores
- Draws visualizations on video feed

### Head Pose Estimation
- Calculates head rotation angles (yaw, pitch, roll)
- Based on facial landmark positions
- Updates in real-time

### Analytics
- FPS monitoring
- Frame latency tracking
- Confidence score analysis
- Session duration tracking
- Face detection rate

### Data Export
- Export live tracking data to JSON
- In-memory data history (configurable)
- Real-time data download during sessions

### Error Handling
- Graceful error recovery
- Error logging
- User-friendly error messages
- Automatic fallback mechanisms

## Development

### Building for Production

```bash
npm run build
```

### Code Quality

- TypeScript for type safety
- ESLint for code linting
- Proper error handling throughout

## Performance

- Target FPS: 30+
- Average latency: 30-50ms per frame
- Memory efficient landmark detection
- Optimized database queries with indexes

## Troubleshooting

### Webcam Not Working
- Check browser permissions
- Ensure no other applications are using the webcam
- Try a different browser

### Low FPS
- Try CPU mode if GPU is not available
- Reduce screen resolution
- Close other applications

### Database Connection Issues
- Verify Supabase credentials in `.env`
- Check internet connection
- Verify database tables are created

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Tips

1. Use CUDA for GPU acceleration (when available)
2. Record data only when needed
3. Close background applications
4. Use a well-lit environment for better accuracy
5. Keep face visible and centered in frame

## Contributing

Contributions welcome! Please follow the existing code style and add tests for new features.

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please create an issue or contact the development team.

## Acknowledgments

- MediaPipe for facial landmark detection
- TensorFlow.js for web-based ML
- Supabase for database services
- FastAPI for the backend framework

---

**Version**: 2.0.0  
**Last Updated**: 2025-05-08  
**Status**: Production Ready
