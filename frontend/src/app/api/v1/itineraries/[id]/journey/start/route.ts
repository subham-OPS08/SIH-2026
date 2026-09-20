/**
 * POST /api/v1/itineraries/:id/journey/start
 * Activates live Journey Mode for an itinerary.
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import type { Itinerary, StopStatus } from '@/src/types/itinerary';

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

function getStore(): Map<string, Itinerary & { _ownerId?: string; _journeyState?: unknown }> {
  const g = globalThis as typeof globalThis & {
    __bsyItineraryStore?: Map<string, Itinerary & { _ownerId?: string; _journeyState?: unknown }>;
  };
  if (!g.__bsyItineraryStore) {
    g.__bsyItineraryStore = new Map();
  }
  return g.__bsyItineraryStore;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const key = getRateLimitKey(req, 'journey-start');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  const resolvedParams = await params;
  const id = resolvedParams?.id ? decodeURIComponent(resolvedParams.id) : '';
  if (!id) return Errors.badRequest('Itinerary ID is required.');

  try {
    const store = getStore();
    const itinerary = store.get(id);
    if (!itinerary) return Errors.notFound('Itinerary');

    // First stop becomes ACTIVE, others PLANNED
    const updatedDays = itinerary.days.map((d, dIdx) => ({
      ...d,
      items: d.items.map((item, iIdx) => ({
        ...item,
        status: (dIdx === 0 && iIdx === 0 ? 'ACTIVE' : 'PLANNED') as StopStatus,
      })),
    }));

    const journeyState = {
      status: 'IN_PROGRESS',
      startedAt: new Date().toISOString(),
      activeDayNumber: 1,
      activeStopIndex: 0,
      totalStops: updatedDays.reduce((acc, d) => acc + d.items.length, 0),
      completedStops: 0,
    };

    store.set(id, {
      ...itinerary,
      days: updatedDays,
      _journeyState: journeyState,
    });

    return ok({
      journeyStatus: 'ACTIVE',
      itineraryId: id,
      journeyState,
      message: 'Journey Mode activated. Live navigation and progress tracking started.',
    });
  } catch (err) {
    console.error(`[POST /api/v1/itineraries/${id}/journey/start]`, err);
    return Errors.internalError('Failed to start journey');
  }
}
