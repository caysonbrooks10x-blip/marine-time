import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { haversineMeters } from '@/lib/haversine'

const schema = z.object({
  worker_id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  sub_project_id: z.string().uuid().nullable().optional(),
  site_id: z.string().uuid().nullable().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  photo_url: z.string().url().nullable().optional(),
  offline_queued: z.boolean().optional().default(false),
  timestamp: z.string().optional(), // ISO string from offline queue
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 1. Verify session
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // 2. Validate body
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { worker_id: requestedWorkerId, project_id, sub_project_id, site_id, lat, lng, photo_url, offline_queued, timestamp } = parsed.data

  const { data: worker, error: workerError } = await supabase
    .from('workers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (workerError || !worker) {
    return NextResponse.json({ error: 'Worker profile not found' }, { status: 404 })
  }

  if (requestedWorkerId && requestedWorkerId !== worker.id) {
    return NextResponse.json({ error: 'Worker mismatch for this session' }, { status: 403 })
  }

  const workerId = worker.id

  // 3. Check no open session exists for this worker
  const { data: openSession } = await supabase
    .from('attendance_logs')
    .select('id')
    .eq('worker_id', workerId)
    .is('clock_out_at', null)
    .single()

  if (openSession) {
    return NextResponse.json(
      { error: 'Already clocked in', code: 'already_clocked_in', log_id: openSession.id },
      { status: 409 }
    )
  }

  // 4. Geofence validation (if site_id provided)
  let distanceMeters: number | null = null

  if (site_id) {
    const { data: site, error: siteError } = await supabase
      .from('site_locations')
      .select('lat, lng, radius_meters, name')
      .eq('id', site_id)
      .eq('is_active', true)
      .single()

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    distanceMeters = haversineMeters(lat, lng, Number(site.lat), Number(site.lng))

    if (distanceMeters > site.radius_meters && process.env.DISABLE_GEOFENCE !== 'true') {
      return NextResponse.json(
        {
          error: `You are ${distanceMeters}m from ${site.name}. Maximum allowed distance is ${site.radius_meters}m.`,
          code: 'outside_geofence',
          distance_from_site_meters: distanceMeters,
          site_name: site.name,
          radius_meters: site.radius_meters,
        },
        { status: 400 }
      )
    }
  }

  // 5. Insert attendance log
  const clockInAt = offline_queued && timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()

  const { data: log, error: insertError } = await supabase
    .from('attendance_logs')
    .insert({
      worker_id: workerId,
      project_id,
      sub_project_id: sub_project_id ?? null,
      site_id: site_id ?? null,
      clock_in_at: clockInAt,
      clock_in_lat: lat,
      clock_in_lng: lng,
      clock_in_distance_meters: distanceMeters,
      photo_proof_url: photo_url ?? null,
      status: 'pending',
      offline_queued: offline_queued ?? false,
    })
    .select('id')
    .single()

  if (insertError || !log) {
    return NextResponse.json({ error: 'Failed to create attendance record' }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      log_id: log.id,
      status: 'clocked_in',
      clock_in_at: clockInAt,
      distance_from_site_meters: distanceMeters,
    },
  })
}
