/**
 * POST /api/v1/maps/route
 * Calculate a turn-by-turn route between waypoints.
 *
 * Connected to Phase 9B Multi-Tier Routing Provider:
 * 1. Mapbox Directions API v5 (Primary)
 * 2. Google Maps Directions API (Secondary)
 * 3. PostGIS / Haversine Topological Router (Sovereign Fallback)
 *
 * Request body:
 *   { waypoints: Array<{ lat: number, lng: number, name?: string }>, mode?: 'driving' | 'walking' | 'cycling' }
 */

import { NextRequest } from 'next/server';
import { ok, Errors, isValidLatitude, isValidLongitude } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { calculateRouteWithFallback } from '@/src/lib/providers/maps';
import { RouteWaypoint } from '@/src/lib/providers/types';

export async function POST(req: NextRequest) {
  const key = getRateLimitKey(req, 'maps-route');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    let body: {
      waypoints?: Array<{ lat: number; lng: number; name?: string }>;
      stops?: Array<{ lat: number; lng: number; name?: string }>;
      mode?: 'driving' | 'walking' | 'cycling';
    };

    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Invalid JSON body');
    }

    const rawWaypoints = body.waypoints || body.stops;
    if (!Array.isArray(rawWaypoints) || rawWaypoints.length < 2) {
      return Errors.badRequest('At least two waypoints are required for route calculation');
    }

    const waypoints: RouteWaypoint[] = [];
    for (const wp of rawWaypoints) {
      if (!isValidLatitude(wp.lat) || !isValidLongitude(wp.lng)) {
        return Errors.badRequest(`Invalid coordinate pair: lat=${wp.lat}, lng=${wp.lng}`);
      }
      waypoints.push({
        lat: wp.lat,
        lng: wp.lng,
        name: wp.name,
      });
    }

    const mode = body.mode || 'driving';
    const result = await calculateRouteWithFallback(waypoints, mode);

    return ok(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/v1/maps/route] Error:', msg);
    return Errors.internalError('Failed to calculate route');
  }
}
