/**
 * GET /api/v1/destinations/:slug
 * Returns a single destination by slug with full detail.
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { VERIFIED_DESTINATIONS } from '@/src/lib/fixtures';

interface RouteParams {
  params: Promise<{ slug: string }> | { slug: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const key = getRateLimitKey(req, 'destination-detail');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  const resolvedParams = await params;
  const slug = resolvedParams?.slug ? decodeURIComponent(resolvedParams.slug) : "";

  if (!slug || slug.length > 150) return Errors.badRequest('Invalid destination slug.');

  try {
    const destination = VERIFIED_DESTINATIONS.find(
      d => d.slug === slug || d.id === slug || d.slug.toLowerCase() === slug.toLowerCase() || d.id.toLowerCase() === slug.toLowerCase()
    );
    if (!destination) return Errors.notFound(`Destination "${slug}"`);

    return ok(destination, {
      lastUpdated: '2026-08-26',
      source: 'VERIFIED_GOVERNMENT',
    });
  } catch (err) {
    console.error(`[GET /api/v1/destinations/${slug}]`, err);
    return Errors.internalError();
  }
}
