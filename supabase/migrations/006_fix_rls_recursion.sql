-- Fix infinite RLS recursion on workers table
-- The helper functions current_worker_id() and current_worker_role() query
-- the workers table, which has RLS policies that call these same functions.
-- SECURITY DEFINER makes them run as the function owner (bypassing RLS),
-- breaking the recursive loop.

CREATE OR REPLACE FUNCTION current_worker_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM workers WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_worker_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM workers WHERE auth_user_id = auth.uid() LIMIT 1;
$$;
