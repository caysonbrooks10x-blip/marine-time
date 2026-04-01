import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  log_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
})

// POST — supervisor/admin force-closes an open attendance session
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: supervisor } = await supabase
    .from('workers')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!supervisor || (supervisor.role !== 'supervisor' && supervisor.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden — supervisor access required' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { log_id, notes } = parsed.data

  // Verify the log exists and has no clock_out yet
  const { data: log, error: fetchError } = await supabase
    .from('attendance_logs')
    .select('id, clock_out_at, worker_id')
    .eq('id', log_id)
    .single()

  if (fetchError || !log) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  if (log.clock_out_at) {
    return NextResponse.json({ error: 'Session already closed' }, { status: 409 })
  }

  const now = new Date().toISOString()

  // Force clock-out
  const { error: updateError } = await supabase
    .from('attendance_logs')
    .update({
      clock_out_at: now,
      status: 'flagged',
    })
    .eq('id', log_id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to force clock-out' }, { status: 500 })
  }

  // Record approval with flagged note
  await supabase.from('approvals').insert({
    attendance_log_id: log_id,
    supervisor_id: supervisor.id,
    status: 'rejected',
    notes: notes ?? 'Force clocked out by supervisor',
  })

  return NextResponse.json({
    data: { log_id, clock_out_at: now, message: 'Session force-closed' },
  })
}
