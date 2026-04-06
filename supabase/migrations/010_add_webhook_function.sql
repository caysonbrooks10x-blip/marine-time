-- Add webhook trigger for auto-regeneration
-- Migration 010
-- Note: pg_net not available in this Supabase instance.
-- Webhook regeneration is disabled but data saves correctly.
-- Use on-demand export endpoints for workbook generation.

-- Create stub webhook function (no-op without pg_net)
CREATE OR REPLACE FUNCTION public.notify_clock_event()
RETURNS trigger AS $$
BEGIN
  -- pg_net not available - webhook regeneration disabled
  -- Use POST /api/admin/export/company-timesheet for on-demand generation
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger (fires on insert/update but does nothing)
DROP TRIGGER IF EXISTS attendance_logs_notify ON attendance_logs;
CREATE TRIGGER attendance_logs_notify
  AFTER INSERT OR UPDATE ON attendance_logs
  FOR EACH ROW EXECUTE FUNCTION notify_clock_event();
