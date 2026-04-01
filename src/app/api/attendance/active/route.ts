import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Get the worker record for this auth user
  const { data: worker } = await supabase
    .from('workers')
    .select('id, employee_code, name, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!worker) {
    return NextResponse.json({ data: null, worker: null })
  }

  const { data: activeLog } = await supabase
    .from('attendance_logs')
    .select(`
      id,
      clock_in_at,
      clock_in_distance_meters,
      project_id,
      sub_project_id,
      site_id,
      projects ( id, code, name ),
      sub_projects ( id, code, name ),
      site_locations ( id, name )
    `)
    .eq('worker_id', worker.id)
    .is('clock_out_at', null)
    .order('clock_in_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ data: activeLog ?? null, worker })
}
