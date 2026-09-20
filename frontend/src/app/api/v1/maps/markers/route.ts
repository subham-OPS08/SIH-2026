/**
 * GET /api/v1/maps/markers
 * Returns verified map markers for destinations and emergency facilities.
 *
 * Query params:
 *   category  - ALL | Attractions | Emergency | Festivals
 *   territory - TerritoryCode
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { VERIFIED_DESTINATIONS, VERIFIED_EMERGENCY_FACILITIES, VERIFIED_FESTIVALS } from '@/src/lib/fixtures';
import type { MapMarker } from '@/src/types';

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'maps-markers');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    const { searchParams } = req.nextUrl;
    const category = searchParams.get('category') ?? 'ALL';
    const territory = searchParams.get('territory');

    const markers: MapMarker[] = [];

    if (category === 'ALL' || category === 'Attractions') {
      VERIFIED_DESTINATIONS
        .filter(d => !territory || d.territoryId === territory)
        .forEach(d => {
          markers.push({
            id: d.id,
            title: d.name,
            type: 'ATTRACTION',
            coordinates: d.coordinates,
            altitude: d.coordinates.altitude,
            category: d.type,
          });
        });
    }

    if (category === 'ALL' || category === 'Emergency') {
      VERIFIED_EMERGENCY_FACILITIES
        .filter(f => !territory || f.territoryId === territory)
        .forEach(f => {
          markers.push({
            id: f.id,
            title: f.name,
            type: 'EMERGENCY',
            coordinates: f.coordinates,
            isEmergency: true,
            category: f.type,
          });
        });
    }

    if (category === 'ALL' || category === 'Festivals') {
      // Festival markers require a destination coordinate
      VERIFIED_FESTIVALS
        .filter(f => !territory || f.territoryId === territory)
        .forEach(f => {
          // Attempt to find a destination in the same territory for geolocation
          const matchDest = VERIFIED_DESTINATIONS.find(d => d.territoryId === f.territoryId);
          if (matchDest) {
            markers.push({
              id: f.id,
              title: f.name,
              type: 'FESTIVAL',
              coordinates: matchDest.coordinates,
              category: f.category,
            });
          }
        });
    }

    return ok(markers, {
      total: markers.length,
      lastUpdated: '2026-08-26',
      source: 'VERIFIED_GOVERNMENT',
    });
  } catch (err) {
    console.error('[GET /api/v1/maps/markers]', err);
    return Errors.internalError();
  }
}
