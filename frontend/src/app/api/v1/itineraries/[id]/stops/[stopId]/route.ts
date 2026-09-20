/**
 * PATCH /api/v1/itineraries/:id/stops/:stopId
 * Updates stop status (PLANNED | ACTIVE | COMPLETED | SKIPPED | REMOVED) and triggers recalculation.
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import type { Itinerary, StopStatus } from '@/src/types/itinerary';

interface RouteParams {
  params: Promise<{ id: string; stopId: string }> | { id: string; stopId: string };
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

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const key = getRateLimitKey(req, 'itinerary-stop-patch');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  const resolvedParams = await params;
  const id = resolvedParams?.id ? decodeURIComponent(resolvedParams.id) : '';
  const stopId = resolvedParams?.stopId ? decodeURIComponent(resolvedParams.stopId) : '';

  if (!id || !stopId) return Errors.badRequest('Itinerary ID and Stop ID are required.');

  try {
    let body: { status?: string; notes?: string; durationMinutes?: number } = {};
    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Request body must be valid JSON.');
    }

    const store = getStore();
    const itinerary = store.get(id);
    if (!itinerary) return Errors.notFound('Itinerary');

    let foundStop = false;
    let completedCount = 0;
    let totalCount = 0;

    const updatedDays = itinerary.days.map((day) => ({
      ...day,
      items: day.items.map((item) => {
        totalCount++;
        if (item.id === stopId) {
          foundStop = true;
          const updatedItem = {
            ...item,
            ...(body.status ? { status: body.status as StopStatus } : {}),
            ...(body.notes ? { notes: body.notes } : {}),
            ...(typeof body.durationMinutes === 'number' ? { durationMinutes: body.durationMinutes } : {}),
          };
          if (updatedItem.status === 'COMPLETED') completedCount++;
          return updatedItem;
        }
        if (item.status === 'COMPLETED') completedCount++;
        return item;
      }),
    }));

    if (!foundStop) return Errors.notFound('Stop');

    const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const updatedItinerary: Itinerary = {
      ...itinerary,
      days: updatedDays,
    };

    store.set(id, updatedItinerary);

    return ok({
      itineraryId: id,
      stopId,
      updatedStatus: body.status,
      completedStops: completedCount,
      totalStops: totalCount,
      progressPercentage,
      progressDisplay: `${completedCount} / ${totalCount} stops completed (${progressPercentage}%)`,
      itinerary: updatedItinerary,
    });
  } catch (err) {
    console.error(`[PATCH /api/v1/itineraries/${id}/stops/${stopId}]`, err);
    return Errors.internalError('Failed to update stop status');
  }
}
