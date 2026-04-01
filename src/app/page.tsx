import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12">
        <div className="text-5xl font-bold text-sky-400 mb-2">MarineTime</div>
        <div className="text-slate-400 text-xl">GPS-verified field attendance</div>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <Link
          href="/worker/login"
          className="block w-full min-h-[72px] bg-sky-500 hover:bg-sky-400 text-white text-2xl font-bold rounded-2xl transition-colors text-center leading-[72px]"
        >
          Worker Login
        </Link>
        <Link
          href="/supervisor/login"
          className="block w-full min-h-[64px] bg-slate-700 hover:bg-slate-600 text-white text-xl font-semibold rounded-2xl transition-colors text-center leading-[64px]"
        >
          Supervisor Login
        </Link>
        <Link
          href="/admin/login"
          className="block w-full min-h-[64px] bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-xl rounded-2xl transition-colors text-center leading-[64px]"
        >
          Admin Login
        </Link>
        <Link
          href="/kiosk"
          className="block w-full min-h-[64px] bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sky-400 text-xl rounded-2xl transition-colors text-center leading-[64px]"
        >
          Shared Tablet (Kiosk)
        </Link>
      </div>
    </div>
  )
}
