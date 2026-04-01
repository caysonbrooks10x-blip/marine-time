'use client'

import { useEffect, useState } from 'react'

interface SubProject {
  id: string
  code: string
  name: string
}

interface Project {
  id: string
  code: string
  name: string
  description: string | null
  sub_projects: SubProject[]
}

interface Props {
  onSelect: (projectId: string, subProjectId: string | null) => void
  disabled?: boolean
}

export default function ProjectSelector({ onSelect, disabled }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedSubProject, setSelectedSubProject] = useState<SubProject | null>(null)

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects')
        const json = await res.json()
        if (json.data) setProjects(json.data)
      } catch {
        // Offline — projects won't load
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [])

  function handleProjectSelect(project: Project) {
    setSelectedProject(project)
    setSelectedSubProject(null)
    // If no sub-projects, select project immediately
    if (!project.sub_projects || project.sub_projects.length === 0) {
      onSelect(project.id, null)
    }
  }

  function handleSubProjectSelect(sub: SubProject) {
    setSelectedSubProject(sub)
    if (selectedProject) {
      onSelect(selectedProject.id, sub.id)
    }
  }

  function handleBack() {
    setSelectedProject(null)
    setSelectedSubProject(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full" />
        <span className="ml-3 text-slate-300 text-lg">Loading projects…</span>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="bg-amber-900/30 border border-amber-500 rounded-xl p-4 text-amber-300 text-lg text-center">
        No active projects available. Contact your supervisor.
      </div>
    )
  }

  // Show sub-project selection
  if (selectedProject && selectedProject.sub_projects?.length > 0 && !selectedSubProject) {
    return (
      <div>
        <button
          onClick={handleBack}
          className="mb-3 text-sky-400 text-lg flex items-center gap-2"
        >
          ← Back to projects
        </button>
        <div className="text-slate-400 text-lg mb-2">
          Task for <span className="text-white font-semibold">{selectedProject.code}</span>
        </div>
        <div className="space-y-3">
          {selectedProject.sub_projects.map(sub => (
            <button
              key={sub.id}
              onClick={() => handleSubProjectSelect(sub)}
              disabled={disabled}
              className="w-full min-h-[64px] bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-2xl p-4 text-left transition-colors"
            >
              <div className="text-sky-300 text-xl font-mono font-bold">{sub.code}</div>
              <div className="text-slate-300 text-lg">{sub.name}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Show selected state
  if (selectedProject && selectedSubProject) {
    return (
      <div className="bg-slate-800 border border-sky-500 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sky-300 text-xl font-mono font-bold">{selectedProject.code}</div>
            <div className="text-emerald-400 text-lg">→ {selectedSubProject.code}: {selectedSubProject.name}</div>
          </div>
          <button
            onClick={handleBack}
            disabled={disabled}
            className="text-slate-400 hover:text-white text-lg px-3 py-2"
          >
            Change
          </button>
        </div>
      </div>
    )
  }

  if (selectedProject && (!selectedProject.sub_projects || selectedProject.sub_projects.length === 0)) {
    return (
      <div className="bg-slate-800 border border-sky-500 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sky-300 text-xl font-mono font-bold">{selectedProject.code}</div>
            <div className="text-slate-300 text-lg">{selectedProject.name}</div>
          </div>
          <button
            onClick={handleBack}
            disabled={disabled}
            className="text-slate-400 hover:text-white text-lg px-3 py-2"
          >
            Change
          </button>
        </div>
      </div>
    )
  }

  // Show project list
  return (
    <div>
      <div className="text-slate-400 text-lg mb-2">Select project</div>
      {disabled && (
        <div className="mb-3 bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-400 text-base text-center">
          Select your work site first.
        </div>
      )}
      <div className="space-y-3">
        {projects.map(project => (
          <button
            key={project.id}
            onClick={() => handleProjectSelect(project)}
            disabled={disabled}
            className="w-full min-h-[64px] bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-2xl p-4 text-left transition-colors"
          >
            <div className="text-sky-300 text-xl font-mono font-bold">{project.code}</div>
            <div className="text-slate-300 text-lg">{project.name}</div>
            {project.sub_projects?.length > 0 && (
              <div className="text-slate-500 text-base mt-1">
                {project.sub_projects.length} tasks →
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
