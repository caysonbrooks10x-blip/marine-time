-- Enable pg_net extension for async HTTP requests from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create the webhook trigger function
CREATE OR REPLACE FUNCTION public.notify_clock_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
  );

  -- Fire-and-forget async HTTP POST via pg_net
  PERFORM net.http_post(
    url := 'https://marine-time-tawny.vercel.app/api/webhooks/clock-event',
    body := payload,
    headers := jsonb_build_object(
      'x-webhook-secret', '0a3a1356c8845b32217916d1b219c928e59278b82f0062f0b3142c089e9f200a',
      'Content-Type', 'application/json'
    )
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_attendance_change ON public.attendance_logs;

-- Create the trigger
CREATE TRIGGER on_attendance_change
  AFTER INSERT OR UPDATE ON public.attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_clock_event();
