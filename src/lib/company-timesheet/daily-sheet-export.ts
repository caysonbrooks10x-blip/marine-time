import ExcelJS from 'exceljs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPANY_TIME_ZONE } from './rules'

interface WorkerRecord {
  id: string
  employee_code: string
  name: string
  position: string | null
}

interface AttendanceLogForSheet {
  worker_id: string
  clock_in_at: string
  clock_out_at: string | null
  projects: { code: string; name: string } | { code: string; name: string }[] | null
  sub_projects: { code: string; name: string } | { code: string; name: string }[] | null
  site_locations: { name: string } | { name: string }[] | null
}

interface RosterEntryForSheet {
  worker_id: string
  status: string
  remarks: string | null
}

const STATUS_DISPLAY: Record<string, string> = {
  project_off: 'POFF',
  off: 'Off',
  absent: 'Absent',
  home_leave: 'Home Leave',
  mc: 'MC',
  no_job: 'No Job',
  supply: 'Supply',
  resign: 'Resign',
}

function firstRelation<T>(val: T | T[] | null): T | null {
  if (val === null) return null
  if (Array.isArray(val)) return val[0] ?? null
  return val
}

function formatTimeLocal(iso: string, timeZone = COMPANY_TIME_ZONE): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  })
}

function getWeekdayLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z')
  return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

export async function generateDailySheet(
  adminClient: SupabaseClient,
  date: string // YYYY-MM-DD
): Promise<{ buffer: Buffer; fileName: string; presentCount: number }> {
  // Fetch workers
  const { data: workers } = await adminClient
    .from('workers')
    .select('id, employee_code, name, position')
    .eq('is_active', true)
    .order('employee_code')

  // Fetch attendance for the date
  const dayStart = `${date}T00:00:00+08:00`
  const dayEnd = `${date}T23:59:59+08:00`

  const { data: logs } = await adminClient
    .from('attendance_logs')
    .select(`
      worker_id, clock_in_at, clock_out_at,
      projects ( code, name ),
      sub_projects ( code, name ),
      site_locations ( name )
    `)
    .gte('clock_in_at', dayStart)
    .lte('clock_in_at', dayEnd)

  // Fetch roster entries
  const { data: rosterEntries } = await adminClient
    .from('daily_roster_entries')
    .select('worker_id, status, remarks')
    .eq('work_date', date)

  // Build lookups
  const logByWorker = new Map<string, AttendanceLogForSheet>()
  for (const log of (logs ?? []) as AttendanceLogForSheet[]) {
    if (!logByWorker.has(log.worker_id)) {
      logByWorker.set(log.worker_id, log)
    }
  }

  const rosterByWorker = new Map<string, RosterEntryForSheet>()
  for (const entry of (rosterEntries ?? []) as RosterEntryForSheet[]) {
    rosterByWorker.set(entry.worker_id, entry)
  }

  // Build workbook
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'MarineTime'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Daily Sheet')

  // Column widths matching paper form
  sheet.getColumn('A').width = 6   // S.N
  sheet.getColumn('B').width = 12  // Emp No
  sheet.getColumn('C').width = 28  // Name
  sheet.getColumn('D').width = 20  // Position
  sheet.getColumn('E').width = 20  // Project Vessel Name
  sheet.getColumn('F').width = 16  // Project Main Code
  sheet.getColumn('G').width = 10  // Time In
  sheet.getColumn('H').width = 10  // Time Out
  sheet.getColumn('I').width = 20  // Remark

  const weekday = getWeekdayLabel(date)
  const formattedDate = new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC' })

  // Header rows
  sheet.mergeCells('A1:I1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = 'SAFE WORK DECLARATION FORM'
  titleCell.font = { bold: true, size: 14, name: 'Calibri' }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

  sheet.mergeCells('A3:C3')
  sheet.getCell('A3').value = 'Date:'
  sheet.getCell('A3').font = { bold: true, size: 11, name: 'Calibri' }
  sheet.getCell('D3').value = `${formattedDate} (${weekday})`
  sheet.getCell('D3').font = { bold: true, size: 11, name: 'Calibri' }

  let presentCount = 0
  const workerList = (workers ?? []) as WorkerRecord[]
  for (const w of workerList) {
    if (logByWorker.has(w.id)) presentCount++
  }

  sheet.getCell('G3').value = 'Total Man Power:'
  sheet.getCell('G3').font = { bold: true, size: 11, name: 'Calibri' }
  sheet.getCell('H3').value = presentCount
  sheet.getCell('H3').font = { bold: true, size: 14, name: 'Calibri' }

  // Sub-header note
  sheet.mergeCells('A4:I4')
  sheet.getCell('A4').value = '(Total Man Power excludes MC / Off / No Job / Home Leave / Absent)'
  sheet.getCell('A4').font = { italic: true, size: 9, name: 'Calibri', color: { argb: 'FF666666' } }

  // Table headers (row 6)
  const headerRow = 6
  const headers = ['S.N', 'Emp No.', 'Name', 'Position', 'Project Vessel Name', 'Project Main Code', 'Time In', 'Time Out', 'Remark (MC/Off/No Job/Home Leave/Absent)']
  headers.forEach((header, i) => {
    const cell = sheet.getCell(headerRow, i + 1)
    cell.value = header
    cell.font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  })
  sheet.getRow(headerRow).height = 32

  // Data rows
  const startRow = 7
  workerList.forEach((worker, index) => {
    const rowNum = startRow + index
    const log = logByWorker.get(worker.id)
    const roster = rosterByWorker.get(worker.id)
    const isPresent = !!log

    const project = log ? firstRelation(log.projects) : null

    const rowData = [
      index + 1,
      worker.employee_code,
      worker.name,
      worker.position ?? '',
      isPresent ? (project?.name ?? '') : '',
      isPresent ? (project?.code ?? '') : '',
      isPresent ? formatTimeLocal(log.clock_in_at) : '',
      isPresent && log.clock_out_at ? formatTimeLocal(log.clock_out_at) : '',
      isPresent ? '' : (roster ? (STATUS_DISPLAY[roster.status] ?? roster.status) : ''),
    ]

    rowData.forEach((val, colIdx) => {
      const cell = sheet.getCell(rowNum, colIdx + 1)
      cell.value = val
      cell.font = { size: 10, name: 'Calibri' }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      }

      // Highlight present rows green, status rows amber
      if (isPresent) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
      } else if (roster) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }
      }
    })

    // Center-align columns S.N, Emp No, Time In, Time Out
    for (const col of [1, 2, 7, 8]) {
      sheet.getCell(rowNum, col).alignment = { horizontal: 'center', vertical: 'middle' }
    }
  })

  // Footer
  const footerRow = startRow + workerList.length + 2
  sheet.getCell(`A${footerRow}`).value = 'Time Keeper Name:'
  sheet.getCell(`A${footerRow}`).font = { bold: true, size: 10, name: 'Calibri' }
  sheet.mergeCells(`A${footerRow}:C${footerRow}`)

  sheet.getCell(`A${footerRow + 1}`).value = 'Approved by Project Manager:'
  sheet.getCell(`A${footerRow + 1}`).font = { bold: true, size: 10, name: 'Calibri' }
  sheet.mergeCells(`A${footerRow + 1}:C${footerRow + 1}`)

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  const fileName = `daily-sheet-${date}.xlsx`

  return { buffer, fileName, presentCount }
}
