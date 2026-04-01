import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const ROSTER_STATUSES = [
  'project_off',
  'off',
  'absent',
  'home_leave',
  'mc',
  'no_job',
  'supply',
  'resign',
] as const

const upsertSchema = z.object({
  worker_id: z.string().uuid(),
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(ROSTER_STATUSES),
  remarks: z.string().max(500).optional(),
})

const deleteSchema = z.object({
  id: z.string().uuid(),
})

/**
 * GET /api/roster?date=YYYY-MM-DD
 *
 * Returns the merged daily roster: all active workers with their attendance_logs
 * and daily_roster_entries for the given date.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Verify caller is supervisor or admin
  const { data: caller } = await supabase
    .from('workers')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!caller || (caller.role !== 'supervisor' && caller.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dateParam = request.nextUrl.searchParams.get('date')
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: 'date query param required (YYYY-MM-DD)' }, { status: 400 })
  }

  const adminClient = await createAdminClient()

  // Fetch all active workers
  const workersQuery = caller.role === 'admin'
    ? adminClient.from('workers').select('id, employee_code, name, position, role, is_active').eq('is_active', true)
    : adminClient.from('workers').select('id, employee_code, name, position, role, is_active').eq('is_active', true).eq('supervisor_id', caller.id)

  const { data: workers, error: workersError } = await workersQuery.order('employee_code')

  if (workersError) {
    return NextResponse.json({ error: 'Failed to load workers' }, { status: 500 })
  }

  // Fetch attendance_logs for the date (clock-in between start and end of day in UTC)
  // We query broadly and filter by local date to handle timezone differences
  const dayStart = `${dateParam}T00:00:00+08:00` // Singapore timezone
  const dayEnd = `${dateParam}T23:59:59+08:00`

  const { data: logs } = await adminClient
    .from('attendance_logs')
    .select(`
      id, worker_id, clock_in_at, clock_out_at,
      clock_in_distance_meters, status,
      projects ( code, name ),
      sub_projects ( code, name ),
      site_locations ( name )
    `)
    .gte('clock_in_at', dayStart)
    .lte('clock_in_at', dayEnd)
    .order('clock_in_at')

  // Fetch daily_roster_entries for the date
  const { data: rosterEntries } = await adminClient
    .from('daily_roster_entries')
    .select('id, worker_id, work_date, status, remarks, recorded_by')
    .eq('work_date', dateParam)

  // Build lookup maps
  const logsByWorker = new Map<string, typeof logs>()
  for (const log of logs ?? []) {
    const existing = logsByWorker.get(log.worker_id) ?? []
    existing.push(log)
    logsByWorker.set(log.worker_id, existing)
  }

  const rosterByWorker = new Map<string, (typeof rosterEntries extends (infer T)[] | null ? T : never)>()
  for (const entry of rosterEntries ?? []) {
    rosterByWorker.set(entry.worker_id, entry)
  }

  // Merge into unified roster
  const roster = (workers ?? []).map(worker => {
    const attendanceLogs = logsByWorker.get(worker.id) ?? []
    const rosterEntry = rosterByWorker.get(worker.id) ?? null
    const isPresent = attendanceLogs.length > 0

    return {
      worker,
      attendance: attendanceLogs,
      roster_entry: rosterEntry,
      effective_status: isPresent ? 'present' : (rosterEntry?.status ?? null),
    }
  })

  const presentCount = roster.filter(r => r.effective_status === 'present').length

  return NextResponse.json({
    data: {
      date: dateParam,
      total_workers: roster.length,
      total_man_power: presentCount,
      roster,
    },
  })
}

/**
 * POST /api/roster — upsert a daily roster entry
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: caller } = await supabase
    .from('workers')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!caller || (caller.role !== 'supervisor' && caller.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { worker_id, work_date, status, remarks } = parsed.data

  const adminClient = await createAdminClient()

  const { data, error } = await adminClient
    .from('daily_roster_entries')
    .upsert(
      {
        worker_id,
        work_date,
        status,
        remarks: remarks ?? null,
        recorded_by: caller.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'worker_id,work_date' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save roster entry' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/roster — remove a daily roster entry
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: caller } = await supabase
    .from('workers')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!caller || (caller.role !== 'supervisor' && caller.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const adminClient = await createAdminClient()

  const { error } = await adminClient
    .from('daily_roster_entries')
    .delete()
    .eq('id', parsed.data.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
