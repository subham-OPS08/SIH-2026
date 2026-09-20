/**
 * GET /api/v1/safety/alerts
 * Production-Grade Global Live Travel Alert Endpoint for Dishaara
 *
 * Sourced exclusively from verified government and official authorities.
 * Strictly filters out expired, unverified, or irrelevant alerts.
 *
 * Query params:
 *   territoryId   - Filter by territory slug or code
 *   destinationId - Filter by specific destination id/slug
 *   startDate     - Travel window start (ISO string YYYY-MM-DD)
 *   endDate       - Travel window end (ISO string YYYY-MM-DD)
 *   severity      - INFO | ADVISORY | WARNING | CRITICAL
 */

import { NextRequest, NextResponse } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { VERIFIED_TRAVEL_ALERTS } from '@/src/lib/data/verifiedAlerts';
import type { TravelAlert, AlertSeverity } from '@/src/types/travelAlert';

const VALID_SEVERITIES = new Set<AlertSeverity>(['INFO', 'ADVISORY', 'WARNING', 'CRITICAL']);
const VERIFIED_STATUSES = new Set(['VERIFIED', 'VERIFIED_STATIC', 'LIVE', 'UPDATED']);

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'travel-alerts');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    const { searchParams } = req.nextUrl;
    const territoryId = searchParams.get('territoryId')?.toLowerCase().trim();
    const destinationId = searchParams.get('destinationId')?.toLowerCase().trim();
    const startDate = searchParams.get('startDate')?.trim();
    const endDate = searchParams.get('endDate')?.trim();
    const severityParam = searchParams.get('severity')?.toUpperCase().trim() as AlertSeverity | undefined;

    if (severityParam && !VALID_SEVERITIES.has(severityParam)) {
      return Errors.badRequest(`Invalid severity: "${severityParam}". Allowed values: INFO, ADVISORY, WARNING, CRITICAL.`);
    }

    const now = new Date();

    // 1. Filter only verified and currently active alerts
    let results: TravelAlert[] = VERIFIED_TRAVEL_ALERTS.filter((alert) => {
      // Must have verified status (UNAVAILABLE / UNKNOWN are rejected)
      if (!VERIFIED_STATUSES.has(alert.verification_status)) {
        return false;
      }

      // Check current expiration
      const effectiveUntil = new Date(alert.effective_until);
      if (isNaN(effectiveUntil.getTime()) || effectiveUntil < now) {
        return false; // Expired
      }

      return true;
    });

    // 2. Filter by territory if specified
    if (territoryId) {
      results = results.filter((alert) =>
        alert.affected_territory_ids.some((t) =>
          t.toLowerCase().includes(territoryId) || territoryId.includes(t.toLowerCase())
        )
      );
    }

    // 3. Filter by destination if specified
    if (destinationId) {
      results = results.filter((alert) =>
        alert.affected_destination_ids.some((d) =>
          d.toLowerCase().includes(destinationId) || destinationId.includes(d.toLowerCase())
        )
      );
    }

    // 4. Filter by travel dates if specified
    if (startDate || endDate) {
      const tripStart = startDate ? new Date(startDate) : now;
      const tripEnd = endDate ? new Date(endDate) : new Date(tripStart.getTime() + 14 * 86400000);

      if (!isNaN(tripStart.getTime()) && !isNaN(tripEnd.getTime())) {
        results = results.filter((alert) => {
          const alertStart = new Date(alert.effective_from);
          const alertEnd = new Date(alert.effective_until);

          // Overlap: alertStart <= tripEnd && alertEnd >= tripStart
          return alertStart <= tripEnd && alertEnd >= tripStart;
        });
      }
    }

    // 5. Filter by severity if specified
    if (severityParam) {
      results = results.filter((alert) => alert.severity === severityParam);
    }

    // 6. Sort by severity: CRITICAL (0) > WARNING (1) > ADVISORY (2) > INFO (3), then newest
    const severityScore: Record<AlertSeverity, number> = {
      CRITICAL: 0,
      WARNING: 1,
      ADVISORY: 2,
      INFO: 3,
    };

    results.sort((a, b) => {
      const diff = severityScore[a.severity] - severityScore[b.severity];
      if (diff !== 0) return diff;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    const response = ok({
      alerts: results,
      total: results.length,
      last_fetched_at: now.toISOString(),
      freshness_ttl: 300,
    });

    // Cache-control for production resilience
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (err) {
    console.error('Error fetching verified travel alerts:', err);
    return Errors.internal('Failed to retrieve verified travel alerts.');
  }
}
