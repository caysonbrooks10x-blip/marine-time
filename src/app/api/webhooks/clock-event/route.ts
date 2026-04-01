/**
 * Supabase Database Webhook receiver — fires on INSERT/UPDATE to attendance_logs.
 *
 * Set up in Supabase Dashboard → Database → Webhooks:
 *   Table: attendance_logs
 *   Events: INSERT, UPDATE
 *   URL: https://your-domain.com/api/webhooks/clock-event
 *   HTTP Method: POST
 *   Headers: { "x-webhook-secret": "<WEBHOOK_SECRET>" }
 *
 * This handler:
 *   1. Appends a row to Google Sheets (if configured)
 *   2. Regenerates the live Excel file in Supabase Storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { syncToGoogleSheets } from '@/lib/sheets/google-sheets'
import { regenerateExcel } from '@/lib/sheets/excel-export'
import type { AttendanceLogRow } from '@/lib/sheets/structure'
import { regenerateCompanyTimesheetWorkbook } from '@/lib/company-timesheet/excel-export'
import { calculateCompanyTimesheetBreakdown, getYearMonthFromWorkDate } from '@/lib/company-timesheet/rules'

export async function POST(request: NextRequest) {
  // Verify webhook secret (timing-safe comparison)
  const secret = request.headers.get('x-webhook-secret')
  const expected = process.env.WEBHOOK_SECRET
  if (!expected || !secret || expected.length !== secret.length ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let payload: {
    type: string
    table: string
    record: Record<string, unknown>
    old_record?: Record<string, unknown>
  }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload.table !== 'attendance_logs') {
    return NextResponse.json({ ok: true })
  }

  const logId = payload.record?.id as string | undefined
  if (!logId) {
    return NextResponse.json({ ok: true })
  }

  // Fetch full record with joins
  const adminClient = await createAdminClient()
  const { data: log } = await adminClient
    .from('attendance_logs')
    .select(`
      id, clock_in_at, clock_out_at, clock_in_distance_meters,
      status, offline_queued,
      workers ( employee_code, name, role ),
      projects ( code, name ),
      sub_projects ( code, name ),
      site_locations ( name )
    `)
    .eq('id', logId)
    .single()

  if (!log) {
    return NextResponse.json({ ok: true })
  }

  const companyBreakdown = calculateCompanyTimesheetBreakdown(log.clock_in_at, log.clock_out_at)
  const { year, month } = getYearMonthFromWorkDate(companyBreakdown.workDate)

  // Run sync operations in parallel (don't fail the webhook if one fails)
  const results = await Promise.allSettled([
    syncToGoogleSheets(log as AttendanceLogRow),
    regenerateExcel(adminClient),
    regenerateCompanyTimesheetWorkbook(adminClient, { year, month }),
  ])

  const errors = results
    .filter(r => r.status === 'rejected')
    .map(r => (r as PromiseRejectedResult).reason?.message)

  return NextResponse.json({
    ok: true,
    synced: results.filter(r => r.status === 'fulfilled').length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
