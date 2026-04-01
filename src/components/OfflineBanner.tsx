'use client'

interface Props {
  isOnline: boolean
  queueCount: number
  syncing: boolean
}

export default function OfflineBanner({ isOnline, queueCount, syncing }: Props) {
  if (isOnline && queueCount === 0) return null

  if (!isOnline) {
    return (
      <div className="bg-amber-600 text-white px-4 py-3 text-center text-lg font-semibold">
        You are offline — records will sync when connection restores
        {queueCount > 0 && (
          <div className="text-amber-100 text-base font-normal mt-1">
            {queueCount} record{queueCount > 1 ? 's' : ''} pending sync
          </div>
        )}
      </div>
    )
  }

  // Online but queue is draining
  if (syncing) {
    return (
      <div className="bg-sky-600 text-white px-4 py-3 text-center text-lg">
        <span className="inline-block animate-spin mr-2">↻</span>
        Syncing {queueCount} record{queueCount > 1 ? 's' : ''}…
      </div>
    )
  }

  // Online but queue still has items (failed sync)
  if (queueCount > 0) {
    return (
      <div className="bg-amber-700 text-white px-4 py-3 text-center text-lg">
        {queueCount} record{queueCount > 1 ? 's' : ''} pending sync — will retry automatically
      </div>
    )
  }

  return null
}
