export type CompanyDayType = 'MonFri' | 'Sat' | 'SunPH'

interface BreakWindow {
  startMin: number
  endMin: number
  hours: number
}

interface LocalDateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekdayShort: string
}

export interface CompanyTimesheetBreakdown {
  workDate: string
  timeIn: string
  timeOut: string | null
  dayType: CompanyDayType
  isCrossMidnight: boolean
  breaksDeductedHours: number | null
  netWorkedHours: number | null
  normalPaidHours: number | null
  otPaidHours: number | null
  totalPaidHours: number | null
}

const BREAKS_MON_FRI: BreakWindow[] = [
  { startMin: 12 * 60 + 15, endMin: 13 * 60, hours: 0.75 },
  { startMin: 18 * 60 + 30, endMin: 19 * 60, hours: 0.5 },
  { startMin: 23 * 60 + 30, endMin: 24 * 60, hours: 0.5 },
]

const BREAKS_SAT_SUN_PH: BreakWindow[] = [
  { startMin: 11 * 60 + 30, endMin: 12 * 60 + 15, hours: 0.75 },
  { startMin: 18 * 60 + 15, endMin: 18 * 60 + 45, hours: 0.5 },
  { startMin: 23 * 60 + 30, endMin: 24 * 60, hours: 0.5 },
]

export const COMPANY_TIME_ZONE = process.env.COMPANY_TIME_ZONE ?? 'Asia/Singapore'

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function getLocalDateParts(iso: string, timeZone = COMPANY_TIME_ZONE): LocalDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(new Date(iso))
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? ''

  return {
    year: Number(lookup('year')),
    month: Number(lookup('month')),
    day: Number(lookup('day')),
    hour: Number(lookup('hour')),
    minute: Number(lookup('minute')),
    weekdayShort: lookup('weekday'),
  }
}

function formatDateKey(parts: Pick<LocalDateParts, 'year' | 'month' | 'day'>): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function formatTime(parts: Pick<LocalDateParts, 'hour' | 'minute'>): string {
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
}

function timeToMinutes(parts: Pick<LocalDateParts, 'hour' | 'minute'>): number {
  return parts.hour * 60 + parts.minute
}

function shiftOverlapsBreak(
  shiftStartMin: number,
  shiftEndMin: number,
  breakStartMin: number,
  breakEndMin: number,
  isCrossMidnight: boolean
): boolean {
  if (!isCrossMidnight) {
    return shiftStartMin < breakEndMin && shiftEndMin > breakStartMin
  }

  const overlapsDayOne = shiftStartMin < breakEndMin && 24 * 60 > breakStartMin
  const overlapsDayTwo = 0 < breakEndMin && shiftEndMin > breakStartMin

  return overlapsDayOne || overlapsDayTwo
}

export function getConfiguredPublicHolidays(): Set<string> {
  const raw = process.env.TIMESHEET_PUBLIC_HOLIDAYS ?? ''

  return new Set(
    raw
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  )
}

export function getCompanyDayType(
  workDate: string,
  publicHolidays = getConfiguredPublicHolidays()
): CompanyDayType {
  if (publicHolidays.has(workDate)) {
    return 'SunPH'
  }

  const dayOfWeek = new Date(`${workDate}T00:00:00Z`).getUTCDay()
  if (dayOfWeek === 0) return 'SunPH'
  if (dayOfWeek === 6) return 'Sat'
  return 'MonFri'
}

function calculateBreakDeduction(
  shiftStartMin: number,
  shiftEndMin: number,
  dayType: CompanyDayType,
  isCrossMidnight: boolean
): number {
  const breaks = dayType === 'MonFri' ? BREAKS_MON_FRI : BREAKS_SAT_SUN_PH

  return round2(
    breaks.reduce((total, breakWindow) => {
      return total + (
        shiftOverlapsBreak(
          shiftStartMin,
          shiftEndMin,
          breakWindow.startMin,
          breakWindow.endMin,
          isCrossMidnight
        )
          ? breakWindow.hours
          : 0
      )
    }, 0)
  )
}

function calculatePaidHours(
  netWorkedHours: number,
  dayType: CompanyDayType
): Pick<CompanyTimesheetBreakdown, 'normalPaidHours' | 'otPaidHours' | 'totalPaidHours'> {
  let normalPaidHours = 0
  let otPaidHours = 0

  if (dayType === 'MonFri') {
    normalPaidHours = Math.min(netWorkedHours, 8.75)
    otPaidHours = Math.max(netWorkedHours - 8.75, 0) * 1.5
  } else if (dayType === 'Sat') {
    otPaidHours = netWorkedHours * 1.5
  } else {
    otPaidHours = netWorkedHours * 2
  }

  return {
    normalPaidHours: round2(normalPaidHours),
    otPaidHours: round2(otPaidHours),
    totalPaidHours: round2(normalPaidHours + otPaidHours),
  }
}

export function calculateCompanyTimesheetBreakdown(
  clockInAt: string,
  clockOutAt: string | null,
  options?: {
    timeZone?: string
    publicHolidays?: Set<string>
  }
): CompanyTimesheetBreakdown {
  const timeZone = options?.timeZone ?? COMPANY_TIME_ZONE
  const publicHolidays = options?.publicHolidays ?? getConfiguredPublicHolidays()
  const clockInLocal = getLocalDateParts(clockInAt, timeZone)
  const workDate = formatDateKey(clockInLocal)
  const dayType = getCompanyDayType(workDate, publicHolidays)

  if (!clockOutAt) {
    return {
      workDate,
      timeIn: formatTime(clockInLocal),
      timeOut: null,
      dayType,
      isCrossMidnight: false,
      breaksDeductedHours: null,
      netWorkedHours: null,
      normalPaidHours: null,
      otPaidHours: null,
      totalPaidHours: null,
    }
  }

  const clockOutLocal = getLocalDateParts(clockOutAt, timeZone)
  const shiftStartMin = timeToMinutes(clockInLocal)
  const shiftEndMin = timeToMinutes(clockOutLocal)
  const isCrossMidnight = shiftEndMin <= shiftStartMin
  const grossWorkedHours = isCrossMidnight
    ? ((24 * 60 - shiftStartMin) + shiftEndMin) / 60
    : (shiftEndMin - shiftStartMin) / 60
  const breaksDeductedHours = calculateBreakDeduction(
    shiftStartMin,
    shiftEndMin,
    dayType,
    isCrossMidnight
  )
  const netWorkedHours = round2(Math.max(grossWorkedHours - breaksDeductedHours, 0))
  const paidHours = calculatePaidHours(netWorkedHours, dayType)

  return {
    workDate,
    timeIn: formatTime(clockInLocal),
    timeOut: formatTime(clockOutLocal),
    dayType,
    isCrossMidnight,
    breaksDeductedHours,
    netWorkedHours,
    normalPaidHours: paidHours.normalPaidHours,
    otPaidHours: paidHours.otPaidHours,
    totalPaidHours: paidHours.totalPaidHours,
  }
}

export function getCurrentCompanyYearMonth(timeZone = COMPANY_TIME_ZONE): { year: number; month: number } {
  const now = new Date()
  const parts = getLocalDateParts(now.toISOString(), timeZone)

  return { year: parts.year, month: parts.month }
}

export function getYearMonthFromWorkDate(workDate: string): { year: number; month: number } {
  const [year, month] = workDate.split('-').map(Number)
  return { year, month }
}

export function getMonthMetadata(year: number, month: number, publicHolidays = getConfiguredPublicHolidays()) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const weekday = new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: 'UTC',
    })

    return {
      day,
      dateKey,
      weekday,
      isPublicHoliday: publicHolidays.has(dateKey),
      dayType: getCompanyDayType(dateKey, publicHolidays),
    }
  })

  return {
    year,
    month,
    daysInMonth,
    monthLabel: new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    days,
  }
}

export function getMonthQueryWindow(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
  start.setUTCDate(start.getUTCDate() - 1)

  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59))
  end.setUTCDate(end.getUTCDate() + 1)

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  }
}

export function toExcelDateSerial(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86_400_000 + 25569
}

export function getCompanyTimesheetStoragePath(year: number, month: number): string {
  return `company-timesheets/company-timesheet-${year}-${String(month).padStart(2, '0')}.xlsx`
}
