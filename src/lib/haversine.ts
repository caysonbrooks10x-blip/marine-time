/**
 * Haversine formula — calculates great-circle distance between two GPS points.
 * Reference: https://www.movable-type.co.uk/scripts/latlong.html
 *
 * @returns Distance in meters (integer)
 */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6_371_000 // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Math.round(R * c)
}

/**
 * Returns true if the point (lat, lng) is within radiusMeters of (siteLat, siteLng)
 */
export function isWithinGeofence(
  lat: number,
  lng: number,
  siteLat: number,
  siteLng: number,
  radiusMeters: number
): boolean {
  return haversineMeters(lat, lng, siteLat, siteLng) <= radiusMeters
}
