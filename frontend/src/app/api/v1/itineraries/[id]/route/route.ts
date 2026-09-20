/**
 * POST /api/v1/itineraries/:id/route
 * Calculate full route polyline, distance, and duration across all sequential stops in an itinerary.
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { calculateRouteWithFallback } from '@/src/lib/providers/maps';
import { RouteWaypoint } from '@/src/lib/providers/types';
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

export async function POST(req: NextRequest, { params }: RouteParams) {
  const key = getRateLimitKey(req, 'itinerary-route');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  const resolvedParams = await params;
  const id = resolvedParams?.id ? decodeURIComponent(resolvedParams.id) : '';
  if (!id) return Errors.badRequest('Itinerary ID is required.');

  try {
    const store = getStore();
    let itinerary = store.get(id);

    // Support payload body if sent directly from client session
    if (!itinerary) {
      try {
        const body = await req.json();
        if (body && body.days) {
          itinerary = body as Itinerary;
        }
      } catch {
        // no body provided
      }
    }

    if (!itinerary) return Errors.notFound('Itinerary');

    // Extract all waypoints in chronological sequence
    const waypoints: RouteWaypoint[] = [];

    itinerary.days.forEach((day, dayIdx) => {
      day.items.forEach((item, itemIdx) => {
        let lat = item.location?.lat;
        let lng = item.location?.lng;

        if (!lat || !lng) {
          const dest = VERIFIED_DESTINATIONS.find(
            (d) => d.id === item.destinationId || d.slug === item.destinationId || d.name.toLowerCase() === item.title.toLowerCase()
          );
          if (dest) {
            lat = dest.coordinates.lat;
            lng = dest.coordinates.lng;
          }
        }

        if (typeof lat === 'number' && typeof lng === 'number') {
          waypoints.push({
            lat,
            lng,
            name: `${item.title} (Day ${day.dayNumber})`,
          });
        }
      });
    });

    if (waypoints.length < 2) {
      return ok({
        routeAvailable: false,
        message: 'At least 2 coordinate waypoints required to calculate route.',
        waypoints,
        totalDistanceKm: 0,
        totalDurationMinutes: 0,
        geometryGeoJSON: null,
      });
    }

    const routeResult = await calculateRouteWithFallback(waypoints, 'driving');

    return ok({
      routeAvailable: true,
      itineraryId: id,
      totalDistanceKm: routeResult.totalDistanceKm,
      totalDurationMinutes: routeResult.totalDurationMinutes,
      geometryGeoJSON: routeResult.geometryGeoJSON,
      segments: routeResult.segments,
      waypoints: routeResult.waypoints,
      metadata: routeResult.metadata,
    });
  } catch (err) {
    console.error(`[POST /api/v1/itineraries/${id}/route]`, err);
    return Errors.internalError('Failed to compute route trajectory');
  }
}
