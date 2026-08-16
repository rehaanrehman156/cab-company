// Haversine formula: straight-line distance between two lat/lon points
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Road distance is roughly 1.4x straight-line distance
const ROAD_FACTOR = 1.4;

const BASE_FARE: Record<string, number> = { mini: 40, sedan: 55, suv: 70 };
const PER_KM: Record<string, number>    = { mini: 10, sedan: 14, suv: 18 };
const MIN_FARE: Record<string, number>  = { mini: 80, sedan: 110, suv: 150 };

export function calculateFare(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  vehicleType: string = "mini"
): { distanceKm: number; fare: number } {
  const straightKm = haversineKm(lat1, lon1, lat2, lon2);
  const roadKm     = straightKm * ROAD_FACTOR;
  const type       = vehicleType.toLowerCase();
  const base       = BASE_FARE[type] ?? BASE_FARE.mini;
  const perKm      = PER_KM[type]    ?? PER_KM.mini;
  const min        = MIN_FARE[type]  ?? MIN_FARE.mini;
  const fare       = Math.max(min, Math.round(base + roadKm * perKm));
  return { distanceKm: Math.round(roadKm * 10) / 10, fare };
}
