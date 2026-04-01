-- MarineTime: Performance Indexes
-- Run AFTER 002_rls_policies.sql

-- Attendance lookups by worker + time (most common query)
CREATE INDEX idx_attendance_worker_clock_in
  ON attendance_logs(worker_id, clock_in_at DESC);

-- Attendance lookups by project + time (for payroll export)
CREATE INDEX idx_attendance_project_clock_in
  ON attendance_logs(project_id, clock_in_at DESC);

-- Find pending records quickly (supervisor dashboard)
CREATE INDEX idx_attendance_status_pending
  ON attendance_logs(status)
  WHERE status = 'pending';

-- Find open sessions (workers who forgot to clock out)
CREATE INDEX idx_attendance_open_sessions
  ON attendance_logs(clock_out_at)
  WHERE clock_out_at IS NULL;

-- Approval lookups by attendance log
CREATE INDEX idx_approvals_log
  ON approvals(attendance_log_id);

-- GPS log lookups by attendance + time
CREATE INDEX idx_gps_logs_attendance_time
  ON gps_logs(attendance_log_id, recorded_at DESC);

-- Worker lookup by employee code (login)
CREATE INDEX idx_workers_employee_code
  ON workers(employee_code);

-- Worker lookup by supervisor (for supervisor dashboard)
CREATE INDEX idx_workers_supervisor
  ON workers(supervisor_id);

-- Worker lookup by auth user id
CREATE INDEX idx_workers_auth_user
  ON workers(auth_user_id);

-- Payroll export date range queries
CREATE INDEX idx_payroll_exports_period
  ON payroll_exports(period_start, period_end);

-- Sub-project lookup by project
CREATE INDEX idx_sub_projects_project
  ON sub_projects(project_id);

-- Attendance lookup by sub-project
CREATE INDEX idx_attendance_sub_project
  ON attendance_logs(sub_project_id, clock_in_at DESC);
