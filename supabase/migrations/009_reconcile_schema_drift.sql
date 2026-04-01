-- MarineTime: Reconcile schema drift for production project
-- This migration is idempotent and safe to run on existing data.
-- It restores missing helper functions and RLS policies expected by the app.

-- Ensure RLS stays enabled on core tables
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_roster_entries ENABLE ROW LEVEL SECURITY;

-- Helper functions used by policies (must bypass workers RLS recursion)
CREATE OR REPLACE FUNCTION current_worker_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM workers WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_worker_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM workers WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

DO $$
BEGIN
  -- workers
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workers' AND policyname = 'workers_select_own'
  ) THEN
    CREATE POLICY workers_select_own ON workers
      FOR SELECT USING (auth_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workers' AND policyname = 'workers_select_supervisor'
  ) THEN
    CREATE POLICY workers_select_supervisor ON workers
      FOR SELECT USING (
        supervisor_id = current_worker_id()
        AND current_worker_role() = 'supervisor'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workers' AND policyname = 'workers_admin_all'
  ) THEN
    CREATE POLICY workers_admin_all ON workers
      FOR ALL USING (current_worker_role() = 'admin');
  END IF;

  -- projects
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'projects_read_all_auth'
  ) THEN
    CREATE POLICY projects_read_all_auth ON projects
      FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'projects_admin_all'
  ) THEN
    CREATE POLICY projects_admin_all ON projects
      FOR ALL USING (current_worker_role() = 'admin');
  END IF;

  -- sub_projects
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sub_projects' AND policyname = 'sub_projects_read_all_auth'
  ) THEN
    CREATE POLICY sub_projects_read_all_auth ON sub_projects
      FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sub_projects' AND policyname = 'sub_projects_admin_all'
  ) THEN
    CREATE POLICY sub_projects_admin_all ON sub_projects
      FOR ALL USING (current_worker_role() = 'admin');
  END IF;

  -- site_locations
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'site_locations' AND policyname = 'sites_read_all_auth'
  ) THEN
    CREATE POLICY sites_read_all_auth ON site_locations
      FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'site_locations' AND policyname = 'sites_admin_all'
  ) THEN
    CREATE POLICY sites_admin_all ON site_locations
      FOR ALL USING (current_worker_role() = 'admin');
  END IF;

  -- attendance_logs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_logs' AND policyname = 'attendance_insert_own'
  ) THEN
    CREATE POLICY attendance_insert_own ON attendance_logs
      FOR INSERT WITH CHECK (worker_id = current_worker_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_logs' AND policyname = 'attendance_select_own'
  ) THEN
    CREATE POLICY attendance_select_own ON attendance_logs
      FOR SELECT USING (worker_id = current_worker_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_logs' AND policyname = 'attendance_select_supervisor'
  ) THEN
    CREATE POLICY attendance_select_supervisor ON attendance_logs
      FOR SELECT USING (
        current_worker_role() = 'supervisor'
        AND worker_id IN (
          SELECT id FROM workers WHERE supervisor_id = current_worker_id()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_logs' AND policyname = 'attendance_update_supervisor'
  ) THEN
    CREATE POLICY attendance_update_supervisor ON attendance_logs
      FOR UPDATE USING (
        current_worker_role() = 'supervisor'
        AND worker_id IN (
          SELECT id FROM workers WHERE supervisor_id = current_worker_id()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance_logs' AND policyname = 'attendance_admin_all'
  ) THEN
    CREATE POLICY attendance_admin_all ON attendance_logs
      FOR ALL USING (current_worker_role() = 'admin');
  END IF;

  -- gps_logs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gps_logs' AND policyname = 'gps_logs_own'
  ) THEN
    CREATE POLICY gps_logs_own ON gps_logs
      FOR ALL USING (
        attendance_log_id IN (
          SELECT id FROM attendance_logs WHERE worker_id = current_worker_id()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gps_logs' AND policyname = 'gps_logs_supervisor'
  ) THEN
    CREATE POLICY gps_logs_supervisor ON gps_logs
      FOR SELECT USING (
        current_worker_role() = 'supervisor'
        AND attendance_log_id IN (
          SELECT al.id
          FROM attendance_logs al
          JOIN workers w ON al.worker_id = w.id
          WHERE w.supervisor_id = current_worker_id()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gps_logs' AND policyname = 'gps_logs_admin_all'
  ) THEN
    CREATE POLICY gps_logs_admin_all ON gps_logs
      FOR ALL USING (current_worker_role() = 'admin');
  END IF;

  -- approvals
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'approvals' AND policyname = 'approvals_supervisor_own'
  ) THEN
    CREATE POLICY approvals_supervisor_own ON approvals
      FOR ALL USING (supervisor_id = current_worker_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'approvals' AND policyname = 'approvals_worker_read_own'
  ) THEN
    CREATE POLICY approvals_worker_read_own ON approvals
      FOR SELECT USING (
        attendance_log_id IN (
          SELECT id FROM attendance_logs WHERE worker_id = current_worker_id()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'approvals' AND policyname = 'approvals_admin_all'
  ) THEN
    CREATE POLICY approvals_admin_all ON approvals
      FOR ALL USING (current_worker_role() = 'admin');
  END IF;

  -- payroll_exports
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payroll_exports' AND policyname = 'payroll_exports_admin_all'
  ) THEN
    CREATE POLICY payroll_exports_admin_all ON payroll_exports
      FOR ALL USING (current_worker_role() = 'admin');
  END IF;
END
$$;

-- Ensure 007 clock-out policy semantics are present
DROP POLICY IF EXISTS attendance_update_own_open ON attendance_logs;
CREATE POLICY attendance_update_own_open ON attendance_logs
  FOR UPDATE
  USING (
    worker_id = current_worker_id()
    AND clock_out_at IS NULL
  )
  WITH CHECK (
    worker_id = current_worker_id()
  );

-- Repoint webhook function to stable production alias
CREATE OR REPLACE FUNCTION public.notify_clock_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
  );

  PERFORM net.http_post(
    url := 'https://marine-time-two.vercel.app/api/webhooks/clock-event',
    body := payload,
    headers := jsonb_build_object(
      'x-webhook-secret', '0a3a1356c8845b32217916d1b219c928e59278b82f0062f0b3142c089e9f200a',
      'Content-Type', 'application/json'
    )
  );

  RETURN NEW;
END;
$function$;
