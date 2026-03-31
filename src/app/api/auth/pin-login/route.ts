import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

const schema = z.object({
  employee_code: z.string().min(1).max(20).toUpperCase(),
  pin: z.string().min(4).max(8),
})

export async function POST(request: NextRequest) {
  // Rate limit: 5 attempts per IP per 60 seconds
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed, retryAfterMs } = checkRateLimit(`pin-login:${ip}`, 5, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts — try again later' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
      }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { employee_code, pin } = parsed.data

  // Admin client for worker lookup and user creation (bypasses RLS)
  const adminClient = await createAdminClient()

  // Find worker by employee code
  const { data: worker, error: workerError } = await adminClient
    .from('workers')
    .select('id, employee_code, name, role, pin_hash, supervisor_id, is_active')
    .eq('employee_code', employee_code)
    .single()

  if (workerError || !worker) {
    return NextResponse.json({ error: 'Invalid employee code or PIN' }, { status: 401 })
  }

  if (!worker.is_active) {
    return NextResponse.json({ error: 'Account is inactive' }, { status: 403 })
  }

  if (!worker.pin_hash) {
    return NextResponse.json({ error: 'PIN not set — contact your supervisor' }, { status: 403 })
  }

  // Verify PIN
  const pinValid = await bcrypt.compare(pin, worker.pin_hash)
  if (!pinValid) {
    return NextResponse.json({ error: 'Invalid employee code or PIN' }, { status: 401 })
  }

  const email = `${worker.employee_code.toLowerCase()}@marinetime.internal`
  const password = `mt-${worker.id}-${pin}`

  // Collect cookies from Supabase sign-in so we can set them on the response
  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((c) => pendingCookies.push(c))
        },
      },
    }
  )

  // Try to sign in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  let authUserId: string | undefined

  // If no account exists yet, create one via admin client
  if (signInError && signInError.message.includes('Invalid login credentials')) {
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError || !newUser.user) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    authUserId = newUser.user.id

    // Sign in with the Supabase client so session cookies are generated
    pendingCookies.length = 0 // clear any partial cookies from first attempt
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
    }
  } else if (signInError) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  } else {
    authUserId = signInData.user?.id
  }

  // Always sync auth_user_id so RLS policies work correctly
  if (authUserId) {
    await adminClient
      .from('workers')
      .update({ auth_user_id: authUserId })
      .eq('id', worker.id)
  }

  // Build response and apply all session cookies to it
  const response = NextResponse.json({
    data: {
      worker: {
        id: worker.id,
        employee_code: worker.employee_code,
        name: worker.name,
        role: worker.role,
      },
    },
  })

  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options as Record<string, unknown>)
  }

  return response
}
