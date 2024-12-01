import cv2
import face_alignment
import numpy as np
import time

# Initialize the face alignment models for 2D and 3D
fa_2d = face_alignment.FaceAlignment(face_alignment.LandmarksType.TWO_D, device='cuda')  # Use 'cuda' if you have a GPU
fa_3d = face_alignment.FaceAlignment(face_alignment.LandmarksType.THREE_D, device='cuda')  # Use 'cuda' if you have a GPU

# Initialize webcam
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Error: Could not open webcam.")
    exit()

frame_count = 0
start_time = time.time()
fps = 0

while True:
    ret, frame = cap.read()
    if not ret:
        print("Error: Failed to capture frame.")
        break

    # Convert the frame from BGR to RGB
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # Get the landmarks
    preds_2d = fa_2d.get_landmarks(rgb_frame)
    preds_3d = fa_3d.get_landmarks(rgb_frame)

    # Draw the 2D landmarks on the frame
    if preds_2d is not None:
        for landmarks in preds_2d:
            for x, y in landmarks:
                cv2.circle(frame, (int(x), int(y)), 3, (0, 255, 0), -1)  # Draw circles at the 2D landmarks

    # Draw the 3D landmarks on the frame and print coordinates
    if preds_3d is not None:
        for landmarks in preds_3d:
            # Draw circles at the 3D landmarks
            for x, y, z in landmarks:
                cv2.circle(frame, (int(x), int(y)), 3, (255, 0, 0), -1)  # Draw circles at the 3D landmarks

            # Get the coordinates of specific landmarks
            nose_tip = landmarks[30]         # Nose tip
            left_eye = landmarks[36:42]      # Left eye (corners)
            right_eye = landmarks[42:48]     # Right eye (corners)
            mouth_corners = landmarks[48:60]  # Mouth corners
            chin = landmarks[8]               # Chin

            # Print the coordinates of the landmarks
            print(f"Nose Tip Coordinates: X={nose_tip[0]:.2f}, Y={nose_tip[1]:.2f}, Z={nose_tip[2]:.2f}")
            print(f"Chin Coordinates: X={chin[0]:.2f}, Y={chin[1]:.2f}, Z={chin[2]:.2f}")
            
            # Calculate average positions for eyes and mouth corners
            left_eye_center = np.mean(left_eye, axis=0)
            right_eye_center = np.mean(right_eye, axis=0)
            mouth_center = np.mean(mouth_corners, axis=0)

            print(f"Left Eye Center Coordinates: X={left_eye_center[0]:.2f}, Y={left_eye_center[1]:.2f}, Z={left_eye_center[2]:.2f}")
            print(f"Right Eye Center Coordinates: X={right_eye_center[0]:.2f}, Y={right_eye_center[1]:.2f}, Z={right_eye_center[2]:.2f}")
            print(f"Mouth Center Coordinates: X={mouth_center[0]:.2f}, Y={mouth_center[1]:.2f}, Z={mouth_center[2]:.2f}")

    # Display the output
    cv2.imshow('Live Face Tracking - Full Face Coordinates', frame)

    # Calculate FPS
    frame_count += 1
    if time.time() - start_time >= 1.0:  # Update every second
        fps = frame_count
        frame_count = 0
        start_time = time.time()
        print(f"FPS: {fps}")

    # Check for 'q' key to exit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Release the webcam and close all OpenCV windows
cap.release()
cv2.destroyAllWindows()
