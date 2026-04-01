/**
 * MarineTime — Database Setup Script
 * Run AFTER executing the 3 SQL migration files in Supabase SQL Editor.
 *
 * Usage: node scripts/setup-db.mjs
 *
 * What this does:
 *   1. Creates auth users (admin, supervisor, worker)
 *   2. Creates storage buckets
 *   3. Seeds workers table (linked to auth users)
 *   4. Seeds projects, sub-projects, and a sample site
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jdzvolzfxcoasiowrlrx.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkenZvbHpmeGNvYXNpb3dybHJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDkwNjA2NywiZXhwIjoyMDkwNDgyMDY3fQ.lpseQwwAxU0KwzYEL11NOrhbZGKP6bm9b45ynpxkuEU'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Simple bcrypt-like PIN hash using SHA-256 + salt
// NOTE: Production uses bcryptjs in the API. This is for seed data only.
// PINs are stored as bcrypt hashes — we'll set placeholder hashes and
// rely on the API's /api/admin/workers PATCH to reset them properly.
// Instead, we'll use the API to create workers with real bcrypt hashes.

function log(msg) { console.log(`  ✓ ${msg}`) }
function warn(msg) { console.log(`  ⚠ ${msg}`) }
function section(msg) { console.log(`\n── ${msg}`) }

async function createAuthUser(email, password, display_name) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name }
  })
  if (error) {
    if (error.message.includes('already been registered') || error.message.includes('already exists')) {
      warn(`User ${email} already exists — fetching existing`)
      const { data: list } = await supabase.auth.admin.listUsers()
      const existing = list?.users?.find(u => u.email === email)
      return existing
    }
    throw new Error(`Failed to create ${email}: ${error.message}`)
  }
  return data.user
}

async function createBucket(name) {
  const { error } = await supabase.storage.createBucket(name, { public: false })
  if (error && !error.message.includes('already exists') && !error.message.toLowerCase().includes('duplicate')) {
    throw new Error(`Failed to create bucket ${name}: ${error.message}`)
  }
}

async function main() {
  console.log('\n🚢 MarineTime — Database Setup\n')

  // ── 1. Storage Buckets ──────────────────────────────────────────────
  section('Storage Buckets')
  await createBucket('attendance-photos')
  log('bucket: attendance-photos')
  await createBucket('payroll-exports')
  log('bucket: payroll-exports')

  // ── 2. Auth Users ────────────────────────────────────────────────────
  section('Auth Users')

  const adminUser = await createAuthUser(
    'admin@marinetime.app',
    'Admin@1234',
    'System Admin'
  )
  log(`admin auth user: ${adminUser.id}`)

  const supervisorUser = await createAuthUser(
    'supervisor@marinetime.app',
    'Super@1234',
    'Lead Supervisor'
  )
  log(`supervisor auth user: ${supervisorUser.id}`)

  const workerUser = await createAuthUser(
    'worker1@marinetime.app',
    'Worker@1234',
    'Test Worker'
  )
  log(`worker auth user: ${workerUser.id}`)

  // ── 3. Workers ───────────────────────────────────────────────────────
  section('Workers')

  // bcrypt hash of "1234" with 12 rounds — pre-computed for seeding
  // Generated offline: bcryptjs.hashSync('1234', 12)
  const PIN_1234 = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewCqjb8qZ1UVlHbO'

  // Insert admin worker
  const { error: e1 } = await supabase
    .from('workers')
    .upsert({
      employee_code: 'ADMIN1',
      name: 'System Admin',
      role: 'admin',
      pin_hash: PIN_1234,
      auth_user_id: adminUser.id,
      is_active: true
    }, { onConflict: 'employee_code' })
    .select()
    .single()
  if (e1) throw new Error(`workers insert admin: ${e1.message}`)
  log(`worker: ADMIN1 (admin) — PIN: 1234`)

  // Insert supervisor worker
  const { data: supWorker, error: e2 } = await supabase
    .from('workers')
    .upsert({
      employee_code: 'SUP001',
      name: 'Lead Supervisor',
      role: 'supervisor',
      pin_hash: PIN_1234,
      auth_user_id: supervisorUser.id,
      is_active: true
    }, { onConflict: 'employee_code' })
    .select()
    .single()
  if (e2) throw new Error(`workers insert supervisor: ${e2.message}`)
  log(`worker: SUP001 (supervisor) — PIN: 1234`)

  // Insert test worker (reports to supervisor)
  const { error: e3 } = await supabase
    .from('workers')
    .upsert({
      employee_code: 'W001',
      name: 'Juan dela Cruz',
      role: 'worker',
      pin_hash: PIN_1234,
      supervisor_id: supWorker.id,
      auth_user_id: workerUser.id,
      is_active: true
    }, { onConflict: 'employee_code' })
  if (e3) throw new Error(`workers insert worker: ${e3.message}`)
  log(`worker: W001 (worker) — PIN: 1234`)

  // Insert second test worker (no auth account — kiosk only)
  const { error: e4 } = await supabase
    .from('workers')
    .upsert({
      employee_code: 'W002',
      name: 'Maria Santos',
      role: 'worker',
      pin_hash: PIN_1234,
      supervisor_id: supWorker.id,
      is_active: true
    }, { onConflict: 'employee_code' })
  if (e4) throw new Error(`workers insert W002: ${e4.message}`)
  log(`worker: W002 (worker, kiosk-only) — PIN: 1234`)

  // ── 4. Projects ──────────────────────────────────────────────────────
  section('Projects')

  const { data: proj1, error: pe1 } = await supabase
    .from('projects')
    .upsert({
      code: 'VES-001',
      name: 'Vessel Maintenance',
      description: 'Routine maintenance and repairs on fleet vessels',
      is_active: true
    }, { onConflict: 'code' })
    .select()
    .single()
  if (pe1) throw new Error(`project insert: ${pe1.message}`)
  log(`project: VES-001 — Vessel Maintenance`)

  const { data: proj2, error: pe2 } = await supabase
    .from('projects')
    .upsert({
      code: 'PORT-002',
      name: 'Port Operations',
      description: 'Cargo loading, unloading, and port facility work',
      is_active: true
    }, { onConflict: 'code' })
    .select()
    .single()
  if (pe2) throw new Error(`project insert: ${pe2.message}`)
  log(`project: PORT-002 — Port Operations`)

  const { data: proj3, error: pe3 } = await supabase
    .from('projects')
    .upsert({
      code: 'DRY-003',
      name: 'Dry Dock Works',
      description: 'Dry dock inspection and hull maintenance',
      is_active: true
    }, { onConflict: 'code' })
    .select()
    .single()
  if (pe3) throw new Error(`project insert: ${pe3.message}`)
  log(`project: DRY-003 — Dry Dock Works`)

  // ── 5. Sub-projects ──────────────────────────────────────────────────
  section('Sub-projects')

  const subProjects = [
    { project_id: proj1.id, code: 'ENG', name: 'Engine Room' },
    { project_id: proj1.id, code: 'HULL', name: 'Hull Inspection' },
    { project_id: proj1.id, code: 'ELEC', name: 'Electrical Systems' },
    { project_id: proj2.id, code: 'LOAD', name: 'Cargo Loading' },
    { project_id: proj2.id, code: 'UNLD', name: 'Cargo Unloading' },
    { project_id: proj2.id, code: 'SEC', name: 'Port Security' },
    { project_id: proj3.id, code: 'HULL-DD', name: 'Hull Blasting & Painting' },
    { project_id: proj3.id, code: 'PROP', name: 'Propeller Works' },
  ]

  for (const sp of subProjects) {
    const { error } = await supabase
      .from('sub_projects')
      .upsert({ ...sp, is_active: true }, { onConflict: 'project_id,code' })
    if (error) warn(`sub_project ${sp.code}: ${error.message}`)
    else log(`sub-project: ${sp.code} — ${sp.name}`)
  }

  // ── 6. Site Locations ────────────────────────────────────────────────
  section('Site Locations')

  const sites = [
    {
      name: 'Main Shipyard',
      lat: 14.5547,
      lng: 121.0244,
      radius_meters: 300,
      is_active: true
    },
    {
      name: 'North Pier',
      lat: 14.5612,
      lng: 121.0198,
      radius_meters: 200,
      is_active: true
    },
    {
      name: 'Dry Dock Facility',
      lat: 14.5489,
      lng: 121.0301,
      radius_meters: 250,
      is_active: true
    },
  ]

  for (const site of sites) {
    const { error } = await supabase.from('site_locations').insert(site)
    if (error && !error.message.includes('duplicate')) {
      warn(`site ${site.name}: ${error.message}`)
    } else {
      log(`site: ${site.name} (${site.radius_meters}m radius)`)
    }
  }

  // ── Done ─────────────────────────────────────────────────────────────
  console.log('\n✅ Setup complete!\n')
  console.log('Login credentials:')
  console.log('  Admin:      admin@marinetime.app      / Admin@1234  (PIN: 1234)')
  console.log('  Supervisor: supervisor@marinetime.app / Super@1234  (PIN: 1234)')
  console.log('  Worker:     worker1@marinetime.app   / Worker@1234 (PIN: 1234)')
  console.log('\nEmployee codes:')
  console.log('  ADMIN1, SUP001, W001, W002 (all PIN: 1234)\n')
}

main().catch(err => {
  console.error('\n❌ Setup failed:', err.message)
  process.exit(1)
})
