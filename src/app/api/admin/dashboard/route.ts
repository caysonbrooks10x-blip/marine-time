import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — admin dashboard summary stats
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: admin } = await supabase
    .from('workers')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
  }

  // Run all queries in parallel
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const [
    { count: totalWorkers },
    { count: activeWorkers },
    { count: pendingApprovals },
    { data: weekLogs },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.from('workers').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('attendance_logs').select('*', { count: 'exact', head: true }).is('clock_out_at', null),
    supabase.from('attendance_logs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('attendance_logs')
      .select('clock_in_at, clock_out_at')
      .gte('clock_in_at', weekStart.toISOString())
      .not('clock_out_at', 'is', null),
    supabase
      .from('attendance_logs')
      .select(`
        id, clock_in_at, clock_out_at, status,
        workers ( name, employee_code ),
        projects ( code )
      `)
      .order('clock_in_at', { ascending: false })
      .limit(10),
  ])

  // Calculate total hours this week
  let totalMinutesThisWeek = 0
  if (weekLogs) {
    for (const log of weekLogs) {
      if (log.clock_out_at) {
        totalMinutesThisWeek += Math.round(
          (new Date(log.clock_out_at).getTime() - new Date(log.clock_in_at).getTime()) / 60000
        )
      }
    }
  }

  return NextResponse.json({
    data: {
      total_workers: totalWorkers ?? 0,
      workers_clocked_in: activeWorkers ?? 0,
      pending_approvals: pendingApprovals ?? 0,
      total_hours_this_week: Math.round(totalMinutesThisWeek / 60 * 10) / 10,
      recent_activity: recentActivity ?? [],
    },
  })
}
