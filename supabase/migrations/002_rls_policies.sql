-- MarineTime: Row Level Security Policies
-- Run AFTER 001_initial_schema.sql

-- Enable RLS on all tables
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_exports ENABLE ROW LEVEL SECURITY;

-- Helper function: get the current worker record from auth.users
CREATE OR REPLACE FUNCTION current_worker_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT id FROM workers WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Helper function: get the current worker's role
CREATE OR REPLACE FUNCTION current_worker_role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT role FROM workers WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- =====================
-- WORKERS TABLE
-- =====================
-- Workers: read own record only
CREATE POLICY "workers_select_own" ON workers
  FOR SELECT USING (auth_user_id = auth.uid());

-- Supervisors: read their direct reports
CREATE POLICY "workers_select_supervisor" ON workers
  FOR SELECT USING (
    supervisor_id = current_worker_id()
    AND current_worker_role() = 'supervisor'
  );

-- Admins: full access
CREATE POLICY "workers_admin_all" ON workers
  FOR ALL USING (current_worker_role() = 'admin');

-- =====================
-- PROJECTS TABLE
-- =====================
-- All authenticated users can read active projects
CREATE POLICY "projects_read_all_auth" ON projects
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Admins: full access
CREATE POLICY "projects_admin_all" ON projects
  FOR ALL USING (current_worker_role() = 'admin');

-- =====================
-- SUB_PROJECTS TABLE
-- =====================
-- All authenticated users can read active sub-projects
CREATE POLICY "sub_projects_read_all_auth" ON sub_projects
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Admins: full access
CREATE POLICY "sub_projects_admin_all" ON sub_projects
  FOR ALL USING (current_worker_role() = 'admin');

-- =====================
-- SITE_LOCATIONS TABLE
-- =====================
-- All authenticated users can read active sites
CREATE POLICY "sites_read_all_auth" ON site_locations
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- Admins: full access
CREATE POLICY "sites_admin_all" ON site_locations
  FOR ALL USING (current_worker_role() = 'admin');

-- =====================
-- ATTENDANCE_LOGS TABLE
-- =====================
-- Workers: insert own records
CREATE POLICY "attendance_insert_own" ON attendance_logs
  FOR INSERT WITH CHECK (worker_id = current_worker_id());

-- Workers: read own records
CREATE POLICY "attendance_select_own" ON attendance_logs
  FOR SELECT USING (worker_id = current_worker_id());

-- Workers: update own open records (for clock-out)
CREATE POLICY "attendance_update_own_open" ON attendance_logs
  FOR UPDATE USING (
    worker_id = current_worker_id()
    AND clock_out_at IS NULL
  );

-- Supervisors: read their workers' records
CREATE POLICY "attendance_select_supervisor" ON attendance_logs
  FOR SELECT USING (
    current_worker_role() = 'supervisor'
    AND worker_id IN (
      SELECT id FROM workers WHERE supervisor_id = current_worker_id()
    )
  );

-- Supervisors: update status on their workers' records
CREATE POLICY "attendance_update_supervisor" ON attendance_logs
  FOR UPDATE USING (
    current_worker_role() = 'supervisor'
    AND worker_id IN (
      SELECT id FROM workers WHERE supervisor_id = current_worker_id()
    )
  );

-- Admins: full access
CREATE POLICY "attendance_admin_all" ON attendance_logs
  FOR ALL USING (current_worker_role() = 'admin');

-- =====================
-- GPS_LOGS TABLE
-- =====================
-- Workers: insert and read own GPS logs
CREATE POLICY "gps_logs_own" ON gps_logs
  FOR ALL USING (
    attendance_log_id IN (
      SELECT id FROM attendance_logs WHERE worker_id = current_worker_id()
    )
  );

-- Supervisors: read GPS logs for their workers
CREATE POLICY "gps_logs_supervisor" ON gps_logs
  FOR SELECT USING (
    current_worker_role() = 'supervisor'
    AND attendance_log_id IN (
      SELECT al.id FROM attendance_logs al
      JOIN workers w ON al.worker_id = w.id
      WHERE w.supervisor_id = current_worker_id()
    )
  );

-- Admins: full access
CREATE POLICY "gps_logs_admin_all" ON gps_logs
  FOR ALL USING (current_worker_role() = 'admin');

-- =====================
-- APPROVALS TABLE
-- =====================
-- Supervisors: insert and read own approvals
CREATE POLICY "approvals_supervisor_own" ON approvals
  FOR ALL USING (supervisor_id = current_worker_id());

-- Workers: read approvals on their own records
CREATE POLICY "approvals_worker_read_own" ON approvals
  FOR SELECT USING (
    attendance_log_id IN (
      SELECT id FROM attendance_logs WHERE worker_id = current_worker_id()
    )
  );

-- Admins: full access
CREATE POLICY "approvals_admin_all" ON approvals
  FOR ALL USING (current_worker_role() = 'admin');

-- =====================
-- PAYROLL_EXPORTS TABLE
-- =====================
-- Admins only
CREATE POLICY "payroll_exports_admin_all" ON payroll_exports
  FOR ALL USING (current_worker_role() = 'admin');
