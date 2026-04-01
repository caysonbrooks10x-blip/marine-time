/**
 * POST /api/admin/sheets/init
 * One-time setup — creates the 4 sheets in Google Sheets with headers and formatting.
 * Run this once after configuring the Google service account credentials.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { initializeSheets } from '@/lib/sheets/google-sheets'

export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: admin } = await supabase
    .from('workers')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SHEETS_ID) {
    return NextResponse.json({
      error: 'Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_SHEETS_ID in your .env.local',
    }, { status: 400 })
  }

  try {
    await initializeSheets()
    return NextResponse.json({ ok: true, message: 'Google Sheets initialized with headers and formatting' })
  } catch {
    return NextResponse.json({ error: 'Failed to initialize Google Sheets' }, { status: 500 })
  }
}
