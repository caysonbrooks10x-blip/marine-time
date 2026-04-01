/**
 * Excel export — generates a live .xlsx file with 4 sheets,
 * uploads to Supabase Storage as "live-attendance.xlsx".
 *
 * The file is regenerated on every clock event so admins can
 * always download the latest version.
 *
 * Download URL is stored at: NEXT_PUBLIC_APP_URL/api/admin/export/excel
 */

import ExcelJS from 'exceljs'
import {
  SHEET_NAMES,
  ATTENDANCE_HEADERS,
  DAILY_HEADERS,
  PROJECT_HEADERS,
  PENDING_HEADERS,
  firstRelation,
  type AttendanceLogRow,
  formatAttendanceRow,
} from './structure'
import type { SupabaseClient } from '@supabase/supabase-js'

const NAVY = 'FF0F172A'
const SKY = 'FF0284C7'
const SKY_LIGHT = 'FFE0F2FE'
const WHITE = 'FFFFFFFF'
const AMBER = 'FFFBBF24'
const GREEN = 'FF10B981'
const RED = 'FFEF4444'

function styleHeader(row: ExcelJS.Row, columns: number) {
  row.height = 28
  for (let c = 1; c <= columns; c++) {
    const cell = row.getCell(c)
    cell.font = { bold: true, color: { argb: WHITE }, size: 11, name: 'Calibri' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SKY } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: NAVY } },
    }
  }
}

function styleDataRow(row: ExcelJS.Row, columns: number, isEven: boolean, statusCol?: number) {
  row.height = 22
  for (let c = 1; c <= columns; c++) {
    const cell = row.getCell(c)
    cell.font = { size: 10, name: 'Calibri' }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isEven ? SKY_LIGHT : WHITE },
    }
    cell.alignment = { vertical: 'middle' }
    cell.border = {
      bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } },
    }
  }

  // Colour-code the status cell
  if (statusCol) {
    const statusCell = row.getCell(statusCol)
    const statusVal = String(statusCell.value ?? '').toLowerCase()
    const colors: Record<string, string> = {
      approved: GREEN,
      rejected: RED,
      pending: AMBER,
      flagged: 'FFAB60F0',
    }
    if (colors[statusVal]) {
      statusCell.font = { bold: true, color: { argb: WHITE }, size: 10, name: 'Calibri' }
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[statusVal] } }
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
  }
}

export async function regenerateExcel(adminClient: SupabaseClient) {
  // Fetch all logs (last 90 days to keep file size manageable)
  const since = new Date()
  since.setDate(since.getDate() - 90)

  const { data: logs } = await adminClient
    .from('attendance_logs')
    .select(`
      id, clock_in_at, clock_out_at, clock_in_distance_meters,
      status, offline_queued,
      workers ( employee_code, name, role ),
      projects ( code, name ),
      sub_projects ( code, name ),
      site_locations ( name )
    `)
    .gte('clock_in_at', since.toISOString())
    .order('clock_in_at', { ascending: false })

  if (!logs) return

  const typedLogs = logs as AttendanceLogRow[]

  const wb = new ExcelJS.Workbook()
  wb.creator = 'MarineTime'
  wb.created = new Date()
  wb.modified = new Date()
  wb.properties.date1904 = false

  // ──────────────────────────────────────────────
  // SHEET 1: Attendance Log
  // ──────────────────────────────────────────────
  const wsLog = wb.addWorksheet(SHEET_NAMES.ATTENDANCE, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: SKY } },
  })
  wsLog.columns = [
    { header: 'Date', key: 'date', width: 13 },
    { header: 'Day', key: 'day', width: 7 },
    { header: 'Employee Code', key: 'code', width: 15 },
    { header: 'Worker Name', key: 'name', width: 22 },
    { header: 'Role', key: 'role', width: 12 },
    { header: 'Project Code', key: 'pcode', width: 18 },
    { header: 'Project Name', key: 'pname', width: 24 },
    { header: 'Sub-Project Code', key: 'spcode', width: 18 },
    { header: 'Sub-Project Name', key: 'spname', width: 24 },
    { header: 'Site', key: 'site', width: 20 },
    { header: 'Clock In', key: 'in', width: 18 },
    { header: 'Clock Out', key: 'out', width: 18 },
    { header: 'Duration (hrs)', key: 'hours', width: 14 },
    { header: 'GPS Distance (m)', key: 'gps', width: 16 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Offline Queued', key: 'offline', width: 14 },
    { header: 'Log ID', key: 'id', width: 38 },
  ]

  styleHeader(wsLog.getRow(1), ATTENDANCE_HEADERS.length)

  typedLogs.forEach((log, i) => {
    const row = wsLog.addRow(formatAttendanceRow(log))
    styleDataRow(row, ATTENDANCE_HEADERS.length, i % 2 === 0, 15)
    // Right-align numeric columns
    row.getCell(13).alignment = { horizontal: 'right', vertical: 'middle' }
    row.getCell(14).alignment = { horizontal: 'right', vertical: 'middle' }
  })

  // Auto-filter
  wsLog.autoFilter = { from: 'A1', to: `Q1` }

  // ──────────────────────────────────────────────
  // SHEET 2: Daily Summary
  // ──────────────────────────────────────────────
  const wsDaily = wb.addWorksheet(SHEET_NAMES.DAILY, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: 'FF10B981' } },
  })
  wsDaily.columns = [
    { header: 'Date', key: 'date', width: 13 },
    { header: 'Employee Code', key: 'code', width: 15 },
    { header: 'Worker Name', key: 'name', width: 22 },
    { header: 'Sessions', key: 'sessions', width: 10 },
    { header: 'Total Hours', key: 'total', width: 13 },
    { header: 'Approved Hours', key: 'approved', width: 15 },
    { header: 'Projects Worked', key: 'projects', width: 30 },
  ]

  styleHeader(wsDaily.getRow(1), DAILY_HEADERS.length)

  // Aggregate by date + worker
  const dailyMap: Record<string, {
    date: string; code: string; name: string;
    sessions: number; totalMins: number; approvedMins: number;
    projects: Set<string>
  }> = {}

  for (const log of typedLogs) {
    const worker = firstRelation(log.workers)
    const project = firstRelation(log.projects)
    const date = log.clock_in_at.split('T')[0]
    const key = `${date}__${worker?.employee_code ?? ''}`
    if (!dailyMap[key]) {
      dailyMap[key] = {
        date, code: worker?.employee_code ?? '',
        name: worker?.name ?? '',
        sessions: 0, totalMins: 0, approvedMins: 0,
        projects: new Set(),
      }
    }
    const entry = dailyMap[key]
    entry.sessions++
    if (project?.code) entry.projects.add(project.code)
    if (log.clock_out_at) {
      const mins = Math.round(
        (new Date(log.clock_out_at).getTime() - new Date(log.clock_in_at).getTime()) / 60000
      )
      entry.totalMins += mins
      if (log.status === 'approved') entry.approvedMins += mins
    }
  }

  Object.values(dailyMap)
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((d, i) => {
      const row = wsDaily.addRow([
        d.date, d.code, d.name, d.sessions,
        (d.totalMins / 60).toFixed(2),
        (d.approvedMins / 60).toFixed(2),
        [...d.projects].join(', '),
      ])
      styleDataRow(row, DAILY_HEADERS.length, i % 2 === 0)
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }
    })

  wsDaily.autoFilter = { from: 'A1', to: 'G1' }

  // ──────────────────────────────────────────────
  // SHEET 3: Project Hours
  // ──────────────────────────────────────────────
  const wsProj = wb.addWorksheet(SHEET_NAMES.PROJECTS, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: 'FFFBBF24' } },
  })
  wsProj.columns = [
    { header: 'Project Code', key: 'pcode', width: 18 },
    { header: 'Project Name', key: 'pname', width: 24 },
    { header: 'Sub-Project Code', key: 'spcode', width: 18 },
    { header: 'Sub-Project Name', key: 'spname', width: 24 },
    { header: 'Total Sessions', key: 'sessions', width: 15 },
    { header: 'Total Hours', key: 'total', width: 13 },
    { header: 'Approved Hours', key: 'approved', width: 15 },
    { header: 'Workers Involved', key: 'workers', width: 16 },
  ]

  styleHeader(wsProj.getRow(1), PROJECT_HEADERS.length)

  const projMap: Record<string, {
    pcode: string; pname: string; spcode: string; spname: string;
    sessions: number; totalMins: number; approvedMins: number;
    workers: Set<string>
  }> = {}

  for (const log of typedLogs) {
    const worker = firstRelation(log.workers)
    const project = firstRelation(log.projects)
    const subProject = firstRelation(log.sub_projects)
    const key = `${project?.code ?? ''}__${subProject?.code ?? 'none'}`
    if (!projMap[key]) {
      projMap[key] = {
        pcode: project?.code ?? '',
        pname: project?.name ?? '',
        spcode: subProject?.code ?? '',
        spname: subProject?.name ?? '',
        sessions: 0, totalMins: 0, approvedMins: 0,
        workers: new Set(),
      }
    }
    const entry = projMap[key]
    entry.sessions++
    if (worker?.employee_code) entry.workers.add(worker.employee_code)
    if (log.clock_out_at) {
      const mins = Math.round(
        (new Date(log.clock_out_at).getTime() - new Date(log.clock_in_at).getTime()) / 60000
      )
      entry.totalMins += mins
      if (log.status === 'approved') entry.approvedMins += mins
    }
  }

  Object.values(projMap)
    .sort((a, b) => b.totalMins - a.totalMins)
    .forEach((p, i) => {
      const row = wsProj.addRow([
        p.pcode, p.pname, p.spcode, p.spname,
        p.sessions,
        (p.totalMins / 60).toFixed(2),
        (p.approvedMins / 60).toFixed(2),
        p.workers.size,
      ])
      styleDataRow(row, PROJECT_HEADERS.length, i % 2 === 0)
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }
      row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' }
    })

  wsProj.autoFilter = { from: 'A1', to: 'H1' }

  // ──────────────────────────────────────────────
  // SHEET 4: Pending Approvals
  // ──────────────────────────────────────────────
  const wsPending = wb.addWorksheet(SHEET_NAMES.PENDING, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: 'FFFBBF24' } },
  })
  wsPending.columns = [
    { header: 'Date', key: 'date', width: 13 },
    { header: 'Employee Code', key: 'code', width: 15 },
    { header: 'Worker Name', key: 'name', width: 22 },
    { header: 'Project Code', key: 'pcode', width: 18 },
    { header: 'Clock In', key: 'in', width: 18 },
    { header: 'Clock Out', key: 'out', width: 18 },
    { header: 'Duration (hrs)', key: 'hours', width: 14 },
    { header: 'GPS Distance (m)', key: 'gps', width: 16 },
    { header: 'Offline', key: 'offline', width: 10 },
    { header: 'Log ID', key: 'id', width: 38 },
  ]

  styleHeader(wsPending.getRow(1), PENDING_HEADERS.length)

  typedLogs
    .filter(l => l.status === 'pending')
    .forEach((log, i) => {
      const r = formatAttendanceRow(log)
      const row = wsPending.addRow([r[0], r[2], r[3], r[5], r[10], r[11], r[12], r[13], r[15], r[16]])
      styleDataRow(row, PENDING_HEADERS.length, i % 2 === 0)
    })

  wsPending.autoFilter = { from: 'A1', to: 'J1' }

  // ──────────────────────────────────────────────
  // Generate buffer and upload to Supabase Storage
  // ──────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()

  const { error } = await adminClient.storage
    .from('payroll-exports')
    .upload('live-attendance.xlsx', buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true, // Always overwrite the live file
    })

  if (error) {
    throw new Error(`Excel upload failed: ${error.message}`)
  }
}
