import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — worker's own attendance history (last 30 days)
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: worker } = await supabase
    .from('workers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!worker) {
    return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
  }

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { data: logs, error } = await supabase
    .from('attendance_logs')
    .select(`
      id, clock_in_at, clock_out_at, clock_in_distance_meters,
      status, offline_queued,
      projects ( code, name ),
      sub_projects ( code, name ),
      site_locations ( name ),
      approvals ( status, notes, reviewed_at )
    `)
    .eq('worker_id', worker.id)
    .gte('clock_in_at', since.toISOString())
    .order('clock_in_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }

  return NextResponse.json({ data: logs ?? [] })
}
