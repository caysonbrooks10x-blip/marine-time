import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { firstRelation } from '@/lib/sheets/structure'

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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { data: monthLogs },
    { data: approvalStats },
    { data: topWorkers },
    { data: projectBreakdown },
  ] = await Promise.all([
    // All logs this month
    supabase
      .from('attendance_logs')
      .select('id, clock_in_at, clock_out_at, status')
      .gte('clock_in_at', monthStart),

    // Approval outcomes
    supabase
      .from('attendance_logs')
      .select('status')
      .gte('clock_in_at', monthStart),

    // Top workers by hours this month
    supabase
      .from('attendance_logs')
      .select('worker_id, clock_in_at, clock_out_at, workers(name, employee_code)')
      .gte('clock_in_at', monthStart)
      .not('clock_out_at', 'is', null),

    // Hours by project
    supabase
      .from('attendance_logs')
      .select('project_id, clock_in_at, clock_out_at, projects(code, name)')
      .gte('clock_in_at', monthStart)
      .not('clock_out_at', 'is', null),
  ])

  // Approval rates
  const total = approvalStats?.length ?? 0
  const approved = approvalStats?.filter(r => r.status === 'approved').length ?? 0
  const rejected = approvalStats?.filter(r => r.status === 'rejected').length ?? 0
  const pending = approvalStats?.filter(r => r.status === 'pending').length ?? 0
  const flagged = approvalStats?.filter(r => r.status === 'flagged').length ?? 0

  // Total hours this month
  let totalMinsMonth = 0
  for (const log of monthLogs ?? []) {
    if (log.clock_out_at) {
      totalMinsMonth += Math.round(
        (new Date(log.clock_out_at).getTime() - new Date(log.clock_in_at).getTime()) / 60000
      )
    }
  }

  // Top workers by hours
  const workerHours: Record<string, { name: string; code: string; minutes: number }> = {}
  for (const log of topWorkers ?? []) {
    if (!log.clock_out_at || !log.worker_id) continue
    const mins = Math.round(
      (new Date(log.clock_out_at).getTime() - new Date(log.clock_in_at).getTime()) / 60000
    )
    const w = firstRelation(log.workers)
    if (!w) continue
    if (!workerHours[log.worker_id]) {
      workerHours[log.worker_id] = { name: w.name, code: w.employee_code, minutes: 0 }
    }
    workerHours[log.worker_id].minutes += mins
  }
  const topWorkersList = Object.values(workerHours)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5)
    .map(w => ({ ...w, hours: Math.round(w.minutes / 60 * 10) / 10 }))

  // Project breakdown
  const projectMins: Record<string, { code: string; name: string; minutes: number }> = {}
  for (const log of projectBreakdown ?? []) {
    if (!log.clock_out_at || !log.project_id) continue
    const mins = Math.round(
      (new Date(log.clock_out_at).getTime() - new Date(log.clock_in_at).getTime()) / 60000
    )
    const p = firstRelation(log.projects)
    if (!p) continue
    if (!projectMins[log.project_id]) {
      projectMins[log.project_id] = { code: p.code, name: p.name, minutes: 0 }
    }
    projectMins[log.project_id].minutes += mins
  }
  const projectList = Object.values(projectMins)
    .sort((a, b) => b.minutes - a.minutes)
    .map(p => ({ ...p, hours: Math.round(p.minutes / 60 * 10) / 10 }))

  return NextResponse.json({
    data: {
      this_month: {
        total_sessions: total,
        total_hours: Math.round(totalMinsMonth / 60 * 10) / 10,
        approved,
        rejected,
        pending,
        flagged,
        approval_rate: total > 0 ? Math.round((approved / total) * 100) : 0,
      },
      top_workers: topWorkersList,
      project_breakdown: projectList,
    },
  })
}
