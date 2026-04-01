import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const approvalSchema = z.object({
  log_id: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
  notes: z.string().max(500).optional(),
})

// GET — pending attendance records for the supervisor's workers
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Get current worker (supervisor)
  const { data: supervisor } = await supabase
    .from('workers')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!supervisor || (supervisor.role !== 'supervisor' && supervisor.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden — supervisor access required' }, { status: 403 })
  }

  // Build query — supervisors see their workers, admins see all
  let query = supabase
    .from('attendance_logs')
    .select(`
      id,
      clock_in_at,
      clock_out_at,
      clock_in_distance_meters,
      photo_proof_url,
      status,
      offline_queued,
      workers ( id, employee_code, name, role ),
      projects ( id, code, name ),
      sub_projects ( id, code, name ),
      site_locations ( id, name ),
      approvals ( id, status, notes, reviewed_at )
    `)
    .order('clock_in_at', { ascending: false })
    .limit(50)

  if (supervisor.role === 'supervisor') {
    // Get worker IDs supervised by this user
    const { data: myWorkers } = await supabase
      .from('workers')
      .select('id')
      .eq('supervisor_id', supervisor.id)

    if (!myWorkers || myWorkers.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const workerIds = myWorkers.map(w => w.id)
    query = query.in('worker_id', workerIds)
  }

  const { data: logs, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch attendance records' }, { status: 500 })
  }

  return NextResponse.json({ data: logs })
}

// POST — approve or reject an attendance record
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = approvalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { log_id, status, notes } = parsed.data

  // Get current supervisor
  const { data: supervisor } = await supabase
    .from('workers')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!supervisor || (supervisor.role !== 'supervisor' && supervisor.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Insert approval record
  const { error: approvalError } = await supabase
    .from('approvals')
    .insert({
      attendance_log_id: log_id,
      supervisor_id: supervisor.id,
      status,
      notes: notes ?? null,
    })

  if (approvalError) {
    return NextResponse.json({ error: 'Failed to save approval' }, { status: 500 })
  }

  // Update attendance log status
  const { error: updateError } = await supabase
    .from('attendance_logs')
    .update({ status })
    .eq('id', log_id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update attendance status' }, { status: 500 })
  }

  return NextResponse.json({
    data: { log_id, status, message: `Record ${status}` },
  })
}
