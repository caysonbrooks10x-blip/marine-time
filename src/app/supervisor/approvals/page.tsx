'use client'

import { useEffect, useState } from 'react'

interface AttendanceRecord {
  id: string
  clock_in_at: string
  clock_out_at: string | null
  clock_in_distance_meters: number | null
  photo_proof_url: string | null
  status: string
  offline_queued: boolean
  workers: { employee_code: string; name: string } | null
  projects: { code: string; name: string } | null
  sub_projects: { code: string; name: string } | null
  site_locations: { name: string } | null
  approvals: { status: string; notes: string | null; reviewed_at: string }[] | null
}

export default function ApprovalsPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState('')
  const [forceLoading, setForceLoading] = useState<string | null>(null)

  async function fetchRecords() {
    try {
      const res = await fetch('/api/approvals')
      const json = await res.json()
      if (json.data) setRecords(json.data)
    } catch {
      // offline
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRecords() }, [])

  async function handleForceClockOut(logId: string) {
    setForceLoading(logId)
    setFeedback('')
    try {
      const res = await fetch('/api/attendance/force-clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_id: logId,
          notes: noteInputs[logId] || 'Force clocked out by supervisor',
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setFeedback('Session force-closed and flagged')
        setRecords(prev =>
          prev.map(r => r.id === logId ? { ...r, status: 'flagged', clock_out_at: json.data?.clock_out_at } : r)
        )
      } else {
        setFeedback(json.error ?? 'Force clock-out failed')
      }
    } catch {
      setFeedback('Network error')
    } finally {
      setForceLoading(null)
    }
  }

  async function handleAction(logId: string, status: 'approved' | 'rejected') {
    setActionLoading(logId)
    setFeedback('')

    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_id: logId,
          status,
          notes: noteInputs[logId] || undefined,
        }),
      })
      const json = await res.json()

      if (res.ok) {
        setFeedback(`Record ${status}`)
        // Update local state
        setRecords(prev =>
          prev.map(r =>
            r.id === logId ? { ...r, status } : r
          )
        )
      } else {
        setFeedback(json.error ?? 'Action failed')
      }
    } catch {
      setFeedback('Network error')
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = filter === 'pending'
    ? records.filter(r => r.status === 'pending')
    : records

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString([], {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function formatDuration(clockIn: string, clockOut: string | null) {
    if (!clockOut) return 'Still clocked in'
    const mins = Math.round((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000)
    const hrs = Math.floor(mins / 60)
    const rem = mins % 60
    return `${hrs}h ${rem}m`
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
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-3xl font-bold text-sky-400">Approvals</div>
            <div className="text-slate-400 text-lg">Review attendance records</div>
          </div>
          <div className="flex gap-2">
            <a
              href="/supervisor/roster"
              className="bg-sky-700 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-lg transition-colors"
            >
              Roster
            </a>
            <a
              href="/supervisor/workers"
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-lg transition-colors"
            >
              Workers
            </a>
            <button
              onClick={() => setFilter(f => f === 'pending' ? 'all' : 'pending')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-lg"
            >
              {filter === 'pending' ? 'Show All' : 'Pending Only'}
            </button>
          </div>
        </div>

        {feedback && (
          <div className="mb-4 bg-sky-900/50 border border-sky-500 rounded-xl p-3 text-sky-300 text-center text-lg">
            {feedback}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xl">
            {filter === 'pending' ? 'No pending records to review' : 'No records found'}
          </div>
        )}

        <div className="space-y-4">
          {filtered.map(record => {
            const isPending = record.status === 'pending'
            const statusColors: Record<string, string> = {
              pending: 'bg-amber-900/40 border-amber-500',
              approved: 'bg-emerald-900/30 border-emerald-600',
              rejected: 'bg-red-900/30 border-red-600',
              flagged: 'bg-purple-900/30 border-purple-600',
            }

            return (
              <div
                key={record.id}
                className={`border-2 rounded-2xl p-5 ${statusColors[record.status] ?? 'border-slate-600'}`}
              >
                {/* Worker info */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-white text-xl font-bold">
                      {record.workers?.name ?? 'Unknown'}
                    </span>
                    <span className="text-slate-400 text-lg ml-2 font-mono">
                      {record.workers?.employee_code}
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-base font-semibold uppercase ${
                    record.status === 'pending' ? 'bg-amber-600 text-white' :
                    record.status === 'approved' ? 'bg-emerald-600 text-white' :
                    record.status === 'rejected' ? 'bg-red-600 text-white' :
                    'bg-slate-600 text-white'
                  }`}>
                    {record.status}
                  </span>
                </div>

                {/* Project */}
                <div className="text-sky-300 text-lg font-mono mb-1">
                  {record.projects?.code ?? '—'}
                  {record.sub_projects && (
                    <span className="text-slate-300"> → {record.sub_projects.code}</span>
                  )}
                </div>

                {/* Times */}
                <div className="text-slate-300 text-base mb-1">
                  In: {formatTime(record.clock_in_at)}
                  {record.clock_out_at && (
                    <span> — Out: {formatTime(record.clock_out_at)}</span>
                  )}
                </div>
                <div className="text-slate-400 text-base mb-2">
                  Duration: {formatDuration(record.clock_in_at, record.clock_out_at)}
                </div>

                {/* GPS + Site */}
                <div className="flex flex-wrap gap-3 mb-3 text-base">
                  {record.site_locations && (
                    <span className="text-slate-400">
                      📍 {record.site_locations.name}
                    </span>
                  )}
                  {record.clock_in_distance_meters !== null && (
                    <span className={record.clock_in_distance_meters > 100
                      ? 'text-amber-400' : 'text-emerald-400'
                    }>
                      {record.clock_in_distance_meters}m from site
                    </span>
                  )}
                  {record.offline_queued && (
                    <span className="text-amber-400">⚠ Submitted offline</span>
                  )}
                </div>

                {/* Photo thumbnail */}
                {record.photo_proof_url && (
                  <div className="mb-3">
                    <img
                      src={record.photo_proof_url}
                      alt="Attendance photo"
                      className="w-24 h-24 rounded-xl object-cover border border-slate-600"
                    />
                  </div>
                )}

                {/* Previous approvals */}
                {record.approvals && record.approvals.length > 0 && (
                  <div className="mb-3 text-slate-400 text-sm">
                    {record.approvals.map((a, i) => (
                      <div key={i}>
                        {a.status} {a.notes ? `— "${a.notes}"` : ''} on{' '}
                        {new Date(a.reviewed_at).toLocaleDateString()}
                      </div>
                    ))}
                  </div>
                )}

                {/* Force clock-out — only for open sessions (no clock_out_at) */}
                {!record.clock_out_at && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <div className="text-amber-400 text-sm font-semibold mb-2">⚠ Session still open</div>
                    <button
                      onClick={() => handleForceClockOut(record.id)}
                      disabled={forceLoading === record.id}
                      className="w-full min-h-[48px] bg-amber-700 hover:bg-amber-600 disabled:bg-slate-700 text-white text-lg font-bold rounded-xl transition-colors"
                    >
                      {forceLoading === record.id ? '…' : 'Force Clock-Out'}
                    </button>
                  </div>
                )}

                {/* Actions — only for pending */}
                {isPending && (
                  <div className="space-y-3 mt-4">
                    <input
                      type="text"
                      placeholder="Add note (optional)"
                      value={noteInputs[record.id] ?? ''}
                      onChange={e => setNoteInputs(prev => ({ ...prev, [record.id]: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-sky-400"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleAction(record.id, 'approved')}
                        disabled={actionLoading === record.id}
                        className="flex-1 min-h-[56px] bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xl font-bold rounded-2xl transition-colors"
                      >
                        {actionLoading === record.id ? '…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleAction(record.id, 'rejected')}
                        disabled={actionLoading === record.id}
                        className="flex-1 min-h-[56px] bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-white text-xl font-bold rounded-2xl transition-colors"
                      >
                        {actionLoading === record.id ? '…' : 'Reject'}
                      </button>
                    </div>
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
