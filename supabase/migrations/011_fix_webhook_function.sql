-- Fix webhook function to work without pg_net extension
-- Migration 011

-- Drop triggers first (they depend on the function)
DROP TRIGGER IF EXISTS attendance_logs_notify ON attendance_logs;
DROP TRIGGER IF EXISTS on_attendance_change ON attendance_logs;

-- Drop the old function
DROP FUNCTION IF EXISTS public.notify_clock_event();

-- Create new function without pg_net dependency
CREATE FUNCTION public.notify_clock_event()
RETURNS trigger AS $$
BEGIN
  -- pg_net not available - webhook regeneration disabled
  -- Use POST /api/admin/export/company-timesheet for on-demand generation
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER attendance_logs_notify
  AFTER INSERT OR UPDATE ON attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.notify_clock_event();
