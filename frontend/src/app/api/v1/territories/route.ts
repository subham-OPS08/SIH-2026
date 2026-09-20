/**
 * GET /api/v1/territories
 * Returns all 8 Union Territories with official source metadata.
 *
 * Query params:
 *   page   (default: 1)
 *   limit  (default: 10, max: 20)
 */

import { NextRequest } from 'next/server';
import { ok, Errors, parsePagination, buildPaginationMeta, paginate } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { VERIFIED_TERRITORIES } from '@/src/lib/fixtures';

export async function GET(req: NextRequest) {
  // Rate limiting
  const key = getRateLimitKey(req, 'territories');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    const { page, limit } = parsePagination(req);
    const all = VERIFIED_TERRITORIES;
    const paged = paginate(all, page, limit);
    const meta = buildPaginationMeta(page, limit, all.length);

    return ok(paged, {
      ...meta,
      lastUpdated: '2026-08-26',
      source: 'VERIFIED_GOVERNMENT',
      description: 'India\'s 8 Union Territories — sourced from official UT Administration and Ministry of Tourism portals.',
    });
  } catch (err) {
    console.error('[GET /api/v1/territories]', err);
    return Errors.internalError();
  }
}
