/**
 * Asty ERP — Geofence Distance & Anti-Spoof Validation (SPEC Sections 4.1, 4.4 & 6)
 */

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracyM: number;
  altitudeAccuracy?: number | null;
  speed?: number | null;
}

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));
  return Math.round(R * c * 100) / 100;
}

export interface GeofenceEvaluation {
  allowed: boolean;
  distanceMeters: number;
  allowedRadiusMeters: number;
  isLowAccuracy: boolean;
  isMockSuspect: boolean;
  reasonKey?: string;
}

export function evaluateGeofence(
  userPos: GeoPoint,
  siteLat: number,
  siteLng: number,
  allowedRadiusMeters = 150,
): GeofenceEvaluation {
  const distanceMeters = haversineDistanceMeters(userPos.lat, userPos.lng, siteLat, siteLng);
  // Heuristic mock-location flag: impossible exact 0.000000 accuracy or negative accuracy
  const isMockSuspect = userPos.accuracyM <= 0 || !Number.isFinite(userPos.accuracyM);
  const isLowAccuracy = userPos.accuracyM > 50;

  if (isMockSuspect) {
    return {
      allowed: false,
      distanceMeters,
      allowedRadiusMeters,
      isLowAccuracy,
      isMockSuspect: true,
      reasonKey: 'dpr.error_mock_gps',
    };
  }

  if (distanceMeters > allowedRadiusMeters) {
    return {
      allowed: false,
      distanceMeters,
      allowedRadiusMeters,
      isLowAccuracy,
      isMockSuspect: false,
      reasonKey: 'dpr.error_outside_radius',
    };
  }

  return {
    allowed: true,
    distanceMeters,
    allowedRadiusMeters,
    isLowAccuracy,
    isMockSuspect: false,
  };
}

