-- MarineTime: Seed Data (DEVELOPMENT ONLY — do not run in production)
-- Run AFTER all migrations

-- NOTE: PIN hashes below are bcrypt of "1234" with saltRounds=12
-- Generate new hashes for production workers

-- Test workers
-- W001 = Supervisor (Ahmad Farid)
-- W002 = Worker (Reza Malik) — reports to W001
-- W003 = Worker (Siti Norzah) — reports to W001
INSERT INTO workers (id, employee_code, name, role, pin_hash, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'W001', 'Ahmad Farid', 'supervisor', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMeSSm0KSROpCWkG8Kz.c1xXoG', true),
  ('00000000-0000-0000-0000-000000000002', 'W002', 'Reza Malik', 'worker', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMeSSm0KSROpCWkG8Kz.c1xXoG', true),
  ('00000000-0000-0000-0000-000000000003', 'W003', 'Siti Norzah', 'worker', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMeSSm0KSROpCWkG8Kz.c1xXoG', true),
  ('00000000-0000-0000-0000-000000000099', 'ADMIN1', 'System Admin', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMeSSm0KSROpCWkG8Kz.c1xXoG', true);

-- Set supervisor assignments
UPDATE workers SET supervisor_id = '00000000-0000-0000-0000-000000000001'
  WHERE employee_code IN ('W002', 'W003');

-- Test projects
INSERT INTO projects (id, code, name, description, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001', 'BERTH-MAINT-2024', 'Berth Maintenance 2024', 'Annual maintenance of berth structures and mooring systems', true),
  ('10000000-0000-0000-0000-000000000002', 'DRY-DOCK-Q1-2024', 'Dry Dock Q1 2024', 'First quarter dry-docking of MV SeaHawk and MV Pacific Star', true);

-- Sub-projects for BERTH-MAINT-2024
INSERT INTO sub_projects (project_id, code, name, description, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001', 'PAINT-HULL', 'Hull Painting', 'Anti-fouling paint application on hull surfaces', true),
  ('10000000-0000-0000-0000-000000000001', 'WELD-KEEL', 'Keel Welding', 'Structural weld repairs on keel sections', true),
  ('10000000-0000-0000-0000-000000000001', 'INSPECT-FENDERS', 'Fender Inspection', 'Inspection and replacement of berth fenders', true);

-- Sub-projects for DRY-DOCK-Q1-2024
INSERT INTO sub_projects (project_id, code, name, description, is_active) VALUES
  ('10000000-0000-0000-0000-000000000002', 'BLASTING', 'Grit Blasting', 'Surface preparation via grit blasting', true),
  ('10000000-0000-0000-0000-000000000002', 'PROP-POLISH', 'Propeller Polishing', 'Propeller shaft and blade polishing', true),
  ('10000000-0000-0000-0000-000000000002', 'RUDDER-SEAL', 'Rudder Seal Replacement', 'Replacement of rudder seals and bearings', true);

-- Site locations (use real coordinates for your actual sites in production)
INSERT INTO site_locations (id, name, lat, lng, radius_meters, is_active) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Main Berth', 1.3521000, 103.8198000, 75, true),
  ('20000000-0000-0000-0000-000000000002', 'Dry Dock Yard', 1.3480000, 103.8150000, 120, true);

-- NOTE: Default PIN for all test users is "1234"
-- IMPORTANT: Regenerate these hashes before any real use:
--   node -e "const b=require('bcryptjs');b.hash('YOUR_PIN',12).then(h=>console.log(h))"
