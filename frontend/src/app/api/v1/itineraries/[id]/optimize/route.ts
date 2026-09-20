/**
 * POST /api/v1/itineraries/:id/optimize
 * Returns optimization proposal with changes, warnings, and recommendations.
 * Follows Phase 11 contract: proposal returned for user review; never automatically applied.
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { RecommendationEngine } from '@/src/lib/itinerary/recommendationEngine';
import type { Itinerary, TravelStyle } from '@/src/types/itinerary';

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

function getStore(): Map<string, Itinerary & { _ownerId?: string }> {
  const g = globalThis as typeof globalThis & {
    __bsyItineraryStore?: Map<string, Itinerary & { _ownerId?: string }>;
  };
  if (!g.__bsyItineraryStore) {
    g.__bsyItineraryStore = new Map();
  }
  return g.__bsyItineraryStore;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const key = getRateLimitKey(req, 'itinerary-optimize');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  const resolvedParams = await params;
  const id = resolvedParams?.id ? decodeURIComponent(resolvedParams.id) : '';
  if (!id) return Errors.badRequest('Itinerary ID is required.');

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Body optional
    }

    const store = getStore();
    let itinerary = store.get(id);

    if (!itinerary && body.itinerary) {
      itinerary = body.itinerary as Itinerary;
    }

    if (!itinerary) return Errors.notFound('Itinerary');

    const targetStyle = (body.targetStyle as TravelStyle) || itinerary.travelStyle || 'BALANCED';
    const targetDays = typeof body.targetDays === 'number' ? body.targetDays : itinerary.durationDays;

    let result = RecommendationEngine.optimizeItinerary(itinerary, targetStyle);

    if (targetDays && targetDays !== itinerary.durationDays) {
      result = RecommendationEngine.scaleDuration(itinerary, targetDays);
    }

    return ok({
      proposalStatus: 'PENDING_USER_CONFIRMATION',
      itinerary: result.itinerary,
      changes: result.changes,
      feasibility: result.feasibility,
      recommendations: result.detourRecommendations,
      summary: result.summary,
      message: 'Optimization preview computed. Review the proposed changes before applying to your itinerary.',
    });
  } catch (err) {
    console.error(`[POST /api/v1/itineraries/${id}/optimize]`, err);
    return Errors.internalError('Failed to optimize itinerary');
  }
}
