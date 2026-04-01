'use client'

import { useEffect, useState, useCallback } from 'react'

interface WorkerInfo {
  id: string
  employee_code: string
  name: string
  position: string | null
  role: string
}

interface AttendanceLog {
  id: string
  worker_id: string
  clock_in_at: string
  clock_out_at: string | null
  clock_in_distance_meters: number | null
  status: string
  projects: { code: string; name: string } | null
  sub_projects: { code: string; name: string } | null
  site_locations: { name: string } | null
}

interface RosterEntry {
  id: string
  worker_id: string
  work_date: string
  status: string
  remarks: string | null
  recorded_by: string | null
}

interface RosterRow {
  worker: WorkerInfo
  attendance: AttendanceLog[]
  roster_entry: RosterEntry | null
  effective_status: string | null
}

interface RosterData {
  date: string
  total_workers: number
  total_man_power: number
  roster: RosterRow[]
}

const STATUS_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'project_off', label: 'Project Off' },
  { value: 'off', label: 'Off' },
  { value: 'absent', label: 'Absent' },
  { value: 'home_leave', label: 'Home Leave' },
  { value: 'mc', label: 'MC' },
  { value: 'no_job', label: 'No Job' },
  { value: 'supply', label: 'Supply' },
  { value: 'resign', label: 'Resign' },
]

const STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  project_off: 'POFF',
  off: 'Off',
  absent: 'Absent',
  home_leave: 'Home Leave',
  mc: 'MC',
  no_job: 'No Job',
  supply: 'Supply',
  resign: 'Resign',
}

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-emerald-900/50 text-emerald-300 border-emerald-500',
  project_off: 'bg-amber-900/50 text-amber-300 border-amber-500',
  off: 'bg-slate-700 text-slate-300 border-slate-500',
  absent: 'bg-red-900/50 text-red-300 border-red-500',
  home_leave: 'bg-purple-900/50 text-purple-300 border-purple-500',
  mc: 'bg-orange-900/50 text-orange-300 border-orange-500',
  no_job: 'bg-slate-700 text-slate-400 border-slate-500',
  supply: 'bg-sky-900/50 text-sky-300 border-sky-500',
  resign: 'bg-red-900/50 text-red-400 border-red-600',
}

function todayString(): string {
  const now = new Date()
  const offset = 8 * 60 // Singapore UTC+8
  const local = new Date(now.getTime() + offset * 60000)
  return local.toISOString().slice(0, 10)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Singapore',
  })
}

export default function DailyRosterPage() {
  const [date, setDate] = useState(todayString)
  const [data, setData] = useState<RosterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // worker_id being saved
  const [error, setError] = useState('')

  const fetchRoster = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/roster?date=${date}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to load roster')
        return
      }
      setData(json.data)
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchRoster()
  }, [fetchRoster])

  async function handleStatusChange(workerId: string, status: string) {
    if (!status) return
    setSaving(workerId)
    try {
      const res = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker_id: workerId,
          work_date: date,
          status,
        }),
      })
      if (res.ok) {
        await fetchRoster()
      }
    } finally {
      setSaving(null)
    }
  }

  async function handleClearStatus(entryId: string) {
    try {
      const res = await fetch('/api/roster', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entryId }),
      })
      if (res.ok) {
        await fetchRoster()
      }
    } catch {
      // silent
    }
  }

  function changeDate(delta: number) {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().slice(0, 10))
  }

  const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-SG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-3xl font-bold text-sky-400 mb-1">Daily Roster</div>
            <div className="text-slate-400 text-lg">Safe Work Declaration Form</div>
          </div>
          <a
            href="/supervisor/approvals"
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-lg transition-colors"
          >
            Approvals
          </a>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => changeDate(-1)}
            className="min-h-[48px] px-4 bg-slate-700 hover:bg-slate-600 text-white text-xl rounded-xl"
          >
            ←
          </button>
          <div className="flex-1 text-center">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white text-lg rounded-xl px-4 py-3 w-full max-w-[200px] text-center"
            />
            <div className="text-slate-400 text-base mt-1">{dayLabel}</div>
          </div>
          <button
            onClick={() => changeDate(1)}
            className="min-h-[48px] px-4 bg-slate-700 hover:bg-slate-600 text-white text-xl rounded-xl"
          >
            →
          </button>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-white">{data.total_man_power}</div>
              <div className="text-slate-400 text-base">Man Power</div>
            </div>
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-white">{data.total_workers}</div>
              <div className="text-slate-400 text-base">Total Workers</div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-center text-lg">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Roster table */}
        {data && !loading && (
          <div className="space-y-2">
            {/* Column headers (desktop) */}
            <div className="hidden md:grid md:grid-cols-[60px_100px_1fr_120px_140px_80px_80px_160px] gap-2 px-3 py-2 text-slate-500 text-sm font-semibold">
              <div>S.N</div>
              <div>Emp No</div>
              <div>Name</div>
              <div>Position</div>
              <div>Project</div>
              <div>In</div>
              <div>Out</div>
              <div>Status / Remark</div>
            </div>

            {data.roster.map((row, index) => {
              const log = row.attendance[0] // primary clock-in for the day
              const isPresent = row.effective_status === 'present'
              const hasRosterEntry = row.roster_entry !== null
              const statusColor = row.effective_status
                ? STATUS_COLORS[row.effective_status] ?? 'bg-slate-800 text-slate-300 border-slate-600'
                : 'bg-slate-800/50 text-slate-500 border-slate-700'

              return (
                <div
                  key={row.worker.id}
                  className={`border rounded-xl p-3 ${statusColor} transition-colors`}
                >
                  {/* Mobile layout */}
                  <div className="md:hidden">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-slate-400 text-sm mr-2">{index + 1}.</span>
                        <span className="font-mono text-sm opacity-70">{row.worker.employee_code}</span>
                        <div className="text-lg font-semibold">{row.worker.name}</div>
                        {row.worker.position && (
                          <div className="text-sm opacity-70">{row.worker.position}</div>
                        )}
                      </div>
                      {row.effective_status && (
                        <span className="text-sm font-bold whitespace-nowrap">
                          {STATUS_LABELS[row.effective_status] ?? row.effective_status}
                        </span>
                      )}
                    </div>

                    {isPresent && log && (
                      <div className="text-sm space-y-1 mb-2">
                        <div>
                          <span className="opacity-70">Project: </span>
                          {(log.projects as { code: string; name: string } | null)?.name ?? '—'}
                          {' '}({(log.projects as { code: string; name: string } | null)?.code ?? ''})
                        </div>
                        <div>
                          <span className="opacity-70">Time: </span>
                          {formatTime(log.clock_in_at)}
                          {' — '}
                          {log.clock_out_at ? formatTime(log.clock_out_at) : 'still in'}
                        </div>
                      </div>
                    )}

                    {!isPresent && (
                      <div className="flex items-center gap-2">
                        <select
                          value={row.roster_entry?.status ?? ''}
                          onChange={e => handleStatusChange(row.worker.id, e.target.value)}
                          disabled={saving === row.worker.id}
                          className="flex-1 min-h-[44px] bg-slate-800 border border-slate-600 text-white rounded-xl px-3 text-base"
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {hasRosterEntry && (
                          <button
                            onClick={() => handleClearStatus(row.roster_entry!.id)}
                            className="min-h-[44px] px-3 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-xl text-sm"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden md:grid md:grid-cols-[60px_100px_1fr_120px_140px_80px_80px_160px] gap-2 items-center">
                    <div className="text-sm opacity-70">{index + 1}</div>
                    <div className="font-mono text-sm">{row.worker.employee_code}</div>
                    <div className="font-semibold truncate">{row.worker.name}</div>
                    <div className="text-sm opacity-70 truncate">{row.worker.position ?? '—'}</div>

                    {isPresent && log ? (
                      <>
                        <div className="text-sm truncate">
                          {(log.projects as { code: string; name: string } | null)?.code ?? '—'}
                        </div>
                        <div className="text-sm font-mono">{formatTime(log.clock_in_at)}</div>
                        <div className="text-sm font-mono">
                          {log.clock_out_at ? formatTime(log.clock_out_at) : '—'}
                        </div>
                        <div className="text-sm font-bold">Present</div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm">—</div>
                        <div className="text-sm">—</div>
                        <div className="text-sm">—</div>
                        <div className="flex items-center gap-1">
                          <select
                            value={row.roster_entry?.status ?? ''}
                            onChange={e => handleStatusChange(row.worker.id, e.target.value)}
                            disabled={saving === row.worker.id}
                            className="w-full min-h-[36px] bg-slate-800 border border-slate-600 text-white rounded-lg px-2 text-sm"
                          >
                            {STATUS_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          {hasRosterEntry && (
                            <button
                              onClick={() => handleClearStatus(row.roster_entry!.id)}
                              className="text-slate-500 hover:text-red-400 text-xs"
                              title="Clear status"
                            >
                              x
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        {data && !loading && (
          <div className="mt-6 border-t border-slate-700 pt-4 space-y-4">
            <div className="text-slate-500 text-sm text-center">
              Total Man Power (excluding MC/Off/No Job/Home Leave/Absent): {data.total_man_power}
            </div>
            <a
              href={`/api/admin/export/daily-sheet?date=${date}`}
              className="block w-full min-h-[56px] bg-sky-600 hover:bg-sky-500 text-white text-xl font-semibold rounded-2xl transition-colors text-center leading-[56px]"
            >
              Export Daily Sheet (Excel)
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
