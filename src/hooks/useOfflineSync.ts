'use client'

import { useEffect, useState } from 'react'
import { syncQueue, getQueueCount } from '@/lib/offline-queue'

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [queueCount, setQueueCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  async function refreshCount() {
    try {
      const count = await getQueueCount()
      setQueueCount(count)
    } catch {
      // IndexedDB not available (SSR guard)
    }
  }

  async function sync() {
    if (syncing) return
    setSyncing(true)
    try {
      await syncQueue()
      await refreshCount()
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    // Initial state
    setIsOnline(navigator.onLine)
    refreshCount()

    // Sync any leftover queue on mount if online
    if (navigator.onLine) {
      sync()
    }

    function handleOnline() {
      setIsOnline(true)
      sync()
    }

    function handleOffline() {
      setIsOnline(false)
      refreshCount()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { isOnline, queueCount, syncing, refreshCount }
}
