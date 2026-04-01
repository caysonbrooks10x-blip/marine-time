'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function WorkerLoginPage() {
  const router = useRouter()
  const [employeeCode, setEmployeeCode] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleDigit(d: string) {
    if (pin.length < 6) setPin(p => p + d)
  }

  function handleBackspace() {
    setPin(p => p.slice(0, -1))
  }

  async function handleSubmit() {
    if (!employeeCode.trim()) { setError('Enter your employee code'); return }
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_code: employeeCode.trim(), pin }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Login failed')
        setPin('')
      } else {
        router.replace('/clock')
      }
    } catch {
      setError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="text-4xl font-bold text-sky-400 mb-1">MarineTime</div>
        <div className="text-slate-400 text-lg">Worker Sign In</div>
      </div>

      <div className="w-full max-w-sm">
        {/* Employee Code */}
        <div className="mb-6">
          <label className="block text-slate-300 text-lg font-medium mb-2">
            Employee Code
          </label>
          <input
            type="text"
            value={employeeCode}
            onChange={e => setEmployeeCode(e.target.value.toUpperCase())}
            placeholder="e.g. W001"
            autoComplete="off"
            autoCapitalize="characters"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-4 text-white text-2xl font-mono text-center tracking-widest focus:outline-none focus:border-sky-400"
          />
        </div>

        {/* PIN display */}
        <div className="mb-6">
          <label className="block text-slate-300 text-lg font-medium mb-2">PIN</label>
          <div className="flex gap-3 justify-center">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${
                  i < pin.length
                    ? 'bg-sky-500 border-sky-400'
                    : 'bg-slate-800 border-slate-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-center text-lg">
            {error}
          </div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {digits.map((d, i) => {
            if (d === '') return <div key={i} />
            const isBack = d === '⌫'
            return (
              <button
                key={i}
                onClick={() => isBack ? handleBackspace() : handleDigit(d)}
                disabled={loading}
                className={`min-h-[72px] rounded-2xl text-2xl font-bold transition-colors active:scale-95 ${
                  isBack
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
              >
                {d}
              </button>
            )
          })}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || pin.length < 4}
          className="w-full min-h-[64px] bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white text-2xl font-bold rounded-2xl transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        {/* Supervisor link */}
        <div className="mt-6 text-center">
          <a href="/supervisor/login" className="text-slate-500 text-base underline">
            Supervisor / Admin login
          </a>
        </div>
      </div>
    </div>
  )
}
