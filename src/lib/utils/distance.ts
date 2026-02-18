/**
 * Utility for calculating distance between two points using the Haversine formula.
 */

/**
 * Calculates the Haversine distance between two sets of coordinates in kilometers.
 */
export function calculateHaversineDistance(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined
): number | null {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return null;
  }

  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return d;
}


/**
 * Estimates travel time in minutes based on distance.
 * SWIGGY 2026: ~5 mins per 1km in city traffic + 10 mins buffer.
 */
export function calculateTravelTime(distanceKm: number | null | undefined): { min: number; max: number } | null {
  if (distanceKm == null) return null;

  const baseMins = Math.ceil(distanceKm * 5);
  return {
    min: baseMins + 5,
    max: baseMins + 10
  };
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}
