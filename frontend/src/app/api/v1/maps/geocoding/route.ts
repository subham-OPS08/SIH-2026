/**
 * GET /api/v1/maps/geocoding
 * Forward & Reverse Geocoding and POI search.
 *
 * Connected to Phase 9B Multi-Tier Geocoding Provider:
 * 1. Mapbox Geocoding v6 (Primary)
 * 2. Google Maps Geocoding (Secondary)
 * 3. Local Sovereign PostGIS DB (Fallback)
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { searchGeocodingWithFallback } from '@/src/lib/providers/maps';

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'geocoding');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  const { searchParams } = req.nextUrl;
  const q = searchParams.get('q') || searchParams.get('query') || '';

  if (!q.trim()) {
    return Errors.badRequest('Query parameter "q" is required.');
  }

  try {
    const results = await searchGeocodingWithFallback(q);
    return ok({ query: q, results, total: results.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/v1/maps/geocoding] Error:', msg);
    return Errors.internalError('Geocoding search failed');
  }
}
