/**
 * GET /api/v1/festivals
 * Paginated list of verified festivals with date precision preservation.
 *
 * CRITICAL: Never invent or coerce approximate dates into exact dates.
 * The datePrecision field (EXACT_DATE | DATE_RANGE | MONTH | WEEK_OF_MONTH | SEASON | TBD)
 * is always preserved in the API response.
 *
 * Query params:
 *   territory     - TerritoryCode
 *   category      - FestivalCategory
 *   month         - 1-12 (filters by start month if precision is EXACT_DATE or DATE_RANGE)
 *   page, limit
 */

import { NextRequest } from 'next/server';
import { ok, Errors, parsePagination, buildPaginationMeta, paginate } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { VERIFIED_FESTIVALS } from '@/src/lib/fixtures';
import type { Festival } from '@/src/types';

const VALID_TERRITORY_CODES = new Set([
  'ANDAMAN_NICOBAR', 'CHANDIGARH', 'DNH_DD', 'DELHI',
  'JAMMU_KASHMIR', 'LADAKH', 'LAKSHADWEEP', 'PUDUCHERRY',
]);

const VALID_FESTIVAL_CATEGORIES = new Set([
  'CULTURAL', 'FOOD_CULINARY', 'HERITAGE', 'MUSIC_DANCE', 'RELIGIOUS', 'ADVENTURE_SPORTS',
]);

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'festivals');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    const { searchParams } = req.nextUrl;
    const territory = searchParams.get('territory');
    const category = searchParams.get('category');
    const monthParam = searchParams.get('month');

    if (territory && !VALID_TERRITORY_CODES.has(territory)) {
      return Errors.badRequest(`Invalid territory code: "${territory}".`);
    }
    if (category && !VALID_FESTIVAL_CATEGORIES.has(category)) {
      return Errors.badRequest(`Invalid festival category: "${category}".`);
    }

    let month: number | null = null;
    if (monthParam) {
      month = parseInt(monthParam, 10);
      if (isNaN(month) || month < 1 || month > 12) {
        return Errors.badRequest('Month must be a number between 1 and 12.');
      }
    }

    let results: Festival[] = VERIFIED_FESTIVALS;

    if (territory) {
      results = results.filter(f => f.territoryId === territory);
    }
    if (category) {
      results = results.filter(f => f.category === category);
    }
    if (month) {
      results = results.filter(f => {
        if (!f.startDate) return false;
        const d = new Date(f.startDate);
        return !isNaN(d.getTime()) && d.getMonth() + 1 === month;
      });
    }

    // Sort: exact dates first, then approximate, then TBD
    const precisionOrder: Record<string, number> = {
      EXACT_DATE: 0, DATE_RANGE: 1, MONTH: 2, WEEK_OF_MONTH: 3, SEASON: 4, ANNUAL: 5, TBD: 6,
    };
    results = results.sort((a, b) => {
      const ao = precisionOrder[a.datePrecision] ?? 7;
      const bo = precisionOrder[b.datePrecision] ?? 7;
      if (ao !== bo) return ao - bo;
      // Within same precision, sort by start date
      if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
      return 0;
    });

    const { page, limit } = parsePagination(req);
    const paged = paginate(results, page, limit);
    const meta = buildPaginationMeta(page, limit, results.length);

    return ok(paged, {
      ...meta,
      lastUpdated: '2026-08-26',
      source: 'VERIFIED_GOVERNMENT',
      datePrecisionNote: 'datePrecision field indicates the accuracy of festival dates. Never assume an exact date when datePrecision is MONTH, SEASON, or TBD.',
    });
  } catch (err) {
    console.error('[GET /api/v1/festivals]', err);
    return Errors.internalError();
  }
}
