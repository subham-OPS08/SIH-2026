/**
 * GET /api/v1/itineraries/:id/recommendations
 * Route-aware recommendations with real detour computation.
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { SpatialEngine } from '@/src/lib/geospatial/spatialEngine';
import { VERIFIED_DESTINATIONS } from '@/src/lib/fixtures';
import type { Itinerary } from '@/src/types/itinerary';

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

export async function GET(req: NextRequest, { params }: RouteParams) {
  const key = getRateLimitKey(req, 'itinerary-recommendations');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  const resolvedParams = await params;
  const id = resolvedParams?.id ? decodeURIComponent(resolvedParams.id) : '';
  if (!id) return Errors.badRequest('Itinerary ID is required.');

  try {
    const store = getStore();
    const itinerary = store.get(id);

    const routeStops: Array<{ lat: number; lng: number; name: string; slug?: string }> = [];

    if (itinerary) {
      itinerary.days.forEach((d) => {
        d.items.forEach((item) => {
          let lat = item.location?.lat;
          let lng = item.location?.lng;
          if (!lat || !lng) {
            const dest = VERIFIED_DESTINATIONS.find((dest) => dest.id === item.destinationId || dest.slug === item.destinationId);
            if (dest) {
              lat = dest.coordinates.lat;
              lng = dest.coordinates.lng;
            }
          }
          if (typeof lat === 'number' && typeof lng === 'number') {
            routeStops.push({ lat, lng, name: item.title, slug: item.destinationId });
          }
        });
      });
    }

    const maxDetourParam = req.nextUrl.searchParams.get('max_detour_minutes');
    const maxDetourMins = maxDetourParam ? parseInt(maxDetourParam, 10) : 45;

    const recommendations = SpatialEngine.findRouteAwareRecommendations(
      routeStops,
      maxDetourMins,
      itinerary?.territoryId
    );

    return ok({
      itineraryId: id,
      count: recommendations.length,
      recommendations: recommendations.map((r) => ({
        id: r.candidateDestination.id,
        slug: r.candidateDestination.slug,
        name: r.candidateDestination.name,
        territoryName: r.candidateDestination.territoryName,
        type: r.candidateDestination.type,
        image: r.candidateDestination.image,
        coordinates: r.candidateDestination.coordinates,
        addedDistanceKm: r.addedDistanceKm,
        addedDurationMinutes: r.addedDurationMinutes,
        detourDisplay: r.detourDisplay,
        originLeg: `${r.originName} → ${r.destinationName}`,
        tagline: r.candidateDestination.tagline,
        shortDescription: r.candidateDestination.shortDescription,
        provenance: 'TomTom & PostGIS Route Corridor Engine',
      })),
    });
  } catch (err) {
    console.error(`[GET /api/v1/itineraries/${id}/recommendations]`, err);
    return Errors.internalError('Failed to calculate route-aware recommendations');
  }
}
