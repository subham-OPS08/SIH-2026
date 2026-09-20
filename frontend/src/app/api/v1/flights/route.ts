/**
 * GET /api/v1/flights
 * Search domestic flight offers and verified schedules for the 8 Union Territories.
 *
 * Connected to Phase 9B Multi-Tier Flight Provider:
 * 1. Amadeus Flight Offers Search v2 (Primary)
 * 2. DGCA / AAI Verified Airline Timetable Ingestion (Fallback)
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { searchFlightsWithFallback } from '@/src/lib/providers/flights';

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'flights');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  const { searchParams } = req.nextUrl;
  const origin = searchParams.get('origin') || searchParams.get('from') || 'DEL';
  const destination = searchParams.get('destination') || searchParams.get('to') || 'IXL';
  const departureDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const adults = parseInt(searchParams.get('adults') || '1', 10);

  try {
    const offers = await searchFlightsWithFallback(origin, destination, departureDate, adults);

    return ok({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departureDate,
      adults,
      offers,
      total: offers.length,
      isFallback: offers.some((o) => o.metadata.status === 'FALLBACK'),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/v1/flights] Error:', msg);
    return Errors.internalError('Failed to search flight offers');
  }
}
