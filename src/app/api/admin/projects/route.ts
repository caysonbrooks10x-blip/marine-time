import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const createProjectSchema = z.object({
  code: z.string().min(1).max(30).toUpperCase(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

const createSubProjectSchema = z.object({
  project_id: z.string().uuid(),
  code: z.string().min(1).max(30).toUpperCase(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['project', 'sub_project']),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
})

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: admin } = await supabase
    .from('workers').select('id, role').eq('auth_user_id', user.id).single()
  return admin?.role === 'admin' ? admin : null
}

// GET — all projects with sub-projects
export async function GET() {
  const supabase = await createClient()
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = await createAdminClient()
  const { data, error } = await adminClient
    .from('projects')
    .select('id, code, name, description, is_active, sub_projects(id, code, name, description, is_active)')
    .order('code')

  if (error) return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  return NextResponse.json({ data })
}

// POST — create project or sub-project
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const adminClient = await createAdminClient()

  // Detect project vs sub-project by presence of project_id
  if (typeof body === 'object' && body !== null && 'project_id' in body) {
    const parsed = createSubProjectSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

    const { data, error } = await adminClient
      .from('sub_projects').insert(parsed.data).select().single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Sub-project code already exists in this project' }, { status: 409 })
      return NextResponse.json({ error: 'Failed to create sub-project' }, { status: 500 })
    }
    return NextResponse.json({ data }, { status: 201 })
  }

  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await adminClient
    .from('projects').insert(parsed.data).select().single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Project code already exists' }, { status: 409 })
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}

// PATCH — toggle active or rename
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { id, type, ...updates } = parsed.data
  const adminClient = await createAdminClient()
  const table = type === 'project' ? 'projects' : 'sub_projects'

  const { data, error } = await adminClient
    .from(table).update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  return NextResponse.json({ data })
}
