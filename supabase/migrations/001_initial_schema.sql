-- MarineTime: Initial Schema
-- Run this first in Supabase Studio SQL editor

-- Workers (employees)
CREATE TABLE workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('worker', 'supervisor', 'admin')),
  pin_hash text,
  supervisor_id uuid REFERENCES workers(id),
  auth_user_id uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Sub-projects (task codes within a project)
CREATE TABLE sub_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  UNIQUE(project_id, code)
);

-- Site locations (geofenced work sites)
CREATE TABLE site_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  radius_meters integer NOT NULL CHECK (radius_meters > 0),
  is_active boolean DEFAULT true
);

-- Attendance logs (core clock-in/out records)
CREATE TABLE attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES workers(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  sub_project_id uuid REFERENCES sub_projects(id),
  site_id uuid REFERENCES site_locations(id),
  clock_in_at timestamptz NOT NULL,
  clock_out_at timestamptz,
  clock_in_lat numeric(10,7),
  clock_in_lng numeric(10,7),
  clock_out_lat numeric(10,7),
  clock_out_lng numeric(10,7),
  clock_in_distance_meters integer,
  photo_proof_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','flagged')),
  offline_queued boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT no_overlap CHECK (clock_out_at IS NULL OR clock_out_at > clock_in_at)
);

-- GPS logs (optional breadcrumb — stored at clock events)
CREATE TABLE gps_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_log_id uuid NOT NULL REFERENCES attendance_logs(id) ON DELETE CASCADE,
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  accuracy_meters integer,
  recorded_at timestamptz NOT NULL
);

-- Approvals (supervisor decisions on attendance records)
CREATE TABLE approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_log_id uuid NOT NULL REFERENCES attendance_logs(id) ON DELETE CASCADE,
  supervisor_id uuid NOT NULL REFERENCES workers(id),
  status text NOT NULL CHECK (status IN ('approved','rejected')),
  notes text,
  reviewed_at timestamptz DEFAULT now()
);

-- Payroll exports (audit trail of exported reports)
CREATE TABLE payroll_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  exported_at timestamptz DEFAULT now(),
  exported_by uuid REFERENCES workers(id),
  file_url text,
  record_count integer
);
