'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.replace('/admin/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <div className="text-4xl font-bold text-sky-400 mb-1">MarineTime</div>
        <div className="text-slate-400 text-lg">Admin Sign In</div>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div>
          <label className="block text-slate-300 text-lg font-medium mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-4 text-white text-xl focus:outline-none focus:border-sky-400"
          />
        </div>

        <div>
          <label className="block text-slate-300 text-lg font-medium mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-4 text-white text-xl focus:outline-none focus:border-sky-400"
          />
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-300 text-center text-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[64px] bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 text-white text-2xl font-bold rounded-2xl transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
