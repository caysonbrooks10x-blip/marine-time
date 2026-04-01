import ExcelJS from 'exceljs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { firstRelation } from '@/lib/sheets/structure'
import {
  calculateCompanyTimesheetBreakdown,
  COMPANY_TIME_ZONE,
  getConfiguredPublicHolidays,
  getCompanyTimesheetStoragePath,
  getCurrentCompanyYearMonth,
  getMonthMetadata,
  getMonthQueryWindow,
  toExcelDateSerial,
} from './rules'

interface WorkerRecord {
  id: string
  employee_code: string
  name: string
  is_active: boolean
}

interface AttendanceLogRecord {
  id: string
  worker_id: string
  clock_in_at: string
  clock_out_at: string | null
  status: string
  offline_queued: boolean
  remarks: string | null
  workers: { employee_code: string; name: string; role: string }[] | { employee_code: string; name: string; role: string } | null
  projects: { code: string; name: string }[] | { code: string; name: string } | null
}

interface EntryRow {
  workDate: number
  empId: string
  projectMainCode: string
  vesselName: string
  timeIn: string
  timeOut: string
  remarks: string
  dayType: string
  breaksDeductedHours: number | null
  netWorkedHours: number | null
  normalPaidHours: number | null
  otPaidHours: number | null
  totalPaidHours: number | null
}

function buildRemarks(log: AttendanceLogRecord): string {
  const remarks: string[] = []

  // Include user-provided remarks first
  if (log.remarks) {
    remarks.push(log.remarks)
  }

  if (log.offline_queued) {
    remarks.push('Offline sync')
  }

  if (log.status === 'rejected') {
    remarks.push('Rejected')
  } else if (log.status === 'flagged') {
    remarks.push('Flagged')
  }

  return remarks.join(' | ')
}

function buildEntryRows(logs: AttendanceLogRecord[], publicHolidays: Set<string>): EntryRow[] {
  return logs
    .map(log => {
      const worker = firstRelation(log.workers)
      const project = firstRelation(log.projects)
      const breakdown = calculateCompanyTimesheetBreakdown(log.clock_in_at, log.clock_out_at, {
        publicHolidays,
      })

      return {
        workDate: toExcelDateSerial(breakdown.workDate),
        empId: worker?.employee_code ?? '',
        projectMainCode: project?.code ?? '',
        vesselName: project?.name ?? '',
        timeIn: breakdown.timeIn,
        timeOut: breakdown.timeOut ?? '',
        remarks: buildRemarks(log),
        dayType: breakdown.dayType,
        breaksDeductedHours: breakdown.breaksDeductedHours,
        netWorkedHours: breakdown.netWorkedHours,
        normalPaidHours: breakdown.normalPaidHours,
        otPaidHours: breakdown.otPaidHours,
        totalPaidHours: breakdown.totalPaidHours,
      }
    })
    .sort((a, b) => {
      if (a.workDate !== b.workDate) return a.workDate - b.workDate
      return a.empId.localeCompare(b.empId)
    })
}

async function fetchCompanyTimesheetData(
  adminClient: SupabaseClient,
  year: number,
  month: number
): Promise<{ workers: WorkerRecord[]; logs: AttendanceLogRecord[] }> {
  const queryWindow = getMonthQueryWindow(year, month)

  const { data: logsData, error: logsError } = await adminClient
    .from('attendance_logs')
    .select(`
      id,
      worker_id,
      clock_in_at,
      clock_out_at,
      status,
      offline_queued,
      remarks,
      workers ( employee_code, name, role ),
      projects ( code, name )
    `)
    .gte('clock_in_at', queryWindow.startIso)
    .lte('clock_in_at', queryWindow.endIso)
    .order('clock_in_at', { ascending: true })

  if (logsError) {
    throw new Error(`Failed to load company timesheet logs: ${logsError.message}`)
  }

  const publicHolidays = getConfiguredPublicHolidays()
  const filteredLogs = (logsData ?? []).filter(log => {
    const breakdown = calculateCompanyTimesheetBreakdown(log.clock_in_at, log.clock_out_at, {
      publicHolidays,
    })

    return breakdown.workDate.startsWith(`${year}-${String(month).padStart(2, '0')}`)
  }) as AttendanceLogRecord[]

  const workerIdsFromLogs = [...new Set(filteredLogs.map(log => log.worker_id).filter(Boolean))]

  const [{ data: activeWorkers, error: activeWorkersError }, loggedWorkersResult] = await Promise.all([
    adminClient
      .from('workers')
      .select('id, employee_code, name, is_active')
      .eq('is_active', true)
      .order('employee_code'),
    workerIdsFromLogs.length > 0
      ? adminClient
          .from('workers')
          .select('id, employee_code, name, is_active')
          .in('id', workerIdsFromLogs)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (activeWorkersError || loggedWorkersResult.error) {
    const message = activeWorkersError?.message ?? loggedWorkersResult.error?.message ?? 'Unknown worker error'
    throw new Error(`Failed to load workers for company timesheet: ${message}`)
  }

  const workerMap = new Map<string, WorkerRecord>()
  for (const worker of [...(activeWorkers ?? []), ...(loggedWorkersResult.data ?? [])]) {
    workerMap.set(worker.id, worker as WorkerRecord)
  }

  return {
    workers: [...workerMap.values()].sort((a, b) => a.employee_code.localeCompare(b.employee_code)),
    logs: filteredLogs,
  }
}

function applySheetChrome(worksheet: ExcelJS.Worksheet) {
  worksheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 5 }]
  worksheet.properties.defaultRowHeight = 20
}

function styleHeaderCell(cell: ExcelJS.Cell, fillArgb: string, fontSize = 9) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: fontSize, name: 'Calibri' }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } }
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FF0F172A' } },
    bottom: { style: 'thin', color: { argb: 'FF0F172A' } },
    right: { style: 'thin', color: { argb: 'FF0F172A' } },
  }
}

function styleBodyCell(cell: ExcelJS.Cell) {
  cell.font = { size: 9, name: 'Calibri' }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  }
}

function createEntriesSheet(workbook: ExcelJS.Workbook, entryRows: EntryRow[]) {
  const sheet = workbook.addWorksheet('Entries')
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  const headers = [
    'WorkDate',
    'EmpID',
    'ProjectMainCode',
    'VesselName',
    'TimeIn',
    'TimeOut',
    'Remarks',
    'DayType',
    'BreaksDeductedHours',
    'NetWorkedHours',
    'NormalPaidHours',
    'OTPaidHours',
    'TotalPaidHours',
  ]

  sheet.addTable({
    name: 'tblEntries',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium2',
      showRowStripes: true,
    },
    columns: headers.map(name => ({ name, filterButton: true })),
    rows: entryRows.map(row => [
      row.workDate,
      row.empId,
      row.projectMainCode,
      row.vesselName,
      row.timeIn,
      row.timeOut,
      row.remarks,
      row.dayType,
      row.breaksDeductedHours ?? '',
      row.netWorkedHours ?? '',
      row.normalPaidHours ?? '',
      row.otPaidHours ?? '',
      row.totalPaidHours ?? '',
    ]),
  })

  sheet.getColumn('A').numFmt = 'yyyy-mm-dd'
  for (const letter of ['I', 'J', 'K', 'L', 'M']) {
    sheet.getColumn(letter).numFmt = '0.00'
  }

  const widths = [14, 14, 18, 24, 10, 10, 24, 12, 18, 16, 16, 12, 14]
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })
}

function createConfigSheet(
  workbook: ExcelJS.Workbook,
  monthLabel: string,
  timeZone: string,
  publicHolidays: Set<string>
) {
  const sheet = workbook.addWorksheet('Config')
  sheet.columns = [
    { header: 'Key', key: 'key', width: 24 },
    { header: 'Value', key: 'value', width: 40 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.eachCell(cell => styleHeaderCell(cell, 'FF0F766E', 10))

  const holidayList = [...publicHolidays].sort().join(', ')

  const rows: Array<[string, string]> = [
    ['Workbook Month', monthLabel],
    ['Company Time Zone', timeZone],
    ['Public Holidays', holidayList || 'Not configured'],
    ['Rules', 'Mon-Fri normal cap 8.75h, Sat OT 1.5x, Sun/PH OT 2.0x'],
  ]

  rows.forEach(values => {
    const row = sheet.addRow(values)
    row.eachCell(styleBodyCell)
  })
}

function createCompanySummarySheet(
  workbook: ExcelJS.Workbook,
  workers: WorkerRecord[],
  year: number,
  month: number
) {
  const metadata = getMonthMetadata(year, month)
  const sheet = workbook.addWorksheet('Company Summary')
  applySheetChrome(sheet)

  sheet.mergeCells('A1:AO1')
  sheet.getCell('A1').value = `Summarized Report for ${metadata.monthLabel}`
  sheet.getCell('A1').font = { bold: true, size: 14, name: 'Calibri' }
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }

  sheet.mergeCells('A2:C2')
  sheet.getCell('A2').value = new Date(Date.UTC(year, month - 1, 1))
  sheet.getCell('A2').numFmt = 'mmm-yy'
  sheet.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' }

  sheet.mergeCells('A3:B3')
  sheet.getCell('A3').value = 'Public Holiday'
  sheet.getCell('A3').font = { bold: true, size: 9, name: 'Calibri' }

  sheet.getColumn('A').width = 14
  sheet.getColumn('B').width = 28
  sheet.getColumn('C').width = 14

  let columnIndex = 4
  for (const day of metadata.days) {
    const startLetter = sheet.getColumn(columnIndex).letter
    const endLetter = sheet.getColumn(columnIndex + 1).letter
    sheet.mergeCells(`${startLetter}4:${endLetter}4`)
    sheet.getCell(`${startLetter}4`).value = `${day.day} ${day.weekday}`
    styleHeaderCell(sheet.getCell(`${startLetter}4`), day.dayType === 'MonFri' ? 'FF1D4ED8' : 'FF7C3AED')

    sheet.getCell(`${startLetter}5`).value = 'Normal Hours'
    sheet.getCell(`${endLetter}5`).value = 'OT Hours'
    styleHeaderCell(sheet.getCell(`${startLetter}5`), 'FF334155')
    styleHeaderCell(sheet.getCell(`${endLetter}5`), 'FF334155')
    sheet.getColumn(columnIndex).width = 12
    sheet.getColumn(columnIndex + 1).width = 11

    columnIndex += 2
  }

  const lastDataColumn = sheet.getColumn(columnIndex - 1).letter

  sheet.getCell('A4').value = 'Emp ID'
  sheet.getCell('B4').value = 'Employee Name'
  sheet.getCell('C4').value = 'Total Hours'
  sheet.mergeCells('A4:A5')
  sheet.mergeCells('B4:B5')
  sheet.mergeCells('C4:C5')
  for (const address of ['A4', 'B4', 'C4']) {
    styleHeaderCell(sheet.getCell(address), 'FF0F172A')
  }

  const startRow = 6
  workers.forEach((worker, index) => {
    const rowNumber = startRow + index
    sheet.getCell(`A${rowNumber}`).value = worker.employee_code
    sheet.getCell(`B${rowNumber}`).value = worker.name
    sheet.getCell(`C${rowNumber}`).value = {
      formula: `SUM(D${rowNumber}:${lastDataColumn}${rowNumber})`,
    }
    sheet.getCell(`C${rowNumber}`).numFmt = '0.00'

    styleBodyCell(sheet.getCell(`A${rowNumber}`))
    styleBodyCell(sheet.getCell(`B${rowNumber}`))
    styleBodyCell(sheet.getCell(`C${rowNumber}`))
    sheet.getCell(`B${rowNumber}`).alignment = { horizontal: 'left', vertical: 'middle' }

    columnIndex = 4
    for (const day of metadata.days) {
      const normalCell = sheet.getCell(rowNumber, columnIndex)
      const otCell = sheet.getCell(rowNumber, columnIndex + 1)
      normalCell.value = {
        formula: `SUMIFS(tblEntries[NormalPaidHours],tblEntries[EmpID],$A${rowNumber},tblEntries[WorkDate],DATE(${year},${month},${day.day}))`,
      }
      otCell.value = {
        formula: `SUMIFS(tblEntries[OTPaidHours],tblEntries[EmpID],$A${rowNumber},tblEntries[WorkDate],DATE(${year},${month},${day.day}))`,
      }
      normalCell.numFmt = '0.00'
      otCell.numFmt = '0.00'
      styleBodyCell(normalCell)
      styleBodyCell(otCell)
      columnIndex += 2
    }
  })

  const totalsRow = startRow + workers.length
  for (const column of ['A', 'B']) {
    styleHeaderCell(sheet.getCell(`${column}${totalsRow}`), 'FF14532D')
  }
  sheet.getCell(`A${totalsRow}`).value = 'Totals'
  sheet.mergeCells(`A${totalsRow}:B${totalsRow}`)
  sheet.getCell(`C${totalsRow}`).value = {
    formula: `SUM(C${startRow}:C${totalsRow - 1})`,
  }
  sheet.getCell(`C${totalsRow}`).numFmt = '0.00'
  styleHeaderCell(sheet.getCell(`C${totalsRow}`), 'FF14532D')

  for (let col = 4; col < columnIndex; col++) {
    const cell = sheet.getCell(totalsRow, col)
    const letter = sheet.getColumn(col).letter
    cell.value = {
      formula: `SUM(${letter}${startRow}:${letter}${totalsRow - 1})`,
    }
    cell.numFmt = '0.00'
    styleHeaderCell(cell, 'FF14532D')
  }
}

function createLegacyTotalSheet(
  workbook: ExcelJS.Workbook,
  workers: WorkerRecord[],
  year: number,
  month: number
) {
  const metadata = getMonthMetadata(year, month)
  const sheet = workbook.addWorksheet('Legacy Total')
  sheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 5 }]

  const endColumnIndex = 3 + metadata.daysInMonth
  sheet.mergeCells(1, 1, 1, endColumnIndex)
  sheet.getCell('A1').value = `Summarized Report for ${metadata.monthLabel}`
  sheet.getCell('A1').font = { bold: true, size: 14, name: 'Calibri' }
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }

  sheet.mergeCells('A3:B3')
  sheet.getCell('A3').value = 'Public Holiday'
  sheet.getCell('A3').font = { bold: true, size: 9, name: 'Calibri' }

  sheet.getColumn('A').width = 14
  sheet.getColumn('B').width = 28
  sheet.getColumn('C').width = 14

  sheet.getCell('A5').value = 'Emp ID'
  sheet.getCell('B5').value = 'Employee Name'
  sheet.getCell('C5').value = 'Total Hours'
  for (const address of ['A5', 'B5', 'C5']) {
    styleHeaderCell(sheet.getCell(address), 'FF0F172A')
  }

  metadata.days.forEach((day, index) => {
    const col = sheet.getColumn(index + 4)
    const headerCell = sheet.getCell(5, index + 4)
    headerCell.value = `${day.day}\n${day.weekday}\n(Hr)`
    styleHeaderCell(headerCell, day.dayType === 'MonFri' ? 'FF1D4ED8' : 'FF7C3AED')
    col.width = 11
  })

  const startRow = 6
  workers.forEach((worker, index) => {
    const rowNumber = startRow + index
    sheet.getCell(`A${rowNumber}`).value = worker.employee_code
    sheet.getCell(`B${rowNumber}`).value = worker.name
    sheet.getCell(`C${rowNumber}`).value = {
      formula: `SUM(D${rowNumber}:${sheet.getColumn(endColumnIndex).letter}${rowNumber})`,
    }
    sheet.getCell(`C${rowNumber}`).numFmt = '0.00'
    styleBodyCell(sheet.getCell(`A${rowNumber}`))
    styleBodyCell(sheet.getCell(`B${rowNumber}`))
    styleBodyCell(sheet.getCell(`C${rowNumber}`))
    sheet.getCell(`B${rowNumber}`).alignment = { horizontal: 'left', vertical: 'middle' }

    metadata.days.forEach((day, dayIndex) => {
      const cell = sheet.getCell(rowNumber, dayIndex + 4)
      cell.value = {
        formula: `SUMIFS(tblEntries[TotalPaidHours],tblEntries[EmpID],$A${rowNumber},tblEntries[WorkDate],DATE(${year},${month},${day.day}))`,
      }
      cell.numFmt = '0.00'
      styleBodyCell(cell)
    })
  })

  const totalsRow = startRow + workers.length
  sheet.mergeCells(`A${totalsRow}:B${totalsRow}`)
  sheet.getCell(`A${totalsRow}`).value = 'Totals'
  styleHeaderCell(sheet.getCell(`A${totalsRow}`), 'FF14532D')
  styleHeaderCell(sheet.getCell(`C${totalsRow}`), 'FF14532D')
  sheet.getCell(`C${totalsRow}`).value = {
    formula: `SUM(C${startRow}:C${totalsRow - 1})`,
  }
  sheet.getCell(`C${totalsRow}`).numFmt = '0.00'

  metadata.days.forEach((_, dayIndex) => {
    const colIndex = dayIndex + 4
    const letter = sheet.getColumn(colIndex).letter
    const cell = sheet.getCell(totalsRow, colIndex)
    cell.value = {
      formula: `SUM(${letter}${startRow}:${letter}${totalsRow - 1})`,
    }
    cell.numFmt = '0.00'
    styleHeaderCell(cell, 'FF14532D')
  })
}

export async function regenerateCompanyTimesheetWorkbook(
  adminClient: SupabaseClient,
  options?: { year?: number; month?: number }
) {
  const target = options?.year && options?.month
    ? { year: options.year, month: options.month }
    : getCurrentCompanyYearMonth()

  const publicHolidays = getConfiguredPublicHolidays()
  const { workers, logs } = await fetchCompanyTimesheetData(adminClient, target.year, target.month)
  const entryRows = buildEntryRows(logs, publicHolidays)
  const metadata = getMonthMetadata(target.year, target.month, publicHolidays)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'MarineTime'
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.calcProperties.fullCalcOnLoad = true

  createCompanySummarySheet(workbook, workers, target.year, target.month)
  createLegacyTotalSheet(workbook, workers, target.year, target.month)
  createEntriesSheet(workbook, entryRows)
  createConfigSheet(workbook, metadata.monthLabel, COMPANY_TIME_ZONE, publicHolidays)

  const buffer = await workbook.xlsx.writeBuffer()
  const storagePath = getCompanyTimesheetStoragePath(target.year, target.month)

  const { error } = await adminClient.storage
    .from('payroll-exports')
    .upload(storagePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    })

  if (error) {
    throw new Error(`Company workbook upload failed: ${error.message}`)
  }

  return {
    storagePath,
    monthLabel: metadata.monthLabel,
    recordCount: entryRows.length,
  }
}
