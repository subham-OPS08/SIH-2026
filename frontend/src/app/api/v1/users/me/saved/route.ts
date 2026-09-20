/**
 * GET/POST/DELETE /api/v1/users/me/saved
 * Manage the authenticated user's saved destinations (wishlist).
 *
 * GET    — Return saved destinations
 * POST   — Save a destination { destinationId: string }
 * DELETE — Remove a saved destination ?destinationId=
 *
 * Duplicate saves are silently ignored (idempotent POST).
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { getAuthUser } from '@/src/lib/api/auth';
import { findUserById, addSavedDestination, removeSavedDestination, sanitizeUser } from '@/src/lib/api/userStore';
import { VERIFIED_DESTINATIONS } from '@/src/lib/fixtures';

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'saved-get');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return Errors.unauthorized();

    const user = findUserById(authUser.id);
    if (!user) return Errors.notFound('User');

    const saved = VERIFIED_DESTINATIONS.filter(d =>
      user.savedDestinationIds.includes(d.id)
    );

    return ok(saved, { total: saved.length });
  } catch (err) {
    console.error('[GET /api/v1/users/me/saved]', err);
    return Errors.internalError();
  }
}

export async function POST(req: NextRequest) {
  const key = getRateLimitKey(req, 'saved-post');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return Errors.unauthorized();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Request body must be valid JSON.');
    }

    const { destinationId } = body as { destinationId?: string };
    if (!destinationId || typeof destinationId !== 'string') {
      return Errors.badRequest('destinationId is required.');
    }

    // Verify destination exists
    const destination = VERIFIED_DESTINATIONS.find(d => d.id === destinationId);
    if (!destination) return Errors.notFound(`Destination "${destinationId}"`);

    addSavedDestination(authUser.id, destinationId);
    return ok({ saved: true, destinationId });
  } catch (err) {
    console.error('[POST /api/v1/users/me/saved]', err);
    return Errors.internalError();
  }
}

export async function DELETE(req: NextRequest) {
  const key = getRateLimitKey(req, 'saved-delete');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return Errors.unauthorized();

    const destinationId = req.nextUrl.searchParams.get('destinationId');
    if (!destinationId) return Errors.badRequest('destinationId query param is required.');

    removeSavedDestination(authUser.id, destinationId);
    return ok({ removed: true, destinationId });
  } catch (err) {
    console.error('[DELETE /api/v1/users/me/saved]', err);
    return Errors.internalError();
  }
}
