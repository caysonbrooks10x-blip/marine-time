-- MarineTime: Daily Roster & Worker Position
-- Adds the ability to record non-attendance statuses (Project Off, MC, Home Leave, etc.)
-- and worker position/trade (Fitter, Welder, etc.) to match the paper daily sheet.

-- Add position/trade to workers (Fitter, Welder, Helper, Rigger, Supervisor, QC, etc.)
ALTER TABLE workers ADD COLUMN IF NOT EXISTS position text;

-- Daily roster entries for workers who did NOT clock in
-- Workers who clock in are automatically "present" via attendance_logs.
-- This table captures the remaining statuses from the paper form.
CREATE TABLE daily_roster_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id),
  work_date date NOT NULL,
  status text NOT NULL CHECK (status IN (
    'project_off',   -- POFF: no project work for this worker today
    'off',           -- scheduled day off
    'absent',        -- didn't show up (unexcused)
    'home_leave',    -- on home leave
    'mc',            -- medical certificate / medical leave
    'no_job',        -- no job available
    'supply',        -- supplied / available but not assigned
    'resign'         -- worker has resigned
  )),
  remarks text,
  recorded_by uuid REFERENCES workers(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(worker_id, work_date)
);

-- RLS
ALTER TABLE daily_roster_entries ENABLE ROW LEVEL SECURITY;

-- Workers can see their own entries
CREATE POLICY "Workers can view own roster entries"
  ON daily_roster_entries FOR SELECT
  USING (
    worker_id IN (
      SELECT id FROM workers WHERE auth_user_id = auth.uid()
    )
  );

-- Supervisors can manage entries for their direct reports
CREATE POLICY "Supervisors can view roster for their workers"
  ON daily_roster_entries FOR SELECT
  USING (
    worker_id IN (
      SELECT id FROM workers WHERE supervisor_id IN (
        SELECT id FROM workers WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Supervisors can insert roster for their workers"
  ON daily_roster_entries FOR INSERT
  WITH CHECK (
    worker_id IN (
      SELECT id FROM workers WHERE supervisor_id IN (
        SELECT id FROM workers WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Supervisors can update roster for their workers"
  ON daily_roster_entries FOR UPDATE
  USING (
    worker_id IN (
      SELECT id FROM workers WHERE supervisor_id IN (
        SELECT id FROM workers WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Supervisors can delete roster for their workers"
  ON daily_roster_entries FOR DELETE
  USING (
    worker_id IN (
      SELECT id FROM workers WHERE supervisor_id IN (
        SELECT id FROM workers WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Admins full access
CREATE POLICY "Admins full access to roster entries"
  ON daily_roster_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workers WHERE auth_user_id = auth.uid() AND role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_roster_work_date ON daily_roster_entries (work_date);
CREATE INDEX idx_roster_worker_date ON daily_roster_entries (worker_id, work_date);
