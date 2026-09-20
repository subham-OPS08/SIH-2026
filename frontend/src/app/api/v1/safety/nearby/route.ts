/**
 * GET /api/v1/safety/nearby
 * Find nearest verified emergency facilities (Trauma Centers, Hospitals, Coast Guard, Oxygen Centers)
 * using PostGIS spatial proximity distance calculations.
 */

import { NextRequest } from 'next/server';
import { ok, Errors, isValidLatitude, isValidLongitude } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { getNearbyEmergencyFacilities, getTerritoryEmergencyFacilities } from '@/src/lib/providers/emergency';
import { VERIFIED_DESTINATIONS } from '@/src/lib/fixtures';

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'safety-nearby');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  const { searchParams } = req.nextUrl;
  const territorySlug = searchParams.get('territory');

  try {
    if (territorySlug) {
      const facilities = await getTerritoryEmergencyFacilities(territorySlug);
      return ok({
        territory: territorySlug,
        facilities,
        total: facilities.length,
      });
    }

    let lat: number | null = null;
    let lng: number | null = null;

    const destinationSlug = searchParams.get('destinationId') || searchParams.get('slug');
    if (destinationSlug) {
      const dest = VERIFIED_DESTINATIONS.find((d) => d.slug === destinationSlug || d.id === destinationSlug);
      if (dest) {
        lat = dest.coordinates.lat;
        lng = dest.coordinates.lng;
      }
    }

    if (lat === null || lng === null) {
      lat = parseFloat(searchParams.get('lat') || '34.1526'); // default Leh
      lng = parseFloat(searchParams.get('lng') || '77.5771');
    }

    if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
      return Errors.badRequest('Invalid coordinates: lat and lng must be valid decimal degrees');
    }

    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const nearest = await getNearbyEmergencyFacilities(lat, lng, limit);

    return ok({
      userCoordinates: { lat, lng },
      facilities: nearest,
      total: nearest.length,
      statutoryDispatchProtocol: 'ERSS 112 (Police, Fire, Medical, Women Safety)',
      directMaritimeSAR: '1554 (Indian Coast Guard)',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/v1/safety/nearby] Error:', msg);
    return Errors.internalError('Failed to locate nearby emergency facilities');
  }
}
