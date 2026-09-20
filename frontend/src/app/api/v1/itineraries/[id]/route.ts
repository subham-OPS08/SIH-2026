/**
 * GET/PATCH/DELETE /api/v1/itineraries/:id
 *
 * IDOR Protection: users can only access their own itineraries.
 * Ownership is derived from the authenticated session — never trusted from the client.
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { getAuthUser } from '@/src/lib/api/auth';
import type { Itinerary } from '@/src/types';

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
  const key = getRateLimitKey(req, 'itinerary-detail');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  const resolvedParams = await params;
  const id = resolvedParams?.id ? decodeURIComponent(resolvedParams.id) : "";
  if (!id) return Errors.badRequest('Itinerary ID is required.');

  try {
    const store = getStore();
    const itinerary = store.get(id);
    if (!itinerary) return Errors.notFound('Itinerary');

    // IDOR check — verify ownership
    const authUser = await getAuthUser(req);
    const guestSessionId = req.nextUrl.searchParams.get('guest_session_id');
    const ownerId = authUser ? `user:${authUser.id}` : guestSessionId ? `guest:${guestSessionId}` : null;

    if (itinerary._ownerId && ownerId !== itinerary._ownerId) {
      return Errors.forbidden('You do not have access to this itinerary.');
    }

    return ok(itinerary);
  } catch (err) {
    console.error(`[GET /api/v1/itineraries/${id}]`, err);
    return Errors.internalError();
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const key = getRateLimitKey(req, 'itinerary-patch');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  const resolvedParams = await params;
  const id = resolvedParams?.id ? decodeURIComponent(resolvedParams.id) : "";
  if (!id) return Errors.badRequest('Itinerary ID is required.');

  try {
    const store = getStore();
    const itinerary = store.get(id);
    if (!itinerary) return Errors.notFound('Itinerary');

    // IDOR check
    const authUser = await getAuthUser(req);
    const ownerId = authUser ? `user:${authUser.id}` : null;
    if (itinerary._ownerId && ownerId !== itinerary._ownerId) {
      return Errors.forbidden('You do not have permission to modify this itinerary.');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Request body must be valid JSON.');
    }

    const b = body as Partial<Itinerary>;

    const updated: Itinerary & { _ownerId?: string } = {
      ...itinerary,
      ...(b.title && typeof b.title === 'string' ? { title: b.title.trim() } : {}),
      ...(b.days ? { days: b.days } : {}),
      ...(b.startDate ? { startDate: b.startDate } : {}),
      ...(b.endDate ? { endDate: b.endDate } : {}),
      ...(typeof b.durationDays === 'number' ? { durationDays: b.durationDays } : {}),
      ...(typeof b.estimatedBudget === 'number' ? { estimatedBudget: b.estimatedBudget } : {}),
      ...(b.travelStyle ? { travelStyle: b.travelStyle } : {}),
    };

    store.set(id, updated);
    return ok(updated);
  } catch (err) {
    console.error(`[PATCH /api/v1/itineraries/${id}]`, err);
    return Errors.internalError();
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const resolvedParams = await params;
  const id = resolvedParams?.id ? decodeURIComponent(resolvedParams.id) : "";
  if (!id) return Errors.badRequest('Itinerary ID is required.');

  try {
    const store = getStore();
    const itinerary = store.get(id);
    if (!itinerary) return Errors.notFound('Itinerary');

    const authUser = await getAuthUser(req);
    const ownerId = authUser ? `user:${authUser.id}` : null;
    if (itinerary._ownerId && ownerId !== itinerary._ownerId) {
      return Errors.forbidden('You do not have permission to delete this itinerary.');
    }

    store.delete(id);
    return ok({ deleted: true, id });
  } catch (err) {
    console.error(`[DELETE /api/v1/itineraries/${id}]`, err);
    return Errors.internalError();
  }
}
