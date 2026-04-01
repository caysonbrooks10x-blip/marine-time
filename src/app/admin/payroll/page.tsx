'use client'

import { useState } from 'react'

export default function PayrollPage() {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Live Excel state
  const [excelLoading, setExcelLoading] = useState(false)
  const [excelError, setExcelError] = useState('')
  const [regenLoading, setRegenLoading] = useState(false)
  const [regenMsg, setRegenMsg] = useState('')

  // Company workbook state
  const [companyMonth, setCompanyMonth] = useState(currentMonth)
  const [companyLoading, setCompanyLoading] = useState(false)
  const [companyError, setCompanyError] = useState('')
  const [companyRegenLoading, setCompanyRegenLoading] = useState(false)
  const [companyMsg, setCompanyMsg] = useState('')

  // Google Sheets init state
  const [sheetsLoading, setSheetsLoading] = useState(false)
  const [sheetsMsg, setSheetsMsg] = useState('')

  async function handleExport() {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates')
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/payroll/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_start: startDate, period_end: endDate, format }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Export failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payroll_${startDate}_${endDate}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSuccess('Payroll exported successfully')
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadExcel() {
    setExcelLoading(true)
    setExcelError('')
    try {
      const res = await fetch('/api/admin/export/excel')
      const json = await res.json()
      if (!res.ok) {
        setExcelError(json.error ?? 'Failed to get Excel file')
        return
      }
      window.open(json.url, '_blank')
    } catch {
      setExcelError('Network error')
    } finally {
      setExcelLoading(false)
    }
  }

  async function handleRegenExcel() {
    setRegenLoading(true)
    setRegenMsg('')
    try {
      const res = await fetch('/api/admin/export/excel', { method: 'POST' })
      const json = await res.json()
      setRegenMsg(res.ok ? 'Excel file regenerated successfully' : (json.error ?? 'Failed'))
    } catch {
      setRegenMsg('Network error')
    } finally {
      setRegenLoading(false)
    }
  }

  async function handleInitSheets() {
    setSheetsLoading(true)
    setSheetsMsg('')
    try {
      const res = await fetch('/api/admin/sheets/init', { method: 'POST' })
      const json = await res.json()
      setSheetsMsg(res.ok ? 'Google Sheets initialized!' : (json.error ?? 'Failed'))
    } catch {
      setSheetsMsg('Network error')
    } finally {
      setSheetsLoading(false)
    }
  }

  async function handleDownloadCompanyWorkbook() {
    setCompanyLoading(true)
    setCompanyError('')

    try {
      const res = await fetch(`/api/admin/export/company-timesheet?month=${companyMonth}`)
      const json = await res.json()

      if (!res.ok) {
        setCompanyError(json.error ?? 'Failed to get company workbook')
        return
      }

      window.open(json.url, '_blank')
    } catch {
      setCompanyError('Network error')
    } finally {
      setCompanyLoading(false)
    }
  }

  async function handleRegenerateCompanyWorkbook() {
    setCompanyRegenLoading(true)
    setCompanyMsg('')
    setCompanyError('')

    try {
      const res = await fetch('/api/admin/export/company-timesheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: companyMonth }),
      })
      const json = await res.json()

      if (!res.ok) {
        setCompanyError(json.error ?? 'Failed to regenerate company workbook')
        return
      }

      setCompanyMsg(json.message ?? 'Company workbook regenerated')
    } catch {
      setCompanyError('Network error')
    } finally {
      setCompanyRegenLoading(false)
    }
  }

  function setThisWeek() {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(now.toISOString().split('T')[0])
  }

  function setLastWeek() {
    const now = new Date()
    const end = new Date(now)
    end.setDate(now.getDate() - now.getDay() - 1)
    const start = new Date(end)
    start.setDate(end.getDate() - 6)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  function setThisMonth() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(now.toISOString().split('T')[0])
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-6 max-w-lg mx-auto space-y-10">

        {/* ── Section 1: Period Export ── */}
        <div>
          <div className="mb-6">
            <div className="text-3xl font-bold text-sky-400">Payroll Export</div>
            <div className="text-slate-400 text-lg">Generate attendance reports by date range</div>
          </div>

          <div className="flex gap-2 mb-6">
            <button onClick={setThisWeek} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-xl text-base transition-colors">This Week</button>
            <button onClick={setLastWeek} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-xl text-base transition-colors">Last Week</button>
            <button onClick={setThisMonth} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-xl text-base transition-colors">This Month</button>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-slate-300 text-lg font-medium mb-2">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-4 text-white text-xl focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="block text-slate-300 text-lg font-medium mb-2">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-4 text-white text-xl focus:outline-none focus:border-sky-400" />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-slate-300 text-lg font-medium mb-2">Format</label>
            <div className="flex gap-3">
              {(['csv', 'pdf'] as const).map(f => (
                <button key={f} onClick={() => setFormat(f)}
                  className={`flex-1 min-h-[52px] rounded-xl text-lg font-semibold border-2 transition-colors ${
                    format === f ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:text-white'
                  }`}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="mb-4 bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-center text-lg">{error}</div>}
          {success && <div className="mb-4 bg-emerald-900/50 border border-emerald-500 rounded-xl p-3 text-emerald-300 text-center text-lg">{success}</div>}

          <button onClick={handleExport} disabled={loading || !startDate || !endDate}
            className="w-full min-h-[64px] bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 text-white text-2xl font-bold rounded-2xl transition-colors">
            {loading ? 'Exporting…' : `Export ${format.toUpperCase()}`}
          </button>
        </div>

        {/* ── Section 2: Live Excel (auto-updated) ── */}
        <div className="border-t border-slate-700 pt-8">
          <div className="mb-4">
            <div className="text-2xl font-bold text-emerald-400">Live Excel File</div>
            <div className="text-slate-400 text-base mt-1">
              Auto-updated on every clock-in, clock-out, and approval. Contains 4 sheets:
              Attendance Log, Daily Summary, Project Hours, Pending Approvals.
            </div>
          </div>

          {excelError && <div className="mb-3 bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-base">{excelError}</div>}
          {regenMsg && <div className="mb-3 bg-emerald-900/50 border border-emerald-500 rounded-xl p-3 text-emerald-300 text-base">{regenMsg}</div>}

          <div className="flex gap-3">
            <button onClick={handleDownloadExcel} disabled={excelLoading}
              className="flex-1 min-h-[56px] bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-lg font-bold rounded-2xl transition-colors">
              {excelLoading ? 'Getting link…' : 'Download Live Excel'}
            </button>
            <button onClick={handleRegenExcel} disabled={regenLoading}
              className="min-h-[56px] px-5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white text-base rounded-2xl transition-colors">
              {regenLoading ? '…' : 'Regenerate'}
            </button>
          </div>
          <div className="mt-2 text-slate-500 text-sm text-center">
            Requires Supabase webhook to be configured — see deployment docs
          </div>
        </div>

        {/* ── Section 3: Company Workbook ── */}
        <div className="border-t border-slate-700 pt-8">
          <div className="mb-4">
            <div className="text-2xl font-bold text-amber-400">Company Timesheet Workbook</div>
            <div className="text-slate-400 text-base mt-1">
              Uses your company payroll rules and generates an official-style workbook with:
              Company Summary, Legacy Total, Entries, and Config sheets.
              The current month is auto-regenerated on every clock-in and clock-out.
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-slate-300 text-lg font-medium mb-2">Workbook Month</label>
            <input
              type="month"
              value={companyMonth}
              onChange={e => setCompanyMonth(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-4 text-white text-xl focus:outline-none focus:border-amber-400"
            />
          </div>

          {companyError && (
            <div className="mb-3 bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-base">
              {companyError}
            </div>
          )}
          {companyMsg && (
            <div className="mb-3 bg-emerald-900/50 border border-emerald-500 rounded-xl p-3 text-emerald-300 text-base">
              {companyMsg}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleDownloadCompanyWorkbook}
              disabled={companyLoading || !companyMonth}
              className="flex-1 min-h-[56px] bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white text-lg font-bold rounded-2xl transition-colors"
            >
              {companyLoading ? 'Getting link…' : 'Download Company Workbook'}
            </button>
            <button
              onClick={handleRegenerateCompanyWorkbook}
              disabled={companyRegenLoading || !companyMonth}
              className="min-h-[56px] px-5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white text-base rounded-2xl transition-colors"
            >
              {companyRegenLoading ? '…' : 'Regenerate'}
            </button>
          </div>

          <div className="mt-2 text-slate-500 text-sm text-center">
            Configure `TIMESHEET_PUBLIC_HOLIDAYS` in `.env.local` for Sunday/Public Holiday overtime rules.
          </div>
        </div>

        {/* ── Section 4: Google Sheets ── */}
        <div className="border-t border-slate-700 pt-8">
          <div className="mb-4">
            <div className="text-2xl font-bold text-sky-400">Google Sheets Sync</div>
            <div className="text-slate-400 text-base mt-1">
              Rows are appended/updated in real time via Supabase webhook.
              Run init once after setting up your Google service account.
            </div>
          </div>

          {sheetsMsg && (
            <div className={`mb-3 border rounded-xl p-3 text-base text-center ${
              sheetsMsg.includes('nitializ') ? 'bg-emerald-900/50 border-emerald-500 text-emerald-300' : 'bg-red-900/50 border-red-500 text-red-300'
            }`}>{sheetsMsg}</div>
          )}

          <button onClick={handleInitSheets} disabled={sheetsLoading}
            className="w-full min-h-[56px] bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white text-lg font-semibold rounded-2xl transition-colors">
            {sheetsLoading ? 'Initializing…' : 'Initialize Google Sheets'}
          </button>

          <div className="mt-3 bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-400 text-sm space-y-1">
            <div className="text-slate-300 font-semibold mb-2">Required .env.local variables:</div>
            <div className="font-mono">GOOGLE_SERVICE_ACCOUNT_EMAIL</div>
            <div className="font-mono">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</div>
            <div className="font-mono">GOOGLE_SHEETS_ID</div>
            <div className="font-mono">WEBHOOK_SECRET</div>
          </div>
        </div>

      </div>
    </div>
  )
}
