/**
 * Application-layer webhook trigger.
 *
 * Calls the clock-event webhook after database changes.
 * This provides the same functionality as pg_net but from the application layer.
 *
 * Why this approach:
 * - pg_net extension is not available on all Supabase tiers
 * - Database webhooks require manual Supabase Dashboard setup
 * - This works with any Supabase tier that supports API routes
 */

const WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/clock-event`
  : 'https://marine-time-two.vercel.app/api/webhooks/clock-event'

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

export interface WebhookPayload {
  table: string
  operation: 'INSERT' | 'UPDATE'
  record: Record<string, unknown>
  old_record?: Record<string, unknown>
  timestamp: string
}

/**
 * Trigger webhook for attendance log changes.
 * Runs fire-and-forget to not block the API response.
 *
 * @param operation - 'INSERT' or 'UPDATE'
 * @param record - The new attendance log record
 * @param oldRecord - The previous record (for UPDATE operations)
 */
export async function triggerAttendanceWebhook(
  operation: 'INSERT' | 'UPDATE',
  record: Record<string, unknown>,
  oldRecord?: Record<string, unknown>
): Promise<void> {
  if (!WEBHOOK_SECRET) {
    console.warn('[webhook] WEBHOOK_SECRET not set, skipping webhook trigger')
    return
  }

  const payload: WebhookPayload = {
    table: 'attendance_logs',
    operation,
    record,
    old_record: oldRecord,
    timestamp: new Date().toISOString(),
  }

  // Fire-and-forget: don't await to avoid blocking API response
  fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  }).catch(err => {
    // Log but don't throw - webhook failure shouldn't fail the main operation
    console.error('[webhook] Failed to trigger:', err.message)
  })
}
