'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DashboardData {
  total_workers: number
  workers_clocked_in: number
  pending_approvals: number
  total_hours_this_week: number
  recent_activity: {
    id: string
    clock_in_at: string
    clock_out_at: string | null
    status: string
    workers: { name: string; employee_code: string } | null
    projects: { code: string } | null
  }[]
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/dashboard')
        const json = await res.json()
        if (json.data) setData(json.data)
      } catch {
        // offline
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString([], {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="text-3xl font-bold text-sky-400">Admin Dashboard</div>
          <div className="text-slate-400 text-lg">MarineTime Overview</div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <div className="text-slate-400 text-base">Total Workers</div>
            <div className="text-white text-4xl font-bold">{data?.total_workers ?? 0}</div>
          </div>
          <div className="bg-emerald-900/30 border border-emerald-600 rounded-2xl p-5">
            <div className="text-emerald-400 text-base">Clocked In Now</div>
            <div className="text-white text-4xl font-bold">{data?.workers_clocked_in ?? 0}</div>
          </div>
          <div className="bg-amber-900/30 border border-amber-500 rounded-2xl p-5">
            <div className="text-amber-400 text-base">Pending Approvals</div>
            <div className="text-white text-4xl font-bold">{data?.pending_approvals ?? 0}</div>
          </div>
          <div className="bg-sky-900/30 border border-sky-500 rounded-2xl p-5">
            <div className="text-sky-400 text-base">Hours This Week</div>
            <div className="text-white text-4xl font-bold">{data?.total_hours_this_week ?? 0}</div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Link href="/admin/workers" className="bg-slate-700 hover:bg-slate-600 text-white text-lg font-semibold rounded-2xl p-4 text-center transition-colors">
            Manage Workers
          </Link>
          <Link href="/admin/sites" className="bg-slate-700 hover:bg-slate-600 text-white text-lg font-semibold rounded-2xl p-4 text-center transition-colors">
            Manage Sites
          </Link>
          <Link href="/admin/payroll" className="bg-slate-700 hover:bg-slate-600 text-white text-lg font-semibold rounded-2xl p-4 text-center transition-colors">
            Payroll Export
          </Link>
          <Link href="/supervisor/approvals" className="bg-slate-700 hover:bg-slate-600 text-white text-lg font-semibold rounded-2xl p-4 text-center transition-colors">
            Approvals
          </Link>
          <Link href="/admin/analytics" className="bg-slate-700 hover:bg-slate-600 text-white text-lg font-semibold rounded-2xl p-4 text-center transition-colors">
            Analytics
          </Link>
          <Link href="/admin/projects" className="bg-slate-700 hover:bg-slate-600 text-white text-lg font-semibold rounded-2xl p-4 text-center transition-colors">
            Projects
          </Link>
          <Link href="/kiosk" className="bg-slate-700 hover:bg-slate-600 text-white text-lg font-semibold rounded-2xl p-4 text-center transition-colors">
            Kiosk Mode
          </Link>
        </div>

        {/* Recent activity */}
        <div className="mb-4">
          <div className="text-xl font-bold text-white mb-3">Recent Activity</div>
          {(!data?.recent_activity || data.recent_activity.length === 0) ? (
            <div className="text-slate-500 text-lg text-center py-8">No recent activity</div>
          ) : (
            <div className="space-y-2">
              {data.recent_activity.map(log => {
                const statusColors: Record<string, string> = {
                  pending: 'text-amber-400',
                  approved: 'text-emerald-400',
                  rejected: 'text-red-400',
                  flagged: 'text-purple-400',
                }
                return (
                  <div key={log.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-white font-semibold">{log.workers?.name ?? 'Unknown'}</span>
                      <span className="text-slate-400 ml-2 font-mono text-sm">{log.workers?.employee_code}</span>
                      <div className="text-slate-400 text-sm">
                        {log.projects?.code ?? '—'} · {formatTime(log.clock_in_at)}
                        {log.clock_out_at && ` — ${formatTime(log.clock_out_at)}`}
                      </div>
                    </div>
                    <span className={`text-sm font-semibold uppercase ${statusColors[log.status] ?? 'text-slate-400'}`}>
                      {log.status}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
