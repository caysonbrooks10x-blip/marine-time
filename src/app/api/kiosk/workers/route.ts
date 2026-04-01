import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET — returns active workers for kiosk worker picker (no auth required — kiosk is public)
// Worker list is not sensitive; PIN is still required to perform any action
export async function GET() {
  const adminClient = await createAdminClient()

  const { data, error } = await adminClient
    .from('workers')
    .select('id, employee_code, name, role')
    .eq('is_active', true)
    .eq('role', 'worker')
    .order('name')

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
