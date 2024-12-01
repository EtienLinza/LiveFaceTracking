# LiveFaceTracking.py

## Overview

`livefacetracking.py` is a Python script that uses OpenCV to detect and track faces in real-time through a webcam feed. The script employs a pre-trained Haar Cascade Classifier to identify faces and draw bounding boxes around them, offering an interactive and visually engaging experience. It is a great introduction to real-time computer vision tasks such as face detection and tracking.

## Features

- **Real-Time Face Detection**: Detects faces in each frame from a webcam feed.
- **Bounding Box Visualization**: Draws a rectangular box around each detected face.
- **Live Tracking**: Continuously tracks faces across frames, adjusting the bounding box as the face moves.
- **Webcam Integration**: Captures live video from a webcam and processes each frame in real-time.
- **Haar Cascade Classifier**: Utilizes OpenCV’s pre-trained face detection model for efficient and accurate detection.

## Prerequisites

Before running the script, ensure you have the following dependencies installed:

- Python 3.x
- OpenCV library

You can install OpenCV via pip:

```bash
pip install opencv-python
```

## Installation

1. Clone or download the repository:

    ```bash
    git clone https://github.com/your-username/livefacetracking.git
    ```

2. Install required dependencies (OpenCV):

    ```bash
    pip install opencv-python
    ```

## Usage

1. Ensure that your webcam is connected.
2. Open a terminal and navigate to the folder containing `livefacetracking.py`.
3. Run the script:

    ```bash
    python livefacetracking.py
    ```

4. A window will appear displaying the webcam feed. Any detected faces will have bounding boxes drawn around them.
5. To stop the script, press `q` while the window is active.

## How It Works

- **Capture Video Feed**: The script uses `cv2.VideoCapture()` to access the webcam and retrieve frames in real-time.
- **Face Detection**: For each frame, the Haar Cascade Classifier (`haarcascade_frontalface_default.xml`) is used to detect faces.
- **Draw Bounding Box**: Once a face is detected, a rectangle is drawn around it using `cv2.rectangle()`.
- **Live Tracking**: The script continuously updates the bounding boxes as faces move within the frame.
- **Display Output**: The processed frames with bounding boxes are displayed using `cv2.imshow()`.

## Applications

- **Security & Surveillance**: Face detection can be integrated into security systems for real-time monitoring.
- **Human-Computer Interaction**: Use for building interactive systems that respond to user’s facial movements.
- **Face Recognition**: Can be expanded to include more advanced face recognition capabilities.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- OpenCV for providing powerful computer vision tools.
- Haar Cascade Classifier for face detection.

## Troubleshooting

If you encounter issues with webcam access:

- Ensure your webcam is connected and functional.
- Try using an external camera if the built-in one is not detected.
