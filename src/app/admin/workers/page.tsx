'use client'

import { useEffect, useState } from 'react'

interface Worker {
  id: string
  employee_code: string
  name: string
  position: string | null
  role: string
  supervisor_id: string | null
  is_active: boolean
  created_at: string
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Form state
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formRole, setFormRole] = useState<'worker' | 'supervisor' | 'admin'>('worker')
  const [formPin, setFormPin] = useState('')
  const [formPosition, setFormPosition] = useState('')
  const [formSupervisorId, setFormSupervisorId] = useState<string>('')

  async function fetchWorkers() {
    try {
      const res = await fetch('/api/admin/workers')
      const json = await res.json()
      if (json.data) setWorkers(json.data)
    } catch {
      // offline
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchWorkers() }, [])

  function resetForm() {
    setFormCode('')
    setFormName('')
    setFormPosition('')
    setFormRole('worker')
    setFormPin('')
    setFormSupervisorId('')
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(w: Worker) {
    setEditingId(w.id)
    setFormCode(w.employee_code)
    setFormName(w.name)
    setFormPosition(w.position ?? '')
    setFormRole(w.role as 'worker' | 'supervisor' | 'admin')
    setFormPin('')
    setFormSupervisorId(w.supervisor_id ?? '')
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setFeedback('')

    try {
      if (editingId) {
        // Update
        const body: Record<string, unknown> = { id: editingId, name: formName, role: formRole, position: formPosition || null }
        if (formPin) body.pin = formPin
        body.supervisor_id = formSupervisorId || null

        const res = await fetch('/api/admin/workers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()

        if (!res.ok) {
          setError(json.error ?? 'Update failed')
          setSaving(false)
          return
        }
        setFeedback('Worker updated')
      } else {
        // Create
        if (!formPin || formPin.length !== 4) {
          setError('PIN must be exactly 4 digits')
          setSaving(false)
          return
        }

        const res = await fetch('/api/admin/workers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_code: formCode,
            name: formName,
            position: formPosition || null,
            role: formRole,
            pin: formPin,
            supervisor_id: formSupervisorId || null,
          }),
        })
        const json = await res.json()

        if (!res.ok) {
          setError(json.error ?? 'Creation failed')
          setSaving(false)
          return
        }
        setFeedback('Worker created')
      }

      resetForm()
      await fetchWorkers()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(w: Worker) {
    try {
      const res = await fetch('/api/admin/workers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: w.id, is_active: !w.is_active }),
      })
      if (res.ok) {
        setWorkers(prev => prev.map(x => x.id === w.id ? { ...x, is_active: !x.is_active } : x))
        setFeedback(`Worker ${w.is_active ? 'deactivated' : 'activated'}`)
      }
    } catch {
      setError('Network error')
    }
  }

  const supervisors = workers.filter(w => w.role === 'supervisor' && w.is_active)

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
            <div className="text-slate-400 text-lg">{workers.length} total</div>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-lg font-semibold transition-colors"
          >
            + Add Worker
          </button>
        </div>

        {feedback && (
          <div className="mb-4 bg-emerald-900/50 border border-emerald-500 rounded-xl p-3 text-emerald-300 text-center text-lg">
            {feedback}
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-center text-lg">
            {error}
          </div>
        )}

        {/* Create/Edit form */}
        {showForm && (
          <div className="bg-slate-800 border border-slate-600 rounded-2xl p-5 mb-6 space-y-4">
            <div className="text-white text-xl font-bold">
              {editingId ? 'Edit Worker' : 'New Worker'}
            </div>

            {!editingId && (
              <div>
                <label className="block text-slate-300 text-base mb-1">Employee Code</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={e => setFormCode(e.target.value.toUpperCase())}
                  placeholder="W004"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-sky-400"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-300 text-base mb-1">Name</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Full name"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-base mb-1">Position / Trade</label>
              <input
                type="text"
                value={formPosition}
                onChange={e => setFormPosition(e.target.value)}
                placeholder="e.g. Fitter, Welder, Rigger"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-base mb-1">Role</label>
              <select
                value={formRole}
                onChange={e => setFormRole(e.target.value as 'worker' | 'supervisor' | 'admin')}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-sky-400"
              >
                <option value="worker">Worker</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 text-base mb-1">
                PIN (4 digits){editingId ? ' — leave blank to keep current' : ''}
              </label>
              <input
                type="password"
                value={formPin}
                onChange={e => setFormPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                inputMode="numeric"
                maxLength={4}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-sky-400"
              />
            </div>

            {formRole === 'worker' && supervisors.length > 0 && (
              <div>
                <label className="block text-slate-300 text-base mb-1">Supervisor</label>
                <select
                  value={formSupervisorId}
                  onChange={e => setFormSupervisorId(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-sky-400"
                >
                  <option value="">None</option>
                  {supervisors.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.employee_code})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !formName}
                className="flex-1 min-h-[56px] bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 text-white text-xl font-bold rounded-2xl transition-colors"
              >
                {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
              </button>
              <button
                onClick={resetForm}
                className="min-h-[56px] px-6 bg-slate-700 hover:bg-slate-600 text-white text-lg rounded-2xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Worker list */}
        <div className="space-y-3">
          {workers.map(w => (
            <div
              key={w.id}
              className={`border rounded-2xl p-4 ${w.is_active ? 'border-slate-600 bg-slate-800' : 'border-slate-700 bg-slate-800/50 opacity-60'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-white text-xl font-bold">{w.name}</span>
                  <span className="text-slate-400 text-base ml-2 font-mono">{w.employee_code}</span>
                  {w.position && (
                    <span className="text-slate-500 text-sm ml-2">{w.position}</span>
                  )}
                </div>
                <span className={`px-2 py-1 rounded-full text-sm font-semibold uppercase ${
                  w.role === 'admin' ? 'bg-purple-600 text-white' :
                  w.role === 'supervisor' ? 'bg-sky-600 text-white' :
                  'bg-slate-600 text-white'
                }`}>
                  {w.role}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(w)}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-lg text-base transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(w)}
                  className={`px-3 py-1 rounded-lg text-base transition-colors ${
                    w.is_active
                      ? 'bg-red-900/50 hover:bg-red-800 text-red-300'
                      : 'bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300'
                  }`}
                >
                  {w.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
