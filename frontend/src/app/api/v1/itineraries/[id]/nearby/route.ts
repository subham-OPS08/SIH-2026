/**
 * GET /api/v1/itineraries/:id/nearby
 * PostGIS-grounded nearby attractions around itinerary coordinates.
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
  const key = getRateLimitKey(req, 'itinerary-nearby');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  const resolvedParams = await params;
  const id = resolvedParams?.id ? decodeURIComponent(resolvedParams.id) : '';
  if (!id) return Errors.badRequest('Itinerary ID is required.');

  const radiusParam = req.nextUrl.searchParams.get('radius');
  const radiusKm = radiusParam ? Math.min(100, Math.max(5, parseInt(radiusParam, 10))) : 25;

  const latParam = req.nextUrl.searchParams.get('lat');
  const lngParam = req.nextUrl.searchParams.get('lng');

  try {
    let center = { lat: 34.1526, lng: 77.5771 }; // default Leh
    let territoryId: string | undefined;
    const excludeSlugs: string[] = [];

    if (latParam && lngParam) {
      center = { lat: parseFloat(latParam), lng: parseFloat(lngParam) };
    } else {
      const store = getStore();
      const itinerary = store.get(id);
      if (itinerary) {
        territoryId = itinerary.territoryId;
        itinerary.days.forEach((d) => {
          d.items.forEach((i) => {
            if (i.destinationId) excludeSlugs.push(i.destinationId);
            if (i.location) center = i.location;
          });
        });
      }
    }

    const nearby = SpatialEngine.findNearbyDestinations(center, radiusKm, territoryId, excludeSlugs);

    return ok({
      itineraryId: id,
      center,
      radiusKm,
      count: nearby.length,
      nearbyPlaces: nearby.map((n) => ({
        id: n.destination.id,
        slug: n.destination.slug,
        name: n.destination.name,
        territoryName: n.destination.territoryName,
        type: n.destination.type,
        coordinates: n.destination.coordinates,
        distanceKm: n.distanceKm,
        estimatedDriveMinutes: n.estimatedDriveMinutes,
        image: n.destination.image,
        tagline: n.destination.tagline,
        shortDescription: n.destination.shortDescription,
        isMarquee: n.isMarquee,
        source: 'PostGIS Grounded Spatial Engine',
      })),
    });
  } catch (err) {
    console.error(`[GET /api/v1/itineraries/${id}/nearby]`, err);
    return Errors.internalError('Failed to query nearby destinations');
  }
}
