import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import {
  getCompanyTimesheetStoragePath,
  getCurrentCompanyYearMonth,
} from '@/lib/company-timesheet/rules'
import { regenerateCompanyTimesheetWorkbook } from '@/lib/company-timesheet/excel-export'

const bodySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

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

function parseMonth(month: string | null | undefined) {
  if (!month) {
    return getCurrentCompanyYearMonth()
  }

  const [year, monthNumber] = month.split('-').map(Number)
  return { year, month: monthNumber }
}

async function createSignedUrl(adminClient: Awaited<ReturnType<typeof createAdminClient>>, year: number, month: number) {
  const storagePath = getCompanyTimesheetStoragePath(year, month)
  const { data, error } = await adminClient.storage
    .from('payroll-exports')
    .createSignedUrl(storagePath, 300)

  if (error || !data?.signedUrl) {
    return null
  }

  return { storagePath, url: data.signedUrl }
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const { year, month } = parseMonth(searchParams.get('month'))
  const adminClient = await createAdminClient()
  const signedUrl = await createSignedUrl(adminClient, year, month)

  if (!signedUrl) {
    return NextResponse.json(
      { error: 'Company timesheet not yet generated for this month. Regenerate it first.' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    url: signedUrl.url,
    storage_path: signedUrl.storagePath,
  })
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { year, month } = parseMonth(parsed.data.month)

  try {
    const adminClient = await createAdminClient()
    const result = await regenerateCompanyTimesheetWorkbook(adminClient, { year, month })
    const signedUrl = await createSignedUrl(adminClient, year, month)

    return NextResponse.json({
      ok: true,
      message: `Company workbook regenerated for ${result.monthLabel}`,
      storage_path: result.storagePath,
      record_count: result.recordCount,
      url: signedUrl?.url ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Company timesheet regeneration failed:', message)
    return NextResponse.json(
      { error: `Failed to regenerate company timesheet: ${message}` },
      { status: 500 }
    )
  }
}
