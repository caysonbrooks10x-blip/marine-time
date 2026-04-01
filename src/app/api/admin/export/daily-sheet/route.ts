import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateDailySheet } from '@/lib/company-timesheet/daily-sheet-export'

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * GET /api/admin/export/daily-sheet?date=YYYY-MM-DD
 *
 * Returns the daily sheet Excel file matching the paper "Safe Work Declaration Form".
 * Accessible by supervisors and admins.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: caller } = await supabase
    .from('workers')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!caller || (caller.role !== 'supervisor' && caller.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const dateParam = request.nextUrl.searchParams.get('date')
  const parsed = querySchema.safeParse({ date: dateParam })
  if (!parsed.success) {
    return NextResponse.json({ error: 'date query param required (YYYY-MM-DD)' }, { status: 400 })
  }

  const adminClient = await createAdminClient()
  const { buffer, fileName } = await generateDailySheet(adminClient, parsed.data.date)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
