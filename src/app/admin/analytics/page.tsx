'use client'

import { useEffect, useState } from 'react'

interface Analytics {
  this_month: {
    total_sessions: number
    total_hours: number
    approved: number
    rejected: number
    pending: number
    flagged: number
    approval_rate: number
  }
  top_workers: { name: string; code: string; hours: number }[]
  project_breakdown: { code: string; name: string; hours: number }[]
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/analytics')
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  const m = data?.this_month

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="text-3xl font-bold text-sky-400">Analytics</div>
          <div className="text-slate-400 text-lg">This month</div>
        </div>

        {/* Approval rate ring + stats */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
          <div className="text-white text-xl font-bold mb-4">Approval Rate</div>
          <div className="flex items-center gap-8">
            <div className="text-6xl font-bold text-emerald-400">{m?.approval_rate ?? 0}%</div>
            <div className="space-y-2 text-base">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                <span className="text-slate-300">Approved: <span className="text-white font-semibold">{m?.approved ?? 0}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                <span className="text-slate-300">Rejected: <span className="text-white font-semibold">{m?.rejected ?? 0}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                <span className="text-slate-300">Pending: <span className="text-white font-semibold">{m?.pending ?? 0}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
                <span className="text-slate-300">Flagged: <span className="text-white font-semibold">{m?.flagged ?? 0}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <div className="text-slate-400 text-base">Total Sessions</div>
            <div className="text-white text-4xl font-bold">{m?.total_sessions ?? 0}</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <div className="text-slate-400 text-base">Total Hours</div>
            <div className="text-white text-4xl font-bold">{m?.total_hours ?? 0}</div>
          </div>
        </div>

        {/* Top workers */}
        <div className="mb-6">
          <div className="text-white text-xl font-bold mb-3">Top Workers by Hours</div>
          {(!data?.top_workers || data.top_workers.length === 0) ? (
            <div className="text-slate-500 text-lg text-center py-6">No data yet</div>
          ) : (
            <div className="space-y-2">
              {data.top_workers.map((w, i) => (
                <div key={w.code} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-xl font-bold w-6">#{i + 1}</span>
                    <div>
                      <div className="text-white font-semibold">{w.name}</div>
                      <div className="text-slate-400 text-sm font-mono">{w.code}</div>
                    </div>
                  </div>
                  <div className="text-sky-400 text-xl font-bold">{w.hours}h</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Project breakdown */}
        <div className="mb-6">
          <div className="text-white text-xl font-bold mb-3">Hours by Project</div>
          {(!data?.project_breakdown || data.project_breakdown.length === 0) ? (
            <div className="text-slate-500 text-lg text-center py-6">No data yet</div>
          ) : (
            <div className="space-y-2">
              {data.project_breakdown.map(p => {
                const total = data.project_breakdown.reduce((acc, x) => acc + x.hours, 0)
                const pct = total > 0 ? Math.round((p.hours / total) * 100) : 0
                return (
                  <div key={p.code} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <div className="flex justify-between mb-2">
                      <div>
                        <span className="text-sky-300 font-mono font-semibold">{p.code}</span>
                        <span className="text-slate-400 text-sm ml-2">{p.name}</span>
                      </div>
                      <span className="text-white font-bold">{p.hours}h</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-sky-500 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
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
