'use client'

import { useEffect, useState } from 'react'

interface SubProject { id: string; code: string; name: string; description: string | null; is_active: boolean }
interface Project { id: string; code: string; name: string; description: string | null; is_active: boolean; sub_projects: SubProject[] }

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // New project form
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [pCode, setPCode] = useState('')
  const [pName, setPName] = useState('')
  const [pDesc, setPDesc] = useState('')

  // New sub-project form
  const [showSubForm, setShowSubForm] = useState<string | null>(null)
  const [spCode, setSpCode] = useState('')
  const [spName, setSpName] = useState('')
  const [spDesc, setSpDesc] = useState('')

  async function load() {
    try {
      const res = await fetch('/api/admin/projects')
      const json = await res.json()
      if (json.data) setProjects(json.data)
    } catch { /* offline */ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function createProject() {
    if (!pCode || !pName) { setError('Code and name required'); return }
    setSaving(true); setError(''); setFeedback('')
    try {
      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pCode, name: pName, description: pDesc || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed'); return }
      setFeedback('Project created')
      setPCode(''); setPName(''); setPDesc(''); setShowProjectForm(false)
      await load()
    } catch { setError('Network error') } finally { setSaving(false) }
  }

  async function createSubProject(projectId: string) {
    if (!spCode || !spName) { setError('Code and name required'); return }
    setSaving(true); setError(''); setFeedback('')
    try {
      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, code: spCode, name: spName, description: spDesc || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed'); return }
      setFeedback('Sub-project created')
      setSpCode(''); setSpName(''); setSpDesc(''); setShowSubForm(null)
      await load()
    } catch { setError('Network error') } finally { setSaving(false) }
  }

  async function toggle(id: string, type: 'project' | 'sub_project', isActive: boolean) {
    try {
      await fetch('/api/admin/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, is_active: !isActive }),
      })
      setFeedback(`${type === 'project' ? 'Project' : 'Sub-project'} ${isActive ? 'deactivated' : 'activated'}`)
      await load()
    } catch { setError('Network error') }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="animate-spin w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-3xl font-bold text-sky-400">Projects</div>
            <div className="text-slate-400 text-lg">{projects.length} projects</div>
          </div>
          <button onClick={() => setShowProjectForm(v => !v)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-lg font-semibold transition-colors">
            + New Project
          </button>
        </div>

        {feedback && <div className="mb-4 bg-emerald-900/50 border border-emerald-500 rounded-xl p-3 text-emerald-300 text-center text-lg">{feedback}</div>}
        {error && <div className="mb-4 bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-center text-lg">{error}</div>}

        {/* New project form */}
        {showProjectForm && (
          <div className="bg-slate-800 border border-slate-600 rounded-2xl p-5 mb-6 space-y-3">
            <div className="text-white text-xl font-bold">New Project</div>
            <input value={pCode} onChange={e => setPCode(e.target.value.toUpperCase())} placeholder="BERTH-MAINT-2024"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg font-mono focus:outline-none focus:border-sky-400" />
            <input value={pName} onChange={e => setPName(e.target.value)} placeholder="Project name"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-sky-400" />
            <input value={pDesc} onChange={e => setPDesc(e.target.value)} placeholder="Description (optional)"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-sky-400" />
            <div className="flex gap-3">
              <button onClick={createProject} disabled={saving}
                className="flex-1 min-h-[52px] bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 text-white text-xl font-bold rounded-2xl transition-colors">
                {saving ? 'Creating…' : 'Create'}
              </button>
              <button onClick={() => setShowProjectForm(false)}
                className="px-6 bg-slate-700 hover:bg-slate-600 text-white text-lg rounded-2xl transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Project list */}
        <div className="space-y-3">
          {projects.map(p => (
            <div key={p.id} className={`border rounded-2xl overflow-hidden ${p.is_active ? 'border-slate-600' : 'border-slate-700 opacity-60'}`}>
              {/* Project header */}
              <div className="bg-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sky-300 font-mono text-xl font-bold">{p.code}</span>
                    <span className="text-slate-300 text-base ml-3">{p.name}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                      className="text-slate-400 hover:text-white text-base px-2 py-1 transition-colors">
                      {expanded === p.id ? '▲' : `▼ ${p.sub_projects.length}`}
                    </button>
                    <button onClick={() => toggle(p.id, 'project', p.is_active)}
                      className={`px-3 py-1 rounded-lg text-sm transition-colors ${p.is_active ? 'bg-red-900/50 text-red-300 hover:bg-red-800' : 'bg-emerald-900/50 text-emerald-300 hover:bg-emerald-800'}`}>
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
                {p.description && <div className="text-slate-500 text-sm mt-1">{p.description}</div>}
              </div>

              {/* Sub-projects */}
              {expanded === p.id && (
                <div className="bg-slate-900 border-t border-slate-700">
                  {p.sub_projects.map(sp => (
                    <div key={sp.id} className={`px-6 py-3 border-b border-slate-800 flex items-center justify-between ${!sp.is_active ? 'opacity-50' : ''}`}>
                      <div>
                        <span className="text-sky-400 font-mono text-base font-semibold">{sp.code}</span>
                        <span className="text-slate-400 text-base ml-2">{sp.name}</span>
                        {sp.description && <div className="text-slate-600 text-sm">{sp.description}</div>}
                      </div>
                      <button onClick={() => toggle(sp.id, 'sub_project', sp.is_active)}
                        className={`px-2 py-1 rounded-lg text-xs transition-colors ${sp.is_active ? 'bg-red-900/50 text-red-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
                        {sp.is_active ? 'Off' : 'On'}
                      </button>
                    </div>
                  ))}

                  {/* Add sub-project */}
                  {showSubForm === p.id ? (
                    <div className="p-4 space-y-2">
                      <input value={spCode} onChange={e => setSpCode(e.target.value.toUpperCase())} placeholder="PAINT-HULL"
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-400" />
                      <input value={spName} onChange={e => setSpName(e.target.value)} placeholder="Sub-project name"
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-400" />
                      <input value={spDesc} onChange={e => setSpDesc(e.target.value)} placeholder="Description (optional)"
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-400" />
                      <div className="flex gap-2">
                        <button onClick={() => createSubProject(p.id)} disabled={saving}
                          className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 rounded-xl text-base transition-colors">
                          {saving ? '…' : 'Add'}
                        </button>
                        <button onClick={() => { setShowSubForm(null); setSpCode(''); setSpName(''); setSpDesc('') }}
                          className="px-4 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-xl text-base transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setShowSubForm(p.id); setSpCode(''); setSpName('') }}
                      className="w-full py-3 text-slate-500 hover:text-sky-400 text-base transition-colors border-t border-slate-800">
                      + Add Sub-Project
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
