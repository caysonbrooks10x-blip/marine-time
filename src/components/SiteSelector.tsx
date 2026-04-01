'use client'

import { useEffect, useState } from 'react'

interface Site {
  id: string
  name: string
  radius_meters: number
}

interface Props {
  selectedSiteId: string | null
  onSelect: (siteId: string) => void
  disabled?: boolean
}

export default function SiteSelector({ selectedSiteId, onSelect, disabled = false }: Props) {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchSites() {
      try {
        const res = await fetch('/api/sites')
        const json = await res.json()

        if (!res.ok) {
          setError(json.error ?? 'Failed to load sites')
          return
        }

        setSites(json.data ?? [])
      } catch {
        setError('Unable to load sites right now')
      } finally {
        setLoading(false)
      }
    }

    fetchSites()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full" />
        <span className="ml-3 text-slate-300 text-lg">Loading sites…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/40 border border-red-500 rounded-xl p-4 text-red-300 text-lg text-center">
        {error}
      </div>
    )
  }

  if (sites.length === 0) {
    return (
      <div className="bg-amber-900/30 border border-amber-500 rounded-xl p-4 text-amber-300 text-lg text-center">
        No active work sites available. Contact your supervisor.
      </div>
    )
  }

  return (
    <div>
      <div className="text-slate-400 text-lg mb-2">Select work site</div>
      <div className="space-y-3">
        {sites.map(site => {
          const isSelected = site.id === selectedSiteId

          return (
            <button
              key={site.id}
              onClick={() => onSelect(site.id)}
              disabled={disabled}
              className={`w-full min-h-[64px] rounded-2xl p-4 text-left transition-colors ${
                isSelected
                  ? 'bg-sky-900/40 border-2 border-sky-400'
                  : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'
              } ${disabled ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white text-xl font-semibold">{site.name}</div>
                  <div className="text-slate-400 text-base">
                    Geofence radius: {site.radius_meters}m
                  </div>
                </div>
                {isSelected && <div className="text-sky-300 text-lg font-semibold">Selected</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
