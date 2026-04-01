-- MarineTime: Add attendance remarks column
-- Run after 007_fix_clockout_rls.sql

ALTER TABLE attendance_logs
ADD COLUMN IF NOT EXISTS remarks text;