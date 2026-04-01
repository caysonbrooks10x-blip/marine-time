'use client'

import { useEffect, useState } from 'react'

interface WorkerStatus {
  id: string
  employee_code: string
  name: string
  role: string
  active_session: {
    id: string
    clock_in_at: string
    projects: { code: string; name: string } | null
    sub_projects: { code: string } | null
    site_locations: { name: string } | null
  } | null
}

export default function SupervisorWorkersPage() {
  const [workers, setWorkers] = useState<WorkerStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/supervisor/workers')
      const json = await res.json()
      if (json.data) {
        setWorkers(json.data)
        setLastUpdated(new Date())
      }
    } catch {
      // offline
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Auto-refresh every 60 seconds
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  function elapsed(clockIn: string) {
    const mins = Math.round((Date.now() - new Date(clockIn).getTime()) / 60000)
    const hrs = Math.floor(mins / 60)
    const rem = mins % 60
    return hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`
  }

  const clockedIn = workers.filter(w => w.active_session)
  const notClockedIn = workers.filter(w => !w.active_session)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-3xl font-bold text-sky-400">Workers</div>
            <div className="text-slate-400 text-lg">
              {clockedIn.length} of {workers.length} clocked in
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href="/supervisor/roster"
              className="bg-sky-700 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-lg transition-colors"
            >
              Roster
            </a>
            <a
              href="/supervisor/approvals"
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-lg transition-colors"
            >
              Approvals
            </a>
            <button
              onClick={load}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-lg transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {lastUpdated && (
          <div className="text-slate-600 text-sm mb-4">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            {' · '}Auto-refreshes every 60s
          </div>
        )}

        {/* Clocked In */}
        {clockedIn.length > 0 && (
          <div className="mb-6">
            <div className="text-emerald-400 text-lg font-semibold mb-3">
              Clocked In ({clockedIn.length})
            </div>
            <div className="space-y-3">
              {clockedIn.map(w => (
                <div key={w.id} className="bg-emerald-900/20 border border-emerald-700 rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-white text-xl font-bold">{w.name}</span>
                      <span className="text-slate-400 font-mono text-base ml-2">{w.employee_code}</span>
                    </div>
                    <span className="text-emerald-400 font-semibold text-lg">
                      {elapsed(w.active_session!.clock_in_at)}
                    </span>
                  </div>
                  <div className="text-sky-300 font-mono">
                    {w.active_session!.projects?.code ?? '—'}
                    {w.active_session!.sub_projects && (
                      <span className="text-slate-400"> → {w.active_session!.sub_projects.code}</span>
                    )}
                  </div>
                  {w.active_session!.site_locations && (
                    <div className="text-slate-500 text-sm mt-1">
                      📍 {w.active_session!.site_locations.name}
                    </div>
                  )}
                  <div className="text-slate-500 text-sm mt-1">
                    Since {new Date(w.active_session!.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Not Clocked In */}
        {notClockedIn.length > 0 && (
          <div>
            <div className="text-slate-500 text-lg font-semibold mb-3">
              Not Clocked In ({notClockedIn.length})
            </div>
            <div className="space-y-2">
              {notClockedIn.map(w => (
                <div key={w.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-slate-300 text-lg font-semibold">{w.name}</span>
                    <span className="text-slate-500 font-mono text-base ml-2">{w.employee_code}</span>
                  </div>
                  <span className="text-slate-600 text-sm">—</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {workers.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xl">
            No workers assigned to you
          </div>
        )}
      </div>
    </div>
  )
}
