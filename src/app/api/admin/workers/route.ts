import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

const createWorkerSchema = z.object({
  employee_code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  position: z.string().max(50).nullable().optional(),
  role: z.enum(['worker', 'supervisor', 'admin']),
  pin: z.string().length(4).regex(/^\d{4}$/),
  supervisor_id: z.string().uuid().nullable().optional(),
})

const updateWorkerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  position: z.string().max(50).nullable().optional(),
  role: z.enum(['worker', 'supervisor', 'admin']).optional(),
  pin: z.string().length(4).regex(/^\d{4}$/).optional(),
  supervisor_id: z.string().uuid().nullable().optional(),
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

// GET — list all workers
export async function GET() {
  const supabase = await createClient()
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = await createAdminClient()
  const { data, error } = await adminClient
    .from('workers')
    .select('id, employee_code, name, position, role, supervisor_id, is_active, created_at')
    .order('employee_code')

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// POST — create a new worker
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createWorkerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { employee_code, name, position, role, pin, supervisor_id } = parsed.data
  const pin_hash = await bcrypt.hash(pin, 12)

  const adminClient = await createAdminClient()
  const { data, error } = await adminClient
    .from('workers')
    .insert({
      employee_code,
      name,
      position: position ?? null,
      role,
      pin_hash,
      supervisor_id: supervisor_id ?? null,
    })
    .select('id, employee_code, name, role')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Employee code already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create worker' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}

// PATCH — update a worker
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  if (!(await verifyAdmin(supabase))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateWorkerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { id, pin, ...updates } = parsed.data
  const updateData: Record<string, unknown> = { ...updates }

  if (pin) {
    updateData.pin_hash = await bcrypt.hash(pin, 12)
  }

  const adminClient = await createAdminClient()
  const { data, error } = await adminClient
    .from('workers')
    .update(updateData)
    .eq('id', id)
    .select('id, employee_code, name, role, is_active')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update worker' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
