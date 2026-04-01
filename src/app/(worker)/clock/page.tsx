'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import ProjectSelector from '@/components/ProjectSelector'
import SiteSelector from '@/components/SiteSelector'
import CameraCapture from '@/components/CameraCapture'
import OfflineBanner from '@/components/OfflineBanner'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { addClockEvent } from '@/lib/offline-queue'

interface ActiveSession {
  id: string
  clock_in_at: string
  clock_in_distance_meters: number | null
  projects: { code: string; name: string } | null
  sub_projects: { code: string; name: string } | null
  site_locations: { name: string } | null
}

interface WorkerSummary {
  id: string
  employee_code: string
  name: string
  role: string
}

type ClockStep = 'select_project' | 'photo' | 'gps_loading' | 'done'

export default function ClockPage() {
  const { isOnline, queueCount, syncing, refreshCount } = useOfflineSync()
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [worker, setWorker] = useState<WorkerSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<ClockStep>('select_project')
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedSubProjectId, setSelectedSubProjectId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [clockingOut, setClockingOut] = useState(false)
  const [clockOutRemarks, setClockOutRemarks] = useState('')

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/active')
      const json = await res.json()
      setActiveSession(json.data ?? null)
      setWorker(json.worker ?? null)
    } catch {
      // Offline — can't fetch
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActive()
  }, [fetchActive])

  function handleProjectSelect(projectId: string, subProjectId: string | null) {
    setError('')
    setSelectedProjectId(projectId)
    setSelectedSubProjectId(subProjectId)
    setStep('photo')
  }

  async function handleClockIn(photoBase64: string | null) {
    if (!worker || !selectedProjectId || !selectedSiteId) {
      setError('Select your work site and project before clocking in.')
      setStep('select_project')
      return
    }

    setStep('gps_loading')
    setError('')

    // Get GPS
    let lat: number, lng: number
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
      })
      lat = pos.coords.latitude
      lng = pos.coords.longitude
    } catch (gpsError) {
      const err = gpsError as GeolocationPositionError
      const messages: Record<number, string> = {
        1: 'Location permission denied. Please allow GPS access and try again.',
        2: 'GPS unavailable. Check your device location settings.',
        3: 'GPS timed out. Move to an open area and try again.',
      }
      setError(messages[err.code] ?? 'GPS error. Try again.')
      setStep('select_project')
      return
    }

    // If offline, queue it
    if (!navigator.onLine) {
      await addClockEvent({
        type: 'in',
        worker_id: worker.id,
        project_id: selectedProjectId,
        sub_project_id: selectedSubProjectId,
        site_id: selectedSiteId,
        lat,
        lng,
        photo_url: null,
        timestamp: new Date().toISOString(),
      })
      setSuccess('Clock-in queued — will sync when online')
      await refreshCount()
      setStep('done')
      return
    }

    // Online — call API
    try {
      const res = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker_id: worker.id,
          project_id: selectedProjectId,
          sub_project_id: selectedSubProjectId,
          site_id: selectedSiteId,
          lat,
          lng,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Clock-in failed')
        setStep('select_project')
        return
      }

      // Upload photo if taken
      if (photoBase64 && json.data?.log_id) {
        await fetch('/api/attendance/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: photoBase64,
            log_id: json.data.log_id,
          }),
        })
      }

      const distance = json.data?.distance_from_site_meters
      setSuccess(
        `Clocked in successfully${distance !== null ? ` — ${distance}m from site` : ''}`
      )
      await fetchActive()
      setStep('done')
    } catch {
      setError('Network error — try again')
      setStep('select_project')
    }
  }

  async function handleClockOut() {
    if (!activeSession) return
    setClockingOut(true)
    setError('')
    const remarks = clockOutRemarks.trim()

    let lat: number, lng: number
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
      })
      lat = pos.coords.latitude
      lng = pos.coords.longitude
    } catch {
      setError('GPS failed — cannot clock out without location. Try again.')
      setClockingOut(false)
      return
    }

    if (!navigator.onLine) {
      await addClockEvent({
        type: 'out',
        worker_id: worker?.id ?? '',
        project_id: selectedProjectId ?? '',
        sub_project_id: null,
        site_id: null,
        lat,
        lng,
        photo_url: null,
        timestamp: new Date().toISOString(),
        log_id: activeSession.id,
        remarks: remarks || undefined,
      })
      setSuccess('Clock-out queued — will sync when online')
      setActiveSession(null)
      setClockOutRemarks('')
      await refreshCount()
      setClockingOut(false)
      return
    }

    try {
      const res = await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_id: activeSession.id,
          lat,
          lng,
          remarks: remarks || undefined,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Clock-out failed')
      } else {
        const mins = json.data?.duration_minutes ?? 0
        const hrs = Math.floor(mins / 60)
        const rem = mins % 60
        setSuccess(`Clocked out — ${hrs}h ${rem}m total`)
        setActiveSession(null)
        setClockOutRemarks('')
        setStep('select_project')
      }
    } catch {
      setError('Network error — try again')
    } finally {
      setClockingOut(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Clocked in — show active session
  if (activeSession) {
    const clockInTime = new Date(activeSession.clock_in_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })

    return (
      <div className="min-h-screen bg-slate-900">
        <OfflineBanner isOnline={isOnline} queueCount={queueCount} syncing={syncing} />
        <div className="p-6 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="text-4xl font-bold text-sky-400">MarineTime</div>
            <Link href="/history" className="text-slate-400 hover:text-sky-400 text-base transition-colors">
              History →
            </Link>
          </div>

          {/* Active session card */}
          <div className="bg-emerald-900/40 border-2 border-emerald-500 rounded-2xl p-6 mb-6">
            <div className="text-emerald-400 text-lg font-semibold mb-1">Currently Clocked In</div>
            <div className="text-white text-3xl font-bold mb-3">Since {clockInTime}</div>
            <div className="text-sky-300 text-xl font-mono">
              {activeSession.projects?.code ?? 'Unknown project'}
            </div>
            {activeSession.sub_projects && (
              <div className="text-slate-300 text-lg">
                → {activeSession.sub_projects.code}: {activeSession.sub_projects.name}
              </div>
            )}
            {activeSession.site_locations && (
              <div className="text-slate-400 text-base mt-2">
                📍 {activeSession.site_locations.name}
                {activeSession.clock_in_distance_meters !== null && (
                  <span> ({activeSession.clock_in_distance_meters}m from site)</span>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-center text-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-emerald-900/50 border border-emerald-500 rounded-xl p-3 text-emerald-300 text-center text-lg">
              {success}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="clock-out-remarks" className="block text-slate-300 text-lg font-medium mb-2">
              Remarks (optional)
            </label>
            <textarea
              id="clock-out-remarks"
              value={clockOutRemarks}
              onChange={(event) => setClockOutRemarks(event.target.value)}
              placeholder="Late arrival reason, overtime note, job details..."
              maxLength={500}
              rows={4}
              className="w-full bg-slate-800 border border-slate-600 rounded-2xl px-4 py-4 text-white text-lg placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
            />
          </div>

          <button
            onClick={handleClockOut}
            disabled={clockingOut}
            className="w-full min-h-[80px] bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-white text-3xl font-bold rounded-2xl transition-colors"
          >
            {clockingOut ? 'Getting GPS…' : 'CLOCK OUT'}
          </button>
        </div>
      </div>
    )
  }

  // Not clocked in — clock-in flow
  return (
    <div className="min-h-screen bg-slate-900">
      <OfflineBanner isOnline={isOnline} queueCount={queueCount} syncing={syncing} />
      <div className="p-6 max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="text-4xl font-bold text-sky-400 mb-1">MarineTime</div>
          <div className="text-slate-400 text-lg">{worker?.name ?? 'Worker'}</div>
        </div>

        {error && (
          <div className="mb-4 bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-center text-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-emerald-900/50 border border-emerald-500 rounded-xl p-3 text-emerald-300 text-center text-lg">
            {success}
          </div>
        )}

        {step === 'select_project' && (
          <div className="space-y-6">
            {!worker && (
              <div className="bg-amber-900/40 border border-amber-500 rounded-xl p-4 text-amber-300 text-center text-lg">
                Unable to load your worker profile. Refresh the page or sign in again.
              </div>
            )}
            <SiteSelector
              selectedSiteId={selectedSiteId}
              onSelect={(siteId) => {
                setSelectedSiteId(siteId)
                setError('')
              }}
            />
            <ProjectSelector onSelect={handleProjectSelect} disabled={!selectedSiteId || !worker} />
          </div>
        )}

        {step === 'photo' && (
          <div className="space-y-4">
            <CameraCapture
              onCapture={(base64) => handleClockIn(base64)}
              onSkip={() => handleClockIn(null)}
            />
          </div>
        )}

        {step === 'gps_loading' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin w-16 h-16 border-4 border-sky-400 border-t-transparent rounded-full mb-4" />
            <div className="text-white text-2xl font-semibold">Getting your location…</div>
            <div className="text-slate-400 text-lg mt-2">
              Make sure GPS is enabled on your device
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-8">
            <div className="text-emerald-400 text-6xl mb-4">✓</div>
            <div className="text-white text-2xl font-bold mb-6">{success}</div>
            <button
              onClick={() => {
                setStep('select_project')
                setSuccess('')
                fetchActive()
              }}
              className="w-full min-h-[56px] bg-slate-700 hover:bg-slate-600 text-white text-xl rounded-2xl"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
