/**
 * POST /api/v1/safety/sos
 * Emergency SOS trigger — records the event and returns verified nearest facilities.
 *
 * CRITICAL SAFETY RULES (Phase 1 PRD §19):
 * 1. Emergency contacts (112, 108, 100, 1363, 1554) are DETERMINISTIC — never AI-generated.
 * 2. This endpoint does NOT claim to automatically contact emergency services.
 * 3. The response provides: nearest verified facility, national contacts, and call action.
 * 4. The system surfaces verified emergency information — the USER must place the call.
 *
 * Request body:
 *   { latitude: number, longitude: number, accuracyMeters?: number, itineraryId?: string }
 */

import { NextRequest } from 'next/server';
import { ok, Errors, haversineDistance, isValidLatitude, isValidLongitude } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { VERIFIED_EMERGENCY_FACILITIES, VERIFIED_NATIONAL_CONTACTS } from '@/src/lib/fixtures';

// In-memory SOS event log (replace with PostgreSQL in production)
interface SOSEvent {
  id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  itineraryId?: string;
  status: 'ACTIVE_EMERGENCY';
}
const sosLog: SOSEvent[] = [];

export async function POST(req: NextRequest) {
  // SOS must not be aggressively rate-limited — allow 20/min
  const key = getRateLimitKey(req, 'sos');
  const rl = checkRateLimit(key, RATE_LIMITS.SOS);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Request body must be valid JSON.');
    }

    const b = body as Record<string, unknown>;
    const latitude = typeof b.latitude === 'number' ? b.latitude : parseFloat(String(b.latitude));
    const longitude = typeof b.longitude === 'number' ? b.longitude : parseFloat(String(b.longitude));

    if (!isValidLatitude(latitude)) {
      return Errors.badRequest('latitude must be a valid decimal number between -90 and 90.');
    }
    if (!isValidLongitude(longitude)) {
      return Errors.badRequest('longitude must be a valid decimal number between -180 and 180.');
    }

    const accuracyMeters = typeof b.accuracyMeters === 'number' ? b.accuracyMeters : undefined;
    const itineraryId = typeof b.itineraryId === 'string' ? b.itineraryId : undefined;

    // Log the SOS event
    const event: SOSEvent = {
      id: `sos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      latitude,
      longitude,
      ...(accuracyMeters !== undefined && { accuracyMeters }),
      ...(itineraryId && { itineraryId }),
      status: 'ACTIVE_EMERGENCY',
    };
    sosLog.push(event);

    // Find nearest hospital (real Haversine distance — not index[0])
    const facilitiesWithDistance = VERIFIED_EMERGENCY_FACILITIES
      .map(f => ({
        ...f,
        distanceKm: haversineDistance(latitude, longitude, f.coordinates.lat, f.coordinates.lng),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const nearestHospital = facilitiesWithDistance.find(
      f => f.type === 'HOSPITAL' || f.type === 'CLINIC'
    ) ?? facilitiesWithDistance[0] ?? null;

    const nearestPolice = facilitiesWithDistance.find(f => f.type === 'POLICE') ?? null;

    return ok({
      sosEventId: event.id,
      timestamp: event.timestamp,
      location: { lat: latitude, lng: longitude, accuracyMeters },
      nearestHospital,
      nearestPolice,
      nationalContacts: VERIFIED_NATIONAL_CONTACTS,
      status: 'ACTIVE_EMERGENCY' as const,
      callToAction: 'Dial 112 immediately for national emergency response. This system surfaces verified facility information but does NOT automatically contact emergency services.',
    }, {
      source: 'PRIMARY_GOVERNMENT',
      warning: 'EMERGENCY — Dial 112 (National Emergency) immediately.',
    });
  } catch (err) {
    console.error('[POST /api/v1/safety/sos]', err);
    return Errors.internalError('SOS processing failed. Dial 112 immediately.');
  }
}
