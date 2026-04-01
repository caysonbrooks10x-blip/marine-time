import { describe, expect, it } from 'vitest'
import {
  calculateCompanyTimesheetBreakdown,
  getCompanyDayType,
} from '../../src/lib/company-timesheet/rules'

describe('company timesheet rules', () => {
  it('calculates a regular weekday shift using the official break and OT rules', () => {
    const result = calculateCompanyTimesheetBreakdown(
      '2025-11-02T23:30:00.000Z', // 2025-11-03 07:30 Asia/Singapore
      '2025-11-03T10:30:00.000Z'  // 2025-11-03 18:30 Asia/Singapore
    )

    expect(result.workDate).toBe('2025-11-03')
    expect(result.dayType).toBe('MonFri')
    expect(result.breaksDeductedHours).toBe(0.75)
    expect(result.netWorkedHours).toBe(10.25)
    expect(result.normalPaidHours).toBe(8.75)
    expect(result.otPaidHours).toBe(2.25)
    expect(result.totalPaidHours).toBe(11)
  })

  it('calculates a Saturday shift as all overtime at 1.5x', () => {
    const result = calculateCompanyTimesheetBreakdown(
      '2025-11-07T23:30:00.000Z', // 2025-11-08 07:30 Asia/Singapore
      '2025-11-08T15:30:00.000Z'  // 2025-11-08 23:30 Asia/Singapore
    )

    expect(result.workDate).toBe('2025-11-08')
    expect(result.dayType).toBe('Sat')
    expect(result.breaksDeductedHours).toBe(1.25)
    expect(result.netWorkedHours).toBe(14.75)
    expect(result.normalPaidHours).toBe(0)
    expect(result.otPaidHours).toBe(22.13)
    expect(result.totalPaidHours).toBe(22.13)
  })

  it('calculates a Sunday cross-midnight shift as all overtime at 2x', () => {
    const result = calculateCompanyTimesheetBreakdown(
      '2025-11-08T23:30:00.000Z', // 2025-11-09 07:30 Asia/Singapore
      '2025-11-09T22:00:00.000Z'  // 2025-11-10 06:00 Asia/Singapore
    )

    expect(result.workDate).toBe('2025-11-09')
    expect(result.dayType).toBe('SunPH')
    expect(result.isCrossMidnight).toBe(true)
    expect(result.breaksDeductedHours).toBe(1.75)
    expect(result.netWorkedHours).toBe(20.75)
    expect(result.normalPaidHours).toBe(0)
    expect(result.otPaidHours).toBe(41.5)
    expect(result.totalPaidHours).toBe(41.5)
  })

  it('treats configured public holidays as Sunday/public holiday pay rules', () => {
    expect(getCompanyDayType('2025-11-10', new Set(['2025-11-10']))).toBe('SunPH')
  })

  it('keeps open sessions visible but unpaid until clock-out', () => {
    const result = calculateCompanyTimesheetBreakdown('2025-11-02T23:30:00.000Z', null)

    expect(result.timeOut).toBeNull()
    expect(result.breaksDeductedHours).toBeNull()
    expect(result.netWorkedHours).toBeNull()
    expect(result.totalPaidHours).toBeNull()
  })
})
