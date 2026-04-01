/**
 * MarineTime — Spreadsheet Structure Definition
 *
 * This file defines the canonical column layout for all sheets.
 * Both Google Sheets and Excel use the same structure.
 *
 * ─────────────────────────────────────────────────────────────
 * SHEET 1: Attendance Log (live — one row per clock event)
 * ─────────────────────────────────────────────────────────────
 * A  Date
 * B  Day
 * C  Employee Code
 * D  Worker Name
 * E  Role
 * F  Project Code
 * G  Project Name
 * H  Sub-Project Code
 * I  Sub-Project Name
 * J  Site
 * K  Clock In
 * L  Clock Out
 * M  Duration (hrs)
 * N  GPS Distance (m)
 * O  Status
 * P  Offline Queued
 * Q  Log ID (hidden reference)
 *
 * ─────────────────────────────────────────────────────────────
 * SHEET 2: Daily Summary (aggregated per worker per day)
 * ─────────────────────────────────────────────────────────────
 * A  Date
 * B  Employee Code
 * C  Worker Name
 * D  Sessions
 * E  Total Hours
 * F  Approved Hours
 * G  Projects Worked
 *
 * ─────────────────────────────────────────────────────────────
 * SHEET 3: Project Hours (aggregated per project this month)
 * ─────────────────────────────────────────────────────────────
 * A  Project Code
 * B  Project Name
 * C  Sub-Project Code
 * D  Sub-Project Name
 * E  Total Sessions
 * F  Total Hours
 * G  Approved Hours
 * H  Workers Involved
 *
 * ─────────────────────────────────────────────────────────────
 * SHEET 4: Pending Approvals (supervisor queue view)
 * ─────────────────────────────────────────────────────────────
 * A  Date
 * B  Employee Code
 * C  Worker Name
 * D  Project Code
 * E  Clock In
 * F  Clock Out
 * G  Duration (hrs)
 * H  GPS Distance (m)
 * I  Offline
 * J  Log ID
 */

export const SHEET_NAMES = {
  ATTENDANCE: 'Attendance Log',
  DAILY: 'Daily Summary',
  PROJECTS: 'Project Hours',
  PENDING: 'Pending Approvals',
} as const

export const ATTENDANCE_HEADERS = [
  'Date',
  'Day',
  'Employee Code',
  'Worker Name',
  'Role',
  'Project Code',
  'Project Name',
  'Sub-Project Code',
  'Sub-Project Name',
  'Site',
  'Clock In',
  'Clock Out',
  'Duration (hrs)',
  'GPS Distance (m)',
  'Status',
  'Offline Queued',
  'Log ID',
]

export const DAILY_HEADERS = [
  'Date',
  'Employee Code',
  'Worker Name',
  'Sessions',
  'Total Hours',
  'Approved Hours',
  'Projects Worked',
]

export const PROJECT_HEADERS = [
  'Project Code',
  'Project Name',
  'Sub-Project Code',
  'Sub-Project Name',
  'Total Sessions',
  'Total Hours',
  'Approved Hours',
  'Workers Involved',
]

export const PENDING_HEADERS = [
  'Date',
  'Employee Code',
  'Worker Name',
  'Project Code',
  'Clock In',
  'Clock Out',
  'Duration (hrs)',
  'GPS Distance (m)',
  'Offline',
  'Log ID',
]

type MaybeRelation<T> = T | T[] | null

export interface AttendanceWorkerRelation {
  employee_code: string
  name: string
  role: string
}

export interface AttendanceProjectRelation {
  code: string
  name: string
}

export interface AttendanceSiteRelation {
  name: string
}

export interface AttendanceLogRow {
  id: string
  clock_in_at: string
  clock_out_at: string | null
  clock_in_distance_meters: number | null
  status: string
  offline_queued: boolean
  workers: MaybeRelation<AttendanceWorkerRelation>
  projects: MaybeRelation<AttendanceProjectRelation>
  sub_projects: MaybeRelation<AttendanceProjectRelation>
  site_locations: MaybeRelation<AttendanceSiteRelation>
}

export function firstRelation<T>(value: MaybeRelation<T> | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

/** Formats a DB attendance log row into Sheet 1 columns */
export function formatAttendanceRow(log: AttendanceLogRow): string[] {
  const clockIn = new Date(log.clock_in_at)
  const clockOut = log.clock_out_at ? new Date(log.clock_out_at) : null
  const mins = clockOut
    ? Math.round((clockOut.getTime() - clockIn.getTime()) / 60000)
    : null
  const hours = mins != null ? (mins / 60).toFixed(2) : ''
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const worker = firstRelation(log.workers)
  const project = firstRelation(log.projects)
  const subProject = firstRelation(log.sub_projects)
  const site = firstRelation(log.site_locations)

  return [
    clockIn.toISOString().split('T')[0],                          // Date
    days[clockIn.getDay()],                                        // Day
    worker?.employee_code ?? '',                                   // Employee Code
    worker?.name ?? '',                                            // Worker Name
    worker?.role ?? '',                                            // Role
    project?.code ?? '',                                           // Project Code
    project?.name ?? '',                                           // Project Name
    subProject?.code ?? '',                                        // Sub-Project Code
    subProject?.name ?? '',                                        // Sub-Project Name
    site?.name ?? '',                                              // Site
    clockIn.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
    clockOut ? clockOut.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : 'Still In',
    hours,                                                         // Duration
    log.clock_in_distance_meters?.toString() ?? '',                // GPS Distance
    log.status,                                                    // Status
    log.offline_queued ? 'Yes' : 'No',                            // Offline
    log.id,                                                        // Log ID
  ]
}
