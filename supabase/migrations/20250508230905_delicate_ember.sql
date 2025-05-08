/*
  # Create Face Tracking Table

  1. New Tables
    - `face_tracking_data`
      - `id` (uuid, primary key)
      - `timestamp` (bigint, not null)
      - `nose_x` (float, not null)
      - `nose_y` (float, not null)
      - `left_eye_x` (float, not null)
      - `left_eye_y` (float, not null)
      - `right_eye_x` (float, not null)
      - `right_eye_y` (float, not null)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `face_tracking_data` table
    - Add policies for authenticated users to insert and read data
*/

CREATE TABLE face_tracking_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp bigint NOT NULL,
  nose_x float NOT NULL,
  nose_y float NOT NULL,
  left_eye_x float NOT NULL,
  left_eye_y float NOT NULL,
  right_eye_x float NOT NULL,
  right_eye_y float NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE face_tracking_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to insert data"
  ON face_tracking_data
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read data"
  ON face_tracking_data
  FOR SELECT
  TO authenticated
  USING (true);