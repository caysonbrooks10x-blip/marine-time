/**
 * Offline clock-event queue backed by IndexedDB.
 * Import idb dynamically to avoid SSR errors.
 */

export interface ClockEvent {
  localId: string
  type: 'in' | 'out'
  worker_id: string
  project_id: string
  sub_project_id: string | null
  site_id: string | null
  lat: number
  lng: number
  photo_url: null // never store photos offline — upload only when online
  timestamp: string // ISO string
  log_id?: string // required for clock-out
  remarks?: string // optional remarks for clock-out
}

const DB_NAME = 'marinetime-queue'
const DB_VERSION = 1
const STORE_NAME = 'clockQueue'

async function getDB() {
  const { openDB } = await import('idb')
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'localId' })
      }
    },
  })
}

export async function addClockEvent(event: Omit<ClockEvent, 'localId'>): Promise<string> {
  const db = await getDB()
  const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const record: ClockEvent = { ...event, localId }
  await db.put(STORE_NAME, record)
  return localId
}

export async function getQueue(): Promise<ClockEvent[]> {
  const db = await getDB()
  return db.getAll(STORE_NAME)
}

export async function removeFromQueue(localId: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, localId)
}

export async function getQueueCount(): Promise<number> {
  const db = await getDB()
  return db.count(STORE_NAME)
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const queue = await getQueue()
  let synced = 0
  let failed = 0

  for (const event of queue) {
    try {
      const endpoint =
        event.type === 'in'
          ? '/api/attendance/clock-in'
          : '/api/attendance/clock-out'

      const body =
        event.type === 'in'
          ? {
              worker_id: event.worker_id,
              project_id: event.project_id,
              sub_project_id: event.sub_project_id,
              site_id: event.site_id,
              lat: event.lat,
              lng: event.lng,
              photo_url: null,
              offline_queued: true,
              timestamp: event.timestamp,
            }
          : {
              log_id: event.log_id,
              lat: event.lat,
              lng: event.lng,
              offline_queued: true,
              timestamp: event.timestamp,
              remarks: event.remarks,
            }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        await removeFromQueue(event.localId)
        synced++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return { synced, failed }
}
