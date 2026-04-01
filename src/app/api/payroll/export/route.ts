import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { firstRelation } from '@/lib/sheets/structure'

const exportSchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(['csv', 'pdf']).default('csv'),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: admin } = await supabase
    .from('workers')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = exportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { period_start, period_end, format } = parsed.data

  if (new Date(period_end) < new Date(period_start)) {
    return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
  }

  const adminClient = await createAdminClient()

  const { data: logs, error: fetchError } = await adminClient
    .from('attendance_logs')
    .select(`
      id,
      clock_in_at,
      clock_out_at,
      clock_in_distance_meters,
      status,
      workers ( employee_code, name, role ),
      projects ( code, name ),
      sub_projects ( code, name ),
      site_locations ( name )
    `)
    .gte('clock_in_at', `${period_start}T00:00:00Z`)
    .lte('clock_in_at', `${period_end}T23:59:59Z`)
    .not('clock_out_at', 'is', null)
    .order('clock_in_at', { ascending: true })

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 })
  }

  if (!logs || logs.length === 0) {
    return NextResponse.json({ error: 'No completed records found in this period' }, { status: 404 })
  }

  // Build row data shared by both formats
  const headers = ['Code', 'Name', 'Project', 'Sub-Project', 'Site', 'Clock In', 'Clock Out', 'Hours', 'Dist (m)', 'Status']

  const rows = logs.map(log => {
    const w = firstRelation(log.workers)
    const p = firstRelation(log.projects)
    const sp = firstRelation(log.sub_projects)
    const s = firstRelation(log.site_locations)

    const mins = log.clock_out_at
      ? Math.round((new Date(log.clock_out_at).getTime() - new Date(log.clock_in_at).getTime()) / 60000)
      : 0
    const hours = (mins / 60).toFixed(2)

    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

    return [
      w?.employee_code ?? '',
      w?.name ?? '',
      p?.code ?? '',
      sp?.code ?? '',
      s?.name ?? '',
      fmtDate(log.clock_in_at),
      log.clock_out_at ? fmtDate(log.clock_out_at) : '',
      hours,
      log.clock_in_distance_meters?.toString() ?? '',
      log.status,
    ]
  })

  // Total hours summary
  const totalHours = rows.reduce((acc, r) => acc + parseFloat(r[7] as string), 0)

  let fileContent: Buffer
  let contentType: string
  let ext: string

  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42)
    doc.text('MarineTime — Payroll Report', 14, 16)

    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(`Period: ${period_start} to ${period_end}`, 14, 23)
    doc.text(`Records: ${logs.length}   Total Hours: ${totalHours.toFixed(2)}`, 14, 29)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35)

    autoTable(doc, {
      startY: 40,
      head: [headers],
      body: rows as string[][],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: {
        0: { cellWidth: 18 },
        7: { halign: 'right' },
        8: { halign: 'right' },
      },
    })

    fileContent = Buffer.from(doc.output('arraybuffer'))
    contentType = 'application/pdf'
    ext = 'pdf'
  } else {
    const csvRows = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      '',
      `"Total Hours","${totalHours.toFixed(2)}"`,
    ]
    fileContent = Buffer.from(csvRows.join('\n'))
    contentType = 'text/csv'
    ext = 'csv'
  }

  // Upload to Supabase Storage
  const filename = `payroll_${period_start}_${period_end}_${Date.now()}.${ext}`
  const { error: uploadError } = await adminClient.storage
    .from('payroll-exports')
    .upload(filename, fileContent, { contentType, upsert: false })

  let fileUrl: string | null = null
  if (!uploadError) {
    const { data: signedData } = await adminClient.storage
      .from('payroll-exports')
      .createSignedUrl(filename, 604800)
    fileUrl = signedData?.signedUrl ?? null
  }

  await adminClient.from('payroll_exports').insert({
    period_start,
    period_end,
    exported_by: admin.id,
    file_url: fileUrl,
    record_count: logs.length,
  })

  return new NextResponse(new Uint8Array(fileContent), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      ...(fileUrl ? { 'X-File-Url': fileUrl } : {}),
    },
  })
}
