'use client'

import { useEffect, useState, useCallback } from 'react'
import ProjectSelector from '@/components/ProjectSelector'
import SiteSelector from '@/components/SiteSelector'
import { addClockEvent } from '@/lib/offline-queue'

interface Worker {
  id: string
  employee_code: string
  name: string
  role: string
}

interface ActiveSession {
  id: string
  clock_in_at: string
  projects: { code: string; name: string } | null
  sub_projects: { code: string; name: string } | null
}

type KioskStep = 'select_worker' | 'enter_pin' | 'select_project' | 'gps_loading' | 'clocked_in' | 'done'

export default function KioskPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<KioskStep>('select_worker')

  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [clockingOut, setClockingOut] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const wRes = await fetch('/api/kiosk/workers')
        const wJson = await wRes.json()
        if (wJson.data) setWorkers(wJson.data)
      } catch {
        // offline
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function reset() {
    setStep('select_worker')
    setSelectedWorker(null)
    setActiveSession(null)
    setPin('')
    setPinError('')
    setSelectedSiteId(null)
    setError('')
    setSuccess('')
  }

  async function handleWorkerSelect(worker: Worker) {
    setSelectedWorker(worker)
    setPin('')
    setPinError('')
    setStep('enter_pin')
  }

  function handlePinPress(digit: string) {
    if (pin.length < 4) setPin(p => p + digit)
  }

  function handlePinDelete() {
    setPin(p => p.slice(0, -1))
  }

  const verifyPin = useCallback(async (enteredPin: string) => {
    if (!selectedWorker) return
    setPinLoading(true)
    setPinError('')

    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_code: selectedWorker.employee_code,
          pin: enteredPin,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setPinError(json.error ?? 'Incorrect PIN — try again')
        setPin('')
        setPinLoading(false)
        return
      }

      // Check for active session
      const activeRes = await fetch('/api/attendance/active')
      const activeJson = await activeRes.json()

      if (activeJson.data) {
        setActiveSession(activeJson.data)
        setStep('clocked_in')
      } else {
        setStep('select_project')
      }
    } catch {
      setPinError('Network error — try again')
      setPin('')
    } finally {
      setPinLoading(false)
    }
  }, [selectedWorker])

  useEffect(() => {
    if (pin.length === 4 && !pinLoading) {
      verifyPin(pin)
    }
  }, [pin, pinLoading, verifyPin])

  async function getGPS(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  }

  async function handleClockIn(projectId: string, subProjectId: string | null) {
    if (!selectedWorker || !selectedSiteId) {
      setError('Select a work site before clocking in.')
      setStep('select_project')
      return
    }

    setStep('gps_loading')
    setError('')

    const gps = await getGPS()
    if (!gps) {
      setError('GPS failed — cannot clock in. Move to an open area and try again.')
      setStep('select_project')
      return
    }

    if (!navigator.onLine) {
      await addClockEvent({
        type: 'in',
        worker_id: selectedWorker.id,
        project_id: projectId,
        sub_project_id: subProjectId,
        site_id: selectedSiteId,
        lat: gps.lat,
        lng: gps.lng,
        photo_url: null,
        timestamp: new Date().toISOString(),
      })
      setSuccess('Clock-in queued — will sync when online')
      setStep('done')
      return
    }

    try {
      const res = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worker_id: selectedWorker.id,
          project_id: projectId,
          sub_project_id: subProjectId,
          site_id: selectedSiteId,
          lat: gps.lat,
          lng: gps.lng,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Clock-in failed')
        setStep('select_project')
        return
      }

      const dist = json.data?.distance_from_site_meters
      setSuccess(`${selectedWorker?.name} clocked in${dist != null ? ` — ${dist}m from site` : ''}`)
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

    const gps = await getGPS()
    if (!gps) {
      setError('GPS failed — cannot clock out. Try again.')
      setClockingOut(false)
      return
    }

    if (!navigator.onLine) {
      await addClockEvent({
        type: 'out',
        worker_id: selectedWorker?.id ?? '',
        project_id: '',
        sub_project_id: null,
        site_id: null,
        lat: gps.lat,
        lng: gps.lng,
        photo_url: null,
        timestamp: new Date().toISOString(),
        log_id: activeSession.id,
      })
      setSuccess(`${selectedWorker?.name} clock-out queued`)
      setStep('done')
      setClockingOut(false)
      return
    }

    try {
      const res = await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: activeSession.id, lat: gps.lat, lng: gps.lng }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Clock-out failed')
      } else {
        const mins = json.data?.duration_minutes ?? 0
        const hrs = Math.floor(mins / 60)
        const rem = mins % 60
        setSuccess(`${selectedWorker?.name} clocked out — ${hrs}h ${rem}m`)
        setStep('done')
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

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-6 max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-sky-400 mb-1">MarineTime</div>
          <div className="text-slate-400 text-xl">Kiosk Mode</div>
        </div>

        {/* Select worker */}
        {step === 'select_worker' && (
          <div className="space-y-3">
            <div className="text-white text-xl font-semibold mb-4 text-center">Who are you?</div>
            {workers.map(w => (
              <button
                key={w.id}
                onClick={() => handleWorkerSelect(w)}
                className="w-full min-h-[72px] bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl px-5 flex items-center justify-between transition-colors"
              >
                <span className="text-white text-xl font-bold">{w.name}</span>
                <span className="text-slate-400 font-mono text-lg">{w.employee_code}</span>
              </button>
            ))}
          </div>
        )}

        {/* Enter PIN */}
        {step === 'enter_pin' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-white text-2xl font-bold">{selectedWorker?.name}</div>
              <div className="text-slate-400 text-lg mt-1">Enter your PIN</div>
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-4 my-4">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-5 h-5 rounded-full transition-colors ${
                    i < pin.length ? 'bg-sky-400' : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <div className="bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-center text-lg">
                {pinError}
              </div>
            )}

            {pinLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => (
                  <button
                    key={idx}
                    onClick={() => key === '⌫' ? handlePinDelete() : key ? handlePinPress(key) : undefined}
                    disabled={!key && key !== '0'}
                    className={`min-h-[72px] rounded-2xl text-3xl font-bold transition-colors ${
                      key === '⌫'
                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                        : key
                        ? 'bg-slate-700 hover:bg-slate-600 text-white'
                        : 'invisible'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            )}

            <button onClick={reset} className="w-full text-slate-500 hover:text-slate-300 text-lg py-2 transition-colors">
              ← Back
            </button>
          </div>
        )}

        {/* Select project */}
        {step === 'select_project' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-white text-2xl font-bold">{selectedWorker?.name}</div>
              <div className="text-slate-400 text-lg mt-1">Select site and project</div>
            </div>
            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-center text-lg mb-3">
                {error}
              </div>
            )}
            <SiteSelector
              selectedSiteId={selectedSiteId}
              onSelect={(siteId) => {
                setSelectedSiteId(siteId)
                setError('')
              }}
            />
            <ProjectSelector
              onSelect={(projectId, subProjectId) => {
                void handleClockIn(projectId, subProjectId)
              }}
              disabled={!selectedSiteId}
            />
            <button
              onClick={reset}
              className="w-full text-slate-500 hover:text-slate-300 text-lg py-2 transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* GPS loading */}
        {step === 'gps_loading' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin w-16 h-16 border-4 border-sky-400 border-t-transparent rounded-full mb-4" />
            <div className="text-white text-2xl font-semibold">Getting location…</div>
          </div>
        )}

        {/* Clocked in — show clock out */}
        {step === 'clocked_in' && activeSession && (
          <div className="space-y-6">
            <div className="bg-emerald-900/40 border-2 border-emerald-500 rounded-2xl p-6">
              <div className="text-emerald-400 text-lg font-semibold">Currently Clocked In</div>
              <div className="text-white text-2xl font-bold">{selectedWorker?.name}</div>
              <div className="text-sky-300 text-xl font-mono mt-2">
                {activeSession.projects?.code ?? '—'}
                {activeSession.sub_projects && ` → ${activeSession.sub_projects.code}`}
              </div>
              <div className="text-slate-400 text-base mt-1">
                Since {new Date(activeSession.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-center text-lg">
                {error}
              </div>
            )}

            <button
              onClick={handleClockOut}
              disabled={clockingOut}
              className="w-full min-h-[80px] bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-white text-3xl font-bold rounded-2xl transition-colors"
            >
              {clockingOut ? 'Getting GPS…' : 'CLOCK OUT'}
            </button>

            <button onClick={reset} className="w-full text-slate-500 hover:text-slate-300 text-lg py-2 transition-colors">
              ← Back
            </button>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="text-center py-8">
            <div className="text-emerald-400 text-7xl mb-4">✓</div>
            <div className="text-white text-2xl font-bold mb-8">{success}</div>
            <button
              onClick={reset}
              className="w-full min-h-[64px] bg-sky-500 hover:bg-sky-400 text-white text-2xl font-bold rounded-2xl transition-colors"
            >
              Done — Next Worker
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
