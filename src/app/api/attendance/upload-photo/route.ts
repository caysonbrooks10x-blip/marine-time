import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  image_base64: z.string().min(1),
  log_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { image_base64, log_id } = parsed.data

  // Decode base64 to buffer
  const base64Data = image_base64.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')

  const fileName = `${log_id}-${Date.now()}.jpg`
  const filePath = `attendance-photos/${fileName}`

  // Upload to private Supabase Storage bucket
  const { error: uploadError } = await supabase.storage
    .from('attendance-photos')
    .upload(filePath, buffer, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: 'Photo upload failed' }, { status: 500 })
  }

  // Generate signed URL — 7 days expiry
  const { data: signedUrlData, error: signedError } = await supabase.storage
    .from('attendance-photos')
    .createSignedUrl(filePath, 604800) // 7 days in seconds

  if (signedError || !signedUrlData) {
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
  }

  // Update attendance log with photo URL
  const { error: updateError } = await supabase
    .from('attendance_logs')
    .update({ photo_proof_url: signedUrlData.signedUrl })
    .eq('id', log_id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to save photo reference' }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      photo_url: signedUrlData.signedUrl,
      file_path: filePath,
    },
  })
}
