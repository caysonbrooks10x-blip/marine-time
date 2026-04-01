'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HistoryRecord {
  id: string
  clock_in_at: string
  clock_out_at: string | null
  clock_in_distance_meters: number | null
  status: string
  offline_queued: boolean
  projects: { code: string; name: string } | null
  sub_projects: { code: string; name: string } | null
  site_locations: { name: string } | null
  approvals: { status: string; notes: string | null; reviewed_at: string }[] | null
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/attendance/history')
        const json = await res.json()
        if (json.data) setRecords(json.data)
      } catch {
        // offline
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function fmt(iso: string) {
    return new Date(iso).toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function duration(clockIn: string, clockOut: string | null) {
    if (!clockOut) return 'Still clocked in'
    const mins = Math.round((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000)
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const totalHours = records
    .filter(r => r.clock_out_at)
    .reduce((acc, r) => {
      return acc + (new Date(r.clock_out_at!).getTime() - new Date(r.clock_in_at).getTime()) / 3600000
    }, 0)

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-600',
    approved: 'bg-emerald-600',
    rejected: 'bg-red-600',
    flagged: 'bg-purple-600',
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
      <div className="p-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-3xl font-bold text-sky-400">My History</div>
            <div className="text-slate-400 text-lg">Last 30 days</div>
          </div>
          <Link href="/clock" className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-base transition-colors">
            ← Clock
          </Link>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
            <div className="text-slate-400 text-sm">Sessions</div>
            <div className="text-white text-3xl font-bold">{records.length}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
            <div className="text-slate-400 text-sm">Hours</div>
            <div className="text-white text-3xl font-bold">{totalHours.toFixed(1)}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
            <div className="text-slate-400 text-sm">Approved</div>
            <div className="text-emerald-400 text-3xl font-bold">
              {records.filter(r => r.status === 'approved').length}
            </div>
          </div>
        </div>

        {records.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xl">No records in the last 30 days</div>
        )}

        <div className="space-y-3">
          {records.map(r => {
            const approval = r.approvals?.[r.approvals.length - 1]
            return (
              <div key={r.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sky-300 font-mono font-semibold">
                      {r.projects?.code ?? '—'}
                      {r.sub_projects && <span className="text-slate-400"> → {r.sub_projects.code}</span>}
                    </div>
                    {r.site_locations && (
                      <div className="text-slate-500 text-sm">📍 {r.site_locations.name}</div>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase text-white ${statusColors[r.status] ?? 'bg-slate-600'}`}>
                    {r.status}
                  </span>
                </div>

                <div className="text-slate-300 text-base">
                  {fmt(r.clock_in_at)}
                </div>
                {r.clock_out_at && (
                  <div className="text-slate-400 text-sm">Out: {fmt(r.clock_out_at)}</div>
                )}
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-slate-400">{duration(r.clock_in_at, r.clock_out_at)}</span>
                  {r.clock_in_distance_meters != null && (
                    <span className={r.clock_in_distance_meters > 100 ? 'text-amber-400' : 'text-emerald-400'}>
                      {r.clock_in_distance_meters}m from site
                    </span>
                  )}
                  {r.offline_queued && <span className="text-amber-400">Offline</span>}
                </div>

                {approval && (
                  <div className="mt-2 pt-2 border-t border-slate-700 text-slate-400 text-sm">
                    {approval.status === 'approved' ? '✓' : '✗'} {approval.notes ?? `${approval.status} by supervisor`}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
