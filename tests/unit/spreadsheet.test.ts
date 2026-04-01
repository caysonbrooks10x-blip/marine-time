import { describe, it, expect } from 'vitest'
import { formatAttendanceRow, ATTENDANCE_HEADERS } from '../../src/lib/sheets/structure'

const mockLog = {
  id: 'abc-123',
  clock_in_at: '2024-03-15T08:00:00Z',
  clock_out_at: '2024-03-15T16:30:00Z',
  clock_in_distance_meters: 42,
  status: 'approved',
  offline_queued: false,
  workers: { employee_code: 'W001', name: 'Ahmad bin Hassan', role: 'worker' },
  projects: { code: 'BERTH-MAINT-2024', name: 'Berth Maintenance 2024' },
  sub_projects: { code: 'PAINT-HULL', name: 'Hull Painting' },
  site_locations: { name: 'Main Berth Area' },
}

describe('formatAttendanceRow', () => {
  it('returns correct number of columns matching headers', () => {
    const row = formatAttendanceRow(mockLog)
    expect(row.length).toBe(ATTENDANCE_HEADERS.length)
  })

  it('includes employee code', () => {
    const row = formatAttendanceRow(mockLog)
    expect(row).toContain('W001')
  })

  it('includes worker name', () => {
    const row = formatAttendanceRow(mockLog)
    expect(row).toContain('Ahmad bin Hassan')
  })

  it('includes project code', () => {
    const row = formatAttendanceRow(mockLog)
    expect(row).toContain('BERTH-MAINT-2024')
  })

  it('calculates correct duration (8.5h)', () => {
    const row = formatAttendanceRow(mockLog)
    const hoursCol = row[12]
    expect(parseFloat(hoursCol)).toBeCloseTo(8.5, 1)
  })

  it('shows Still In when no clock-out', () => {
    const row = formatAttendanceRow({ ...mockLog, clock_out_at: null })
    expect(row[11]).toBe('Still In')
    expect(row[12]).toBe('')
  })

  it('marks offline correctly', () => {
    const onlineRow = formatAttendanceRow(mockLog)
    const offlineRow = formatAttendanceRow({ ...mockLog, offline_queued: true })
    expect(onlineRow[15]).toBe('No')
    expect(offlineRow[15]).toBe('Yes')
  })

  it('includes log ID as last column', () => {
    const row = formatAttendanceRow(mockLog)
    expect(row[16]).toBe('abc-123')
  })

  it('handles missing sub-project gracefully', () => {
    const row = formatAttendanceRow({ ...mockLog, sub_projects: null })
    expect(row[7]).toBe('')
    expect(row[8]).toBe('')
  })

  it('GPS distance column is a string number', () => {
    const row = formatAttendanceRow(mockLog)
    expect(row[13]).toBe('42')
  })
})
