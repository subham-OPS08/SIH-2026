/**
 * GET /api/v1/destinations
 * Paginated, filterable list of verified destinations across all 8 UTs.
 *
 * Query params:
 *   territory  - TerritoryCode (e.g. LADAKH)
 *   type       - DestinationType (e.g. LAKE, BEACH)
 *   search     - case-insensitive name search
 *   page       - default 1
 *   limit      - default 20, max 100
 */

import { NextRequest } from 'next/server';
import { ok, Errors, parsePagination, buildPaginationMeta, paginate, sanitizeString } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { VERIFIED_DESTINATIONS } from '@/src/lib/fixtures';
import type { Destination } from '@/src/types';

const VALID_TERRITORY_CODES = new Set([
  'ANDAMAN_NICOBAR', 'CHANDIGARH', 'DNH_DD', 'DELHI',
  'JAMMU_KASHMIR', 'LADAKH', 'LAKSHADWEEP', 'PUDUCHERRY',
]);

const VALID_DESTINATION_TYPES = new Set([
  'LAKE', 'HERITAGE', 'BEACH', 'ISLAND', 'MOUNTAIN', 'VALLEY',
  'PARK', 'CITY', 'GARDEN', 'RELIGIOUS', 'OTHER',
]);

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'destinations');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    const { searchParams } = req.nextUrl;
    const territory = searchParams.get('territory');
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    // Validate filters (prevent arbitrary injection through query params)
    if (territory && !VALID_TERRITORY_CODES.has(territory)) {
      return Errors.badRequest(`Invalid territory code: "${territory}".`);
    }
    if (type && !VALID_DESTINATION_TYPES.has(type)) {
      return Errors.badRequest(`Invalid destination type: "${type}".`);
    }
    if (search && search.length > 100) {
      return Errors.badRequest('Search query too long.');
    }

    let results: Destination[] = VERIFIED_DESTINATIONS;

    if (territory) {
      results = results.filter(d => d.territoryId === territory);
    }
    if (type) {
      results = results.filter(d => d.type === type);
    }
    if (search) {
      const q = sanitizeString(search).toLowerCase();
      results = results.filter(
        d =>
          d.name.toLowerCase().includes(q) ||
          d.shortDescription?.toLowerCase().includes(q)
      );
    }

    const { page, limit } = parsePagination(req);
    const paged = paginate(results, page, limit);
    const meta = buildPaginationMeta(page, limit, results.length);

    return ok(paged, {
      ...meta,
      lastUpdated: '2026-08-26',
      source: 'VERIFIED_GOVERNMENT',
    });
  } catch (err) {
    console.error('[GET /api/v1/destinations]', err);
    return Errors.internalError();
  }
}
