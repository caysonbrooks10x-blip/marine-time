-- Fix clock-out RLS policy
-- The old policy used USING (worker_id = current_worker_id() AND clock_out_at IS NULL)
-- without a WITH CHECK clause. PostgreSQL defaults WITH CHECK to the USING clause,
-- so the UPDATE fails because the new row (with clock_out_at set) violates the check.
-- Fix: separate USING (what rows can be updated) from WITH CHECK (what the new row must look like).

DROP POLICY IF EXISTS "attendance_update_own_open" ON attendance_logs;

CREATE POLICY "attendance_update_own_open" ON attendance_logs
  FOR UPDATE
  USING (
    worker_id = current_worker_id()
    AND clock_out_at IS NULL
  )
  WITH CHECK (
    worker_id = current_worker_id()
  );
