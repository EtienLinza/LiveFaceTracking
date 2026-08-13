# Live Face Tracking System - Quick Reference

## 🚀 Starting the Application

### Frontend Application
```bash
npm run dev
```

Then open: http://localhost:5173

**Optional: Python Script** (for standalone tracking)
```bash
python live_face_tracking.py
```

---

## ⚡ Quick Commands

```bash
# Install dependencies
npm install

# Run application
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Lint code
npm run lint

# Format code
npm run format
```

---

## 📊 Application URLs

- **Frontend**: http://localhost:5173

---

## 🎯 Features

✅ Real-time face tracking
✅ 3D head pose estimation
✅ Performance monitoring (FPS, latency)
✅ Data export (JSON)
✅ Error handling
✅ Browser-based (no server)
✅ Database persistence

---

## 🐛 Troubleshooting

**Webcam not working?**
- Check browser permissions
- Ensure no other app uses the camera
- Try a different browser

**Low FPS?**
- Close background apps
- Try CPU mode if GPU unavailable
- Reduce screen resolution

**Database connection error?**
- Verify .env credentials
- Check internet connection
- Confirm Supabase project is active

---

## 📚 Documentation

- **SETUP_GUIDE.md** - Complete installation guide
- **README_NEW.md** - Full documentation
- **IMPROVEMENTS_SUMMARY.md** - All improvements made
- **src/** - Source code with comments

---

## 🚢 Deployment

### Build
```bash
npm run build
```

### Deploy to Vercel
```bash
npm install -g vercel
vercel deploy
```

### Docker
```bash
docker build -t face-tracking .
docker run -p 5173:5173 face-tracking
```

---

## 💡 Tips

- Use CUDA for 10-50x faster processing (if GPU available)
- Record sessions for analysis
- Export data for external processing
- Check API documentation at /docs
- Monitor performance metrics in dashboard

---

**Version**: 2.0.0  
**Need help?** Check SETUP_GUIDE.md or README_NEW.md
