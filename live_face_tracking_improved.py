"""
Live Face Tracking Application

A comprehensive Python application for real-time face tracking with 2D/3D landmark detection,
performance monitoring, and data persistence capabilities.
"""

import logging
import sys
import time
from typing import Optional, Tuple, Dict, List
from dataclasses import dataclass
from pathlib import Path
from enum import Enum
import cv2
import numpy as np
import face_alignment
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()


class DeviceType(Enum):
    """Supported device types for face alignment model."""
    CPU = "cpu"
    CUDA = "cuda"


@dataclass
class Config:
    """Configuration for face tracking application."""
    device: str = os.getenv("FACE_TRACKING_DEVICE", "cuda")
    target_fps: int = int(os.getenv("FACE_TRACKING_FPS_TARGET", "30"))
    confidence_threshold: float = float(os.getenv("FACE_TRACKING_CONFIDENCE_THRESHOLD", "0.5"))
    enable_recording: bool = os.getenv("FACE_TRACKING_ENABLE_RECORDING", "false").lower() == "true"
    save_landmarks: bool = os.getenv("FACE_TRACKING_SAVE_LANDMARKS", "true").lower() == "true"
    log_level: str = os.getenv("FACE_TRACKING_LOG_LEVEL", "INFO")
    output_dir: Path = Path("landmarks_data")

    def __post_init__(self):
        self.output_dir.mkdir(exist_ok=True)


class LandmarkExtractor:
    """Extracts facial landmarks from frames using face_alignment library."""

    def __init__(self, device: str = "cuda"):
        """
        Initialize the landmark extractor.
        
        Args:
            device: Device type ('cuda' or 'cpu')
            
        Raises:
            ValueError: If device is invalid or if model fails to load
        """
        self.device = self._validate_device(device)
        logger.info(f"Initializing face alignment models on {self.device}")
        
        try:
            self.fa_2d = face_alignment.FaceAlignment(
                face_alignment.LandmarksType.TWO_D,
                device=self.device,
                flip_input=False
            )
            self.fa_3d = face_alignment.FaceAlignment(
                face_alignment.LandmarksType.THREE_D,
                device=self.device,
                flip_input=False
            )
            logger.info("Face alignment models loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load face alignment models: {e}")
            raise

    @staticmethod
    def _validate_device(device: str) -> str:
        """Validate and potentially fallback device selection."""
        if device.lower() == "cuda":
            try:
                import torch
                if torch.cuda.is_available():
                    return "cuda"
                else:
                    logger.warning("CUDA not available, falling back to CPU")
                    return "cpu"
            except ImportError:
                logger.warning("PyTorch not available, using CPU")
                return "cpu"
        return "cpu"

    def extract_landmarks(self, frame: np.ndarray) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
        """
        Extract 2D and 3D landmarks from frame.
        
        Args:
            frame: Input frame in BGR format
            
        Returns:
            Tuple of (landmarks_2d, landmarks_3d) or (None, None) if no faces detected
        """
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            preds_2d = self.fa_2d.get_landmarks(rgb_frame)
            preds_3d = self.fa_3d.get_landmarks(rgb_frame)
            return preds_2d, preds_3d
        except Exception as e:
            logger.warning(f"Error extracting landmarks: {e}")
            return None, None


@dataclass
class FaceLandmarks:
    """Container for facial landmark data."""
    timestamp: float
    nose_tip: np.ndarray
    chin: np.ndarray
    left_eye: np.ndarray
    right_eye: np.ndarray
    mouth: np.ndarray
    landmarks_2d: Optional[np.ndarray] = None
    landmarks_3d: Optional[np.ndarray] = None

    def to_dict(self) -> Dict:
        """Convert landmarks to dictionary format."""
        return {
            'timestamp': self.timestamp,
            'nose_tip': self.nose_tip.tolist() if self.nose_tip is not None else None,
            'chin': self.chin.tolist() if self.chin is not None else None,
            'left_eye': self.left_eye.tolist() if self.left_eye is not None else None,
            'right_eye': self.right_eye.tolist() if self.right_eye is not None else None,
            'mouth': self.mouth.tolist() if self.mouth is not None else None,
        }


class PerformanceMonitor:
    """Monitors and tracks performance metrics."""

    def __init__(self, window_size: int = 30):
        """Initialize performance monitor."""
        self.window_size = window_size
        self.frame_times: List[float] = []
        self.start_time = time.time()
        self.frame_count = 0

    def record_frame(self, processing_time: float):
        """Record frame processing time."""
        self.frame_times.append(processing_time)
        if len(self.frame_times) > self.window_size:
            self.frame_times.pop(0)
        self.frame_count += 1

    def get_fps(self) -> float:
        """Get current FPS."""
        if not self.frame_times:
            return 0.0
        return 1.0 / np.mean(self.frame_times) if np.mean(self.frame_times) > 0 else 0.0

    def get_stats(self) -> Dict:
        """Get performance statistics."""
        if not self.frame_times:
            return {}
        return {
            'fps': self.get_fps(),
            'avg_frame_time_ms': np.mean(self.frame_times) * 1000,
            'max_frame_time_ms': np.max(self.frame_times) * 1000,
            'total_frames': self.frame_count,
            'elapsed_time_s': time.time() - self.start_time,
        }


class FaceTracker:
    """Main face tracking application."""

    def __init__(self, config: Config):
        """Initialize face tracker."""
        self.config = config
        self.setup_logging()
        self.extractor = LandmarkExtractor(config.device)
        self.monitor = PerformanceMonitor()
        self.cap: Optional[cv2.VideoCapture] = None
        self.running = False
        self.landmarks_history: List[FaceLandmarks] = []

    def setup_logging(self):
        """Configure logging."""
        log_level = getattr(logging, self.config.log_level.upper(), logging.INFO)
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(sys.stdout),
                logging.FileHandler('face_tracking.log')
            ]
        )

    def initialize_webcam(self) -> bool:
        """Initialize webcam capture."""
        try:
            self.cap = cv2.VideoCapture(0)
            if not self.cap.isOpened():
                logger.error("Error: Could not open webcam.")
                return False
            
            # Set webcam properties for better performance
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.cap.set(cv2.CAP_PROP_FPS, self.config.target_fps)
            
            logger.info("Webcam initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize webcam: {e}")
            return False

    def extract_key_landmarks(self, landmarks: np.ndarray) -> FaceLandmarks:
        """Extract key facial landmarks."""
        return FaceLandmarks(
            timestamp=time.time(),
            nose_tip=landmarks[30],
            chin=landmarks[8],
            left_eye=np.mean(landmarks[36:42], axis=0),
            right_eye=np.mean(landmarks[42:48], axis=0),
            mouth=np.mean(landmarks[48:60], axis=0),
        )

    def draw_landmarks(self, frame: np.ndarray, landmarks_2d: Optional[np.ndarray], 
                      landmarks_3d: Optional[np.ndarray]) -> np.ndarray:
        """Draw landmarks on frame."""
        if landmarks_2d is not None:
            for face_landmarks in landmarks_2d:
                for x, y in face_landmarks:
                    cv2.circle(frame, (int(x), int(y)), 2, (0, 255, 0), -1)

        if landmarks_3d is not None:
            for face_landmarks in landmarks_3d:
                for x, y, z in face_landmarks:
                    cv2.circle(frame, (int(x), int(y)), 3, (255, 0, 0), -1)

        return frame

    def print_landmarks_info(self, landmarks: FaceLandmarks):
        """Print landmark information."""
        logger.info(
            f"Nose: X={landmarks.nose_tip[0]:.2f}, Y={landmarks.nose_tip[1]:.2f}, Z={landmarks.nose_tip[2]:.2f} | "
            f"Chin: X={landmarks.chin[0]:.2f}, Y={landmarks.chin[1]:.2f}, Z={landmarks.chin[2]:.2f}"
        )

    def display_stats(self, frame: np.ndarray, fps: float) -> np.ndarray:
        """Display performance statistics on frame."""
        stats = self.monitor.get_stats()
        text = f"FPS: {fps:.1f} | Frames: {self.monitor.frame_count}"
        cv2.putText(frame, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        return frame

    def process_frame(self, frame: np.ndarray) -> Tuple[np.ndarray, Optional[FaceLandmarks]]:
        """Process single frame."""
        start_time = time.time()
        
        landmarks_2d, landmarks_3d = self.extractor.extract_landmarks(frame)
        
        frame = self.draw_landmarks(frame, landmarks_2d, landmarks_3d)
        
        processed_landmarks = None
        if landmarks_3d is not None and len(landmarks_3d) > 0:
            processed_landmarks = self.extract_key_landmarks(landmarks_3d[0])
            self.landmarks_history.append(processed_landmarks)
            self.print_landmarks_info(processed_landmarks)

        processing_time = time.time() - start_time
        self.monitor.record_frame(processing_time)
        
        fps = self.monitor.get_fps()
        frame = self.display_stats(frame, fps)
        
        return frame, processed_landmarks

    def save_landmarks(self):
        """Save landmarks to file."""
        if not self.landmarks_history:
            logger.warning("No landmarks to save")
            return

        try:
            import json
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            output_path = self.config.output_dir / f"landmarks_{timestamp}.json"
            
            data = [lm.to_dict() for lm in self.landmarks_history]
            with open(output_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            logger.info(f"Landmarks saved to {output_path}")
        except Exception as e:
            logger.error(f"Failed to save landmarks: {e}")

    def run(self):
        """Main tracking loop."""
        if not self.initialize_webcam():
            return

        self.running = True
        logger.info("Starting face tracking... Press 'q' to exit")

        try:
            while self.running and self.cap is not None:
                ret, frame = self.cap.read()
                if not ret:
                    logger.error("Failed to capture frame")
                    break

                frame, _ = self.process_frame(frame)
                cv2.imshow('Live Face Tracking', frame)

                if cv2.waitKey(1) & 0xFF == ord('q'):
                    logger.info("Quit signal received")
                    break

        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
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
        
        stats = self.monitor.get_stats()
        logger.info(f"Final stats: {stats}")
        logger.info("Face tracking stopped")


# Setup logging before importing other modules
logger = logging.getLogger(__name__)


def main():
    """Main entry point."""
    config = Config()
    tracker = FaceTracker(config)
    tracker.run()


if __name__ == "__main__":
    main()
