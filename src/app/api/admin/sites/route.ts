import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const createSiteSchema = z.object({
  name: z.string().min(1).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_meters: z.number().int().min(1).max(5000),
})

const updateSiteSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radius_meters: z.number().int().min(1).max(5000).optional(),
  is_active: z.boolean().optional(),
})

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: admin } = await supabase
    .from('workers')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!admin || admin.role !== 'admin') return null
  return admin
}

// GET — list all sites
export async function GET() {
  const supabase = await createClient()
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = await createAdminClient()
  const { data, error } = await adminClient
    .from('site_locations')
    .select('*')
    .order('name')

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// POST — create a new site
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createSiteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const adminClient = await createAdminClient()
  const { data, error } = await adminClient
    .from('site_locations')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}

// PATCH — update a site
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSiteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { id, ...updates } = parsed.data
  const adminClient = await createAdminClient()
  const { data, error } = await adminClient
    .from('site_locations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update site' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
