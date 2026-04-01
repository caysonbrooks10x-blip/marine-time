import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: sites, error } = await supabase
    .from('site_locations')
    .select('id, name, radius_meters')
    .eq('is_active', true)
    .order('name')

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 })
  }

  return NextResponse.json({ data: sites })
}
