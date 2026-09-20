/**
 * GET /api/v1/hotels
 * Search hotels and official government tourism stays across the 8 Union Territories.
 *
 * Connected to Phase 9B Multi-Tier Accommodation Provider:
 * 1. Amadeus Hotel Search v3 (Commercial Primary)
 * 2. Official UT Tourism Corporation Stays Adapter (JKTDC, SPORTS, ANIIDCO, PTDC, CITCO)
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { searchHotelsWithFallback } from '@/src/lib/providers/hotels';

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'hotels');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  const { searchParams } = req.nextUrl;
  const territory = searchParams.get('territory') || searchParams.get('city') || 'ladakh';
  const checkIn = searchParams.get('checkIn') || undefined;
  const checkOut = searchParams.get('checkOut') || undefined;
  const guests = parseInt(searchParams.get('guests') || '2', 10);

  try {
    const hotels = await searchHotelsWithFallback(territory, checkIn, checkOut, guests);

    return ok({
      queryTerritory: territory,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guests,
      hotels,
      total: hotels.length,
      officialGovtStaysCount: hotels.filter((h) => h.isOfficialGovtStay).length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/v1/hotels] Error:', msg);
    return Errors.internalError('Failed to search accommodation');
  }
}
