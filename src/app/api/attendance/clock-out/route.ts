import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { triggerAttendanceWebhook } from '@/lib/webhook-trigger'

const schema = z.object({
  log_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  offline_queued: z.boolean().optional().default(false),
  timestamp: z.string().optional(),
  remarks: z.string().trim().max(500).optional(),
})

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

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { log_id, lat, lng, offline_queued, timestamp, remarks } = parsed.data

  // Fetch the open log — RLS ensures worker can only update their own
  const { data: log, error: fetchError } = await supabase
    .from('attendance_logs')
    .select('id, worker_id, clock_in_at, clock_out_at')
    .eq('id', log_id)
    .is('clock_out_at', null)
    .single()

  if (fetchError || !log) {
    return NextResponse.json(
      { error: 'No open clock-in found for this record', code: 'not_found' },
      { status: 404 }
    )
  }

  const clockOutAt = offline_queued && timestamp
    ? new Date(timestamp).toISOString()
    : new Date().toISOString()

  const { error: updateError } = await supabase
    .from('attendance_logs')
    .update({
      clock_out_at: clockOutAt,
      clock_out_lat: lat,
      clock_out_lng: lng,
      remarks: remarks ?? null,
    })
    .eq('id', log_id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to clock out' }, { status: 500 })
  }

  // Trigger webhook for workbook regeneration (fire-and-forget)
  triggerAttendanceWebhook('UPDATE', { id: log_id, worker_id: log.worker_id }, { id: log_id })

  const durationMs = new Date(clockOutAt).getTime() - new Date(log.clock_in_at).getTime()
  const durationMinutes = Math.round(durationMs / 60000)

  return NextResponse.json({
    data: {
      log_id,
      status: 'clocked_out',
      clock_out_at: clockOutAt,
      duration_minutes: durationMinutes,
    },
  })
}
