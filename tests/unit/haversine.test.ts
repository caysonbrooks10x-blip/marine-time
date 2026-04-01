import { describe, it, expect } from 'vitest'
import { haversineMeters, isWithinGeofence } from '../../src/lib/haversine'

describe('haversineMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineMeters(1.3521, 103.8198, 1.3521, 103.8198)).toBe(0)
  })

  it('calculates correct distance between two Singapore points (~702m)', () => {
    // Main Berth to Dry Dock Yard in seed data
    const dist = haversineMeters(1.3521, 103.8198, 1.3480, 103.8150)
    expect(dist).toBeGreaterThan(690)
    expect(dist).toBeLessThan(715)
  })

  it('calculates ~111km for 1 degree latitude difference', () => {
    const dist = haversineMeters(0, 0, 1, 0)
    expect(dist).toBeGreaterThan(110_000)
    expect(dist).toBeLessThan(112_000)
  })

  it('is symmetric — A to B equals B to A', () => {
    const ab = haversineMeters(1.3521, 103.8198, 1.3480, 103.8150)
    const ba = haversineMeters(1.3480, 103.8150, 1.3521, 103.8198)
    expect(ab).toBe(ba)
  })

  it('returns integer (rounded)', () => {
    const dist = haversineMeters(1.3521, 103.8198, 1.3522, 103.8199)
    expect(Number.isInteger(dist)).toBe(true)
  })
})

describe('isWithinGeofence', () => {
  const siteLat = 1.3521
  const siteLng = 103.8198
  const radius = 75

  it('returns true when worker is at the site centre', () => {
    expect(isWithinGeofence(siteLat, siteLng, siteLat, siteLng, radius)).toBe(true)
  })

  it('returns true when worker is within radius', () => {
    // ~10m away
    expect(isWithinGeofence(1.35211, 103.81981, siteLat, siteLng, radius)).toBe(true)
  })

  it('returns false when worker is far outside radius', () => {
    // Main Berth to Dry Dock Yard ~702m away, radius 75m
    expect(isWithinGeofence(1.3480, 103.8150, siteLat, siteLng, radius)).toBe(false)
  })

  it('respects custom radius — passes with larger radius', () => {
    const dist = haversineMeters(1.3480, 103.8150, siteLat, siteLng)
    // Should fail at 75m
    expect(isWithinGeofence(1.3480, 103.8150, siteLat, siteLng, 75)).toBe(false)
    // Should pass with radius larger than the actual distance
    expect(isWithinGeofence(1.3480, 103.8150, siteLat, siteLng, dist + 10)).toBe(true)
  })
})
