/**
 * GET /api/admin/export/excel
 * Returns a signed download URL for the live Excel file stored in Supabase Storage.
 * The file is regenerated automatically on every clock event via the webhook.
 *
 * POST /api/admin/export/excel
 * Manually triggers a full Excel regeneration (useful after bulk imports or first run).
 */

import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { regenerateExcel } from '@/lib/sheets/excel-export'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: admin } = await supabase
    .from('workers')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  return admin?.role === 'admin' ? admin : null
}

// GET — return signed URL for current live Excel file
export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = await createAdminClient()
  const { data, error } = await adminClient.storage
    .from('payroll-exports')
    .createSignedUrl('live-attendance.xlsx', 300) // 5 min expiry

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: 'Excel file not yet generated. Trigger a manual regeneration first.' },
      { status: 404 }
    )
  }

  return NextResponse.json({ url: data.signedUrl })
}

// POST — manually regenerate the Excel file
export async function POST() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const adminClient = await createAdminClient()
    await regenerateExcel(adminClient)
    return NextResponse.json({ ok: true, message: 'Excel file regenerated' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Excel regeneration failed:', message)
    return NextResponse.json({ error: `Failed to regenerate Excel file: ${message}` }, { status: 500 })
  }
}
