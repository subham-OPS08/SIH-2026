/**
 * GET/POST /api/v1/itineraries
 *
 * GET  — List user's itineraries (requires auth) or guest itinerary by session
 * POST — Create a new itinerary
 *
 * Authentication:
 * - Authenticated users: itineraries stored in server memory keyed by user ID.
 * - Guest users: itineraries stored keyed by guest_session_id (passed in body).
 *   Guest data migrates to user account on registration (Phase 1 PRD §22.1).
 */

import { NextRequest } from 'next/server';
import { ok, created, Errors, parsePagination, buildPaginationMeta, paginate } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { getAuthUser } from '@/src/lib/api/auth';
import type { Itinerary } from '@/src/types';

// In-memory itinerary store (replace with Prisma + PostgreSQL in production)
const itineraryStore = new Map<string, Itinerary>();
let itineraryCounter = 1;

function generateItineraryId(): string {
  return `itin-${Date.now()}-${(itineraryCounter++).toString().padStart(4, '0')}`;
}

// ============================================================
// GET /api/v1/itineraries
// ============================================================
export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'itineraries-get');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    const authUser = await getAuthUser(req);
    const guestSessionId = req.nextUrl.searchParams.get('guest_session_id');

    if (!authUser && !guestSessionId) {
      return Errors.unauthorized('Authentication or guest_session_id required.');
    }

    // Retrieve itineraries owned by this user or guest session
    const ownerId = authUser ? `user:${authUser.id}` : `guest:${guestSessionId}`;
    const all = Array.from(itineraryStore.values()).filter(
      (it: Itinerary & { _ownerId?: string }) => (it as Itinerary & { _ownerId?: string })._ownerId === ownerId
    );

    const { page, limit } = parsePagination(req);
    const paged = paginate(all, page, limit);
    const meta = buildPaginationMeta(page, limit, all.length);

    return ok(paged, meta);
  } catch (err) {
    console.error('[GET /api/v1/itineraries]', err);
    return Errors.internalError();
  }
}

// ============================================================
// POST /api/v1/itineraries
// ============================================================
export async function POST(req: NextRequest) {
  const key = getRateLimitKey(req, 'itineraries-post');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Request body must be valid JSON.');
    }

    const b = body as Record<string, unknown>;

    // Validate required fields
    if (!b.title || typeof b.title !== 'string' || b.title.trim().length < 3) {
      return Errors.badRequest('title is required and must be at least 3 characters.');
    }
    if (!b.territoryId || typeof b.territoryId !== 'string') {
      return Errors.badRequest('territoryId is required.');
    }
    if (!b.durationDays || typeof b.durationDays !== 'number' || b.durationDays < 1 || b.durationDays > 30) {
      return Errors.badRequest('durationDays must be a number between 1 and 30.');
    }

    const authUser = await getAuthUser(req);
    const guestSessionId = typeof b.guestSessionId === 'string' ? b.guestSessionId : undefined;

    if (!authUser && !guestSessionId) {
      return Errors.badRequest('Either a valid auth token or guestSessionId is required.');
    }

    const ownerId = authUser ? `user:${authUser.id}` : `guest:${guestSessionId}`;
    const id = generateItineraryId();
    const now = new Date().toISOString();

    const itinerary: Itinerary & { _ownerId: string; _createdAt: string } = {
      id,
      title: b.title.toString().trim(),
      territoryId: b.territoryId as Itinerary['territoryId'],
      territoryName: typeof b.territoryName === 'string' ? b.territoryName : '',
      durationDays: b.durationDays as number,
      travellers: typeof b.travellers === 'number' ? b.travellers : 1,
      startDate: typeof b.startDate === 'string' ? b.startDate : undefined,
      endDate: typeof b.endDate === 'string' ? b.endDate : undefined,
      travelStyle: (b.travelStyle as Itinerary['travelStyle']) ?? 'BALANCED',
      estimatedBudget: typeof b.estimatedBudget === 'number' ? b.estimatedBudget : 0,
      days: Array.isArray(b.days) ? (b.days as Itinerary['days']) : [],
      _ownerId: ownerId,
      _createdAt: now,
    };

    itineraryStore.set(id, itinerary);

    return created(itinerary);
  } catch (err) {
    console.error('[POST /api/v1/itineraries]', err);
    return Errors.internalError();
  }
}
