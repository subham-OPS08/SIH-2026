/**
 * GET /api/v1/safety/advisories
 * Returns active verified travel advisories.
 *
 * Query params:
 *   territory  - TerritoryCode
 *   severity   - INFO | LOW | MEDIUM | HIGH | CRITICAL
 */

import { NextRequest } from 'next/server';
import { ok, Errors, parsePagination, buildPaginationMeta, paginate } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { VERIFIED_ADVISORIES } from '@/src/lib/fixtures';
import type { ActiveTravelAdvisory } from '@/src/types';

const VALID_SEVERITIES = new Set(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'advisories');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    const { searchParams } = req.nextUrl;
    const territory = searchParams.get('territory');
    const severity = searchParams.get('severity');

    if (severity && !VALID_SEVERITIES.has(severity)) {
      return Errors.badRequest(`Invalid severity: "${severity}".`);
    }

    let results: ActiveTravelAdvisory[] = VERIFIED_ADVISORIES;

    if (territory) results = results.filter(a => a.territoryId === territory);
    if (severity) results = results.filter(a => a.severity === severity);

    // Sort by severity (CRITICAL first)
    const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
    results = results.sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));

    const { page, limit } = parsePagination(req);
    const paged = paginate(results, page, limit);
    const meta = buildPaginationMeta(page, limit, results.length);

    return ok(paged, {
      ...meta,
      lastUpdated: '2026-08-26',
      source: 'PRIMARY_GOVERNMENT',
    });
  } catch (err) {
    console.error('[GET /api/v1/safety/advisories]', err);
    return Errors.internalError();
  }
}
