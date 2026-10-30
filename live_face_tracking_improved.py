"""
Live Face Tracking — optional desktop tool.

Opens an OpenCV window and runs `face_alignment`'s 3D landmark model on webcam
frames. This is a separate desktop program: the browser app under `src/` does not
use it and does not need Python.

Privacy defaults: nothing is written to disk unless
FACE_TRACKING_SAVE_LANDMARKS is set to "true", per-frame coordinates are logged
at DEBUG level only, and the landmark history is bounded.

Usage:
    python live_face_tracking.py        # press q in the window to exit

Environment:
    FACE_TRACKING_DEVICE          cuda (default) or cpu
    FACE_TRACKING_CAMERA_INDEX    webcam index, default 0
    FACE_TRACKING_FPS_TARGET      requested capture fps, default 30
    FACE_TRACKING_SAVE_LANDMARKS  true to write landmarks_data/*.json on exit
    FACE_TRACKING_LOG_LEVEL       INFO (default) or DEBUG
"""

import json
import logging
import os
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Deque, Dict, Optional, Tuple

import cv2
import face_alignment
import numpy as np
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Bounded so an hours-long session cannot grow memory without limit.
MAX_HISTORY_FRAMES = 5000


def _env_number(name: str, default, cast: Callable[[str], float]):
    """Read a numeric environment value without crashing on bad input."""
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default

    try:
        return cast(raw)
    except ValueError:
        logger.warning("Ignoring invalid %s=%r; using %s", name, raw, default)
        return default


@dataclass
class Config:
    """Configuration for the desktop tracker."""

    device: str = os.getenv("FACE_TRACKING_DEVICE", "cuda")
    target_fps: int = _env_number("FACE_TRACKING_FPS_TARGET", 30, int)
    camera_index: int = _env_number("FACE_TRACKING_CAMERA_INDEX", 0, int)
    save_landmarks: bool = os.getenv("FACE_TRACKING_SAVE_LANDMARKS", "false").lower() == "true"
    log_level: str = os.getenv("FACE_TRACKING_LOG_LEVEL", "INFO").upper()
    history_limit: int = MAX_HISTORY_FRAMES
    output_dir: Path = field(default_factory=lambda: Path("landmarks_data"))

    def __post_init__(self):
        # Only create the output directory when the user actually opted in.
        if self.save_landmarks:
            self.output_dir.mkdir(exist_ok=True)


class LandmarkExtractor:
    """Extracts 3D facial landmarks with the face_alignment package."""

    def __init__(self, device: str = "cuda"):
        self.device = self._validate_device(device)
        logger.info("Initializing face alignment model on %s", self.device)

        # A single 3D pass: the 3D result already contains x and y, so a second
        # 2D network per frame only doubled the work.
        self.aligner = face_alignment.FaceAlignment(
            face_alignment.LandmarksType.THREE_D,
            device=self.device,
            flip_input=False,
        )

    @staticmethod
    def _validate_device(device: str) -> str:
        """Validate and fall back to CPU when CUDA is unavailable."""
        if device.lower() != "cuda":
            return "cpu"

        try:
            import torch
        except ImportError:
            logger.warning("PyTorch not available, using CPU")
            return "cpu"

        if torch.cuda.is_available():
            return "cuda"

        logger.warning("CUDA not available, falling back to CPU")
        return "cpu"

    def extract_landmarks(self, frame: np.ndarray) -> Optional[np.ndarray]:
        """
        Return the first detected face's landmarks, or None.

        Args:
            frame: Input frame in BGR format
        """
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        try:
            predictions = self.aligner.get_landmarks(rgb_frame)
        except (RuntimeError, ValueError) as error:
            # face_alignment raises on frames it cannot process, which happens
            # constantly with motion blur or a face leaving the frame.
            logger.debug("Landmark extraction failed: %s", error)
            return None

        if not predictions:
            return None

        return predictions[0]


@dataclass
class FaceLandmarks:
    """Container for the key facial landmarks of one frame."""

    timestamp: float
    nose_tip: np.ndarray
    chin: np.ndarray
    left_eye: np.ndarray
    right_eye: np.ndarray
    mouth: np.ndarray

    def to_dict(self) -> Dict:
        """Convert landmarks to a JSON-serialisable dictionary."""
        return {
            'timestamp': self.timestamp,
            'nose_tip': self.nose_tip.tolist(),
            'chin': self.chin.tolist(),
            'left_eye': self.left_eye.tolist(),
            'right_eye': self.right_eye.tolist(),
            'mouth': self.mouth.tolist(),
        }


class PerformanceMonitor:
    """Monitors and tracks performance metrics."""

    def __init__(self, window_size: int = 30):
        self.window_size = window_size
        self.frame_times: Deque[float] = deque(maxlen=window_size)
        self.frame_stamps: Deque[float] = deque(maxlen=window_size)
        self.start_time = time.perf_counter()
        self.frame_count = 0

    def record_frame(self, processing_time: float):
        """Record how long one frame took to process."""
        self.frame_times.append(processing_time)
        self.frame_stamps.append(time.perf_counter())
        self.frame_count += 1

    def get_fps(self) -> float:
        """Frames per second over the recorded window, from real timestamps."""
        if len(self.frame_stamps) < 2:
            return 0.0

        span = self.frame_stamps[-1] - self.frame_stamps[0]
        if span <= 0:
            return 0.0

        return (len(self.frame_stamps) - 1) / span

    def get_stats(self) -> Dict:
        """Get performance statistics."""
        if not self.frame_times:
            return {}

        return {
            'fps': self.get_fps(),
            'avg_processing_ms': float(np.mean(self.frame_times)) * 1000,
            'max_processing_ms': float(np.max(self.frame_times)) * 1000,
            'total_frames': self.frame_count,
            'elapsed_time_s': time.perf_counter() - self.start_time,
        }


class FaceTracker:
    """Main desktop tracker application."""

    def __init__(self, config: Config):
        self.config = config
        self.setup_logging()
        self.extractor = LandmarkExtractor(config.device)
        self.monitor = PerformanceMonitor()
        self.cap: Optional[cv2.VideoCapture] = None
        self.running = False
        self.landmarks_history: Deque[FaceLandmarks] = deque(maxlen=config.history_limit)

    def setup_logging(self):
        """Configure logging; a log file is only written when saving is enabled."""
        logging.basicConfig(
            level=getattr(logging, self.config.log_level, logging.INFO),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[logging.StreamHandler(sys.stdout)],
            force=True,
        )

        if self.config.save_landmarks:
            logging.getLogger().addHandler(logging.FileHandler('face_tracking.log'))

    def initialize_webcam(self) -> bool:
        """Initialize webcam capture."""
        self.cap = cv2.VideoCapture(self.config.camera_index)
        if not self.cap.isOpened():
            logger.error("Error: Could not open webcam %s.", self.config.camera_index)
            return False

        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.cap.set(cv2.CAP_PROP_FPS, self.config.target_fps)

        logger.info("Webcam initialized successfully")
        return True

    def extract_key_landmarks(self, landmarks: np.ndarray) -> FaceLandmarks:
        """Extract the landmarks this tool reports."""
        return FaceLandmarks(
            timestamp=time.time(),
            nose_tip=landmarks[30],
            chin=landmarks[8],
            left_eye=np.mean(landmarks[36:42], axis=0),
            right_eye=np.mean(landmarks[42:48], axis=0),
            mouth=np.mean(landmarks[48:60], axis=0),
        )

    def draw_landmarks(self, frame: np.ndarray, landmarks: Optional[np.ndarray]) -> np.ndarray:
        """Draw all detected landmarks on the frame."""
        if landmarks is None:
            return frame

        for x, y, _z in landmarks:
            cv2.circle(frame, (int(x), int(y)), 1, (0, 255, 0), -1)

        return frame

    def print_landmarks_info(self, landmarks: FaceLandmarks):
        """Log the reported landmarks; per-frame coordinates stay at DEBUG."""
        logger.debug(
            "Nose: X=%.2f, Y=%.2f, Z=%.2f | Chin: X=%.2f, Y=%.2f, Z=%.2f",
            landmarks.nose_tip[0], landmarks.nose_tip[1], landmarks.nose_tip[2],
            landmarks.chin[0], landmarks.chin[1], landmarks.chin[2],
        )

    def display_stats(self, frame: np.ndarray) -> np.ndarray:
        """Draw performance statistics on the frame."""
        stats = self.monitor.get_stats()
        fps = stats.get('fps', 0.0)
        text = f"FPS: {fps:.1f} | Frames: {self.monitor.frame_count}"
        cv2.putText(frame, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        return frame

    def process_frame(self, frame: np.ndarray) -> np.ndarray:
        """Run one detection pass and return the annotated frame."""
        start_time = time.perf_counter()

        landmarks = self.extractor.extract_landmarks(frame)
        frame = self.draw_landmarks(frame, landmarks)

        if landmarks is not None:
            face_landmarks = self.extract_key_landmarks(landmarks)
            self.landmarks_history.append(face_landmarks)
            self.print_landmarks_info(face_landmarks)

        self.monitor.record_frame(time.perf_counter() - start_time)

        return self.display_stats(frame)

    def save_landmarks(self):
        """Write the session's landmarks to landmarks_data/."""
        if not self.landmarks_history:
            logger.warning("No landmarks to save")
            return

        timestamp = time.strftime("%Y%m%d_%H%M%S")
        output_path = self.config.output_dir / f"landmarks_{timestamp}.json"

        try:
            with open(output_path, 'w', encoding='utf-8') as file:
                json.dump([lm.to_dict() for lm in self.landmarks_history], file, indent=2)
        except OSError as error:
            logger.error("Failed to save landmarks: %s", error)
            return

        logger.info("Saved %s landmarks to %s", len(self.landmarks_history), output_path)

    def run(self):
        """Main tracking loop."""
        if not self.initialize_webcam():
            return

        self.running = True
        logger.info("Starting face tracking... Press 'q' in the window to exit")

        try:
            while self.running and self.cap is not None:
                ret, frame = self.cap.read()
                if not ret:
                    logger.error("Failed to capture frame")
                    break

                cv2.imshow('Live Face Tracking', self.process_frame(frame))

                if cv2.waitKey(1) & 0xFF == ord('q'):
                    logger.info("Quit signal received")
                    break

        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        finally:
            self.shutdown()

    def shutdown(self):
        """Cleanup resources."""
        self.running = False

        if self.cap is not None:
            self.cap.release()

        cv2.destroyAllWindows()

        if self.config.save_landmarks:
            self.save_landmarks()

        logger.info("Final stats: %s", self.monitor.get_stats())
        logger.info("Face tracking stopped")


def main():
    """Main entry point."""
    config = Config()
    tracker = FaceTracker(config)
    tracker.run()


if __name__ == "__main__":
    main()
