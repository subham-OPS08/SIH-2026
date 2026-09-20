/**
 * GET /api/v1/territories/:slug
 * Returns a single Union Territory by slug, including its destinations and festivals.
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import {
  VERIFIED_TERRITORIES,
  VERIFIED_DESTINATIONS,
  VERIFIED_FESTIVALS,
} from '@/src/lib/fixtures';

interface RouteParams {
  params: Promise<{ slug: string }> | { slug: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const key = getRateLimitKey(req, 'territory-detail');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  const resolvedParams = await params;
  const slug = resolvedParams?.slug ? decodeURIComponent(resolvedParams.slug) : "";

  if (!slug || slug.length > 100) return Errors.badRequest('Invalid territory slug.');

  try {
    const territory = VERIFIED_TERRITORIES.find(
      t => t.slug === slug || t.id.toLowerCase() === slug.toLowerCase() || t.code.toLowerCase() === slug.toLowerCase() || t.slug.toLowerCase() === slug.toLowerCase()
    );
    if (!territory) return Errors.notFound(`Union Territory "${slug}"`);

    // Enrich with associated destinations and festivals
    const destinations = VERIFIED_DESTINATIONS.filter(d => d.territoryId === territory.code || d.territoryId === territory.id);
    const festivals = VERIFIED_FESTIVALS.filter(f => f.territoryId === territory.code || f.territoryId === territory.id);

    return ok({
      ...territory,
      destinations,
      festivals,
    }, {
      lastUpdated: '2026-08-26',
      source: 'VERIFIED_GOVERNMENT',
    });
  } catch (err) {
    console.error(`[GET /api/v1/territories/${slug}]`, err);
    return Errors.internalError();
  }
}
