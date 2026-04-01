'use client'

import { useEffect, useState } from 'react'

interface Site {
  id: string
  name: string
  lat: number
  lng: number
  radius_meters: number
  is_active: boolean
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formLat, setFormLat] = useState('')
  const [formLng, setFormLng] = useState('')
  const [formRadius, setFormRadius] = useState('100')

  async function fetchSites() {
    try {
      const res = await fetch('/api/admin/sites')
      const json = await res.json()
      if (json.data) setSites(json.data)
    } catch {
      // offline
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSites() }, [])

  function resetForm() {
    setFormName('')
    setFormLat('')
    setFormLng('')
    setFormRadius('100')
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(s: Site) {
    setEditingId(s.id)
    setFormName(s.name)
    setFormLat(String(s.lat))
    setFormLng(String(s.lng))
    setFormRadius(String(s.radius_meters))
    setShowForm(true)
  }

  async function handleSave() {
    const lat = parseFloat(formLat)
    const lng = parseFloat(formLng)
    const radius = parseInt(formRadius, 10)

    if (!formName || isNaN(lat) || isNaN(lng) || isNaN(radius) || radius < 1) {
      setError('Please fill all fields with valid values')
      return
    }

    setSaving(true)
    setError('')
    setFeedback('')

    try {
      if (editingId) {
        const res = await fetch('/api/admin/sites', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, name: formName, lat, lng, radius_meters: radius }),
        })
        const json = await res.json()

        if (!res.ok) {
          setError(json.error ?? 'Update failed')
          setSaving(false)
          return
        }
        setFeedback('Site updated')
      } else {
        const res = await fetch('/api/admin/sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, lat, lng, radius_meters: radius }),
        })
        const json = await res.json()

        if (!res.ok) {
          setError(json.error ?? 'Creation failed')
          setSaving(false)
          return
        }
        setFeedback('Site created')
      }

      resetForm()
      await fetchSites()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(s: Site) {
    try {
      const res = await fetch('/api/admin/sites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, is_active: !s.is_active }),
      })
      if (res.ok) {
        setSites(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !x.is_active } : x))
        setFeedback(`Site ${s.is_active ? 'deactivated' : 'activated'}`)
      }
    } catch {
      setError('Network error')
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFormLat(pos.coords.latitude.toFixed(7))
        setFormLng(pos.coords.longitude.toFixed(7))
      },
      () => setError('Could not get location'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
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
            <div className="text-3xl font-bold text-sky-400">Site Locations</div>
            <div className="text-slate-400 text-lg">{sites.length} sites</div>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-lg font-semibold transition-colors"
          >
            + Add Site
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
              {editingId ? 'Edit Site' : 'New Site'}
            </div>

            <div>
              <label className="block text-slate-300 text-base mb-1">Site Name</label>
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Main Berth Area"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-sky-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 text-base mb-1">Latitude</label>
                <input
                  type="text"
                  value={formLat}
                  onChange={e => setFormLat(e.target.value)}
                  placeholder="1.3521000"
                  inputMode="decimal"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-base mb-1">Longitude</label>
                <input
                  type="text"
                  value={formLng}
                  onChange={e => setFormLng(e.target.value)}
                  placeholder="103.8198000"
                  inputMode="decimal"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={useCurrentLocation}
              className="w-full bg-slate-700 hover:bg-slate-600 text-sky-300 py-2 rounded-xl text-base transition-colors"
            >
              Use Current Location
            </button>

            <div>
              <label className="block text-slate-300 text-base mb-1">Geofence Radius (meters)</label>
              <input
                type="number"
                value={formRadius}
                onChange={e => setFormRadius(e.target.value)}
                min={1}
                max={5000}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-sky-400"
              />
            </div>

            {/* Map preview link */}
            {formLat && formLng && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${formLat}&mlon=${formLng}#map=17/${formLat}/${formLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sky-400 text-base underline text-center"
              >
                Preview on OpenStreetMap
              </a>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || !formName || !formLat || !formLng}
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

        {/* Site list */}
        <div className="space-y-3">
          {sites.map(s => (
            <div
              key={s.id}
              className={`border rounded-2xl p-4 ${s.is_active ? 'border-slate-600 bg-slate-800' : 'border-slate-700 bg-slate-800/50 opacity-60'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white text-xl font-bold">{s.name}</span>
                <span className={`px-2 py-1 rounded-full text-sm font-semibold ${
                  s.is_active ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-white'
                }`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="text-slate-400 text-base mb-1 font-mono">
                {Number(s.lat).toFixed(7)}, {Number(s.lng).toFixed(7)}
              </div>
              <div className="text-slate-400 text-base mb-3">
                Geofence: {s.radius_meters}m radius
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(s)}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-lg text-base transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(s)}
                  className={`px-3 py-1 rounded-lg text-base transition-colors ${
                    s.is_active
                      ? 'bg-red-900/50 hover:bg-red-800 text-red-300'
                      : 'bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300'
                  }`}
                >
                  {s.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=17/${s.lat}/${s.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-slate-700 hover:bg-slate-600 text-sky-300 px-3 py-1 rounded-lg text-base transition-colors"
                >
                  Map
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
