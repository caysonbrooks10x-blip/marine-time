import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      id,
      code,
      name,
      description,
      sub_projects (
        id,
        code,
        name,
        description
      )
    `)
    .eq('is_active', true)
    .eq('sub_projects.is_active', true)
    .order('code')

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }

  return NextResponse.json({ data: projects })
}
