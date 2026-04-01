import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — supervisor's workers with their current clock-in status
export async function GET() {
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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get workers under this supervisor (or all for admin)
  let workersQuery = supabase
    .from('workers')
    .select('id, employee_code, name, role, is_active')
    .eq('is_active', true)
    .eq('role', 'worker')
    .order('name')

  if (supervisor.role === 'supervisor') {
    workersQuery = workersQuery.eq('supervisor_id', supervisor.id)
  }

  const { data: workers, error: workersError } = await workersQuery

  if (workersError) {
    return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 })
  }

  if (!workers || workers.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // Get open sessions for these workers
  const workerIds = workers.map(w => w.id)
  const { data: openSessions } = await supabase
    .from('attendance_logs')
    .select(`
      id, clock_in_at, worker_id,
      projects ( code, name ),
      sub_projects ( code ),
      site_locations ( name )
    `)
    .in('worker_id', workerIds)
    .is('clock_out_at', null)

  // Merge: each worker + their open session if any
  const sessionMap = new Map(
    (openSessions ?? []).map(s => [s.worker_id, s])
  )

  const result = workers.map(w => ({
    ...w,
    active_session: sessionMap.get(w.id) ?? null,
  }))

  return NextResponse.json({ data: result })
}
