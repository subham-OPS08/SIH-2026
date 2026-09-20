/**
 * GET/PATCH /api/v1/users/me
 * Get and update the authenticated user's profile.
 * Requires Bearer token authentication.
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { getAuthUser } from '@/src/lib/api/auth';
import { findUserById, updateUser, sanitizeUser } from '@/src/lib/api/userStore';

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'users-me-get');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return Errors.unauthorized();

    const user = findUserById(authUser.id);
    if (!user) return Errors.notFound('User');

    return ok(sanitizeUser(user));
  } catch (err) {
    console.error('[GET /api/v1/users/me]', err);
    return Errors.internalError();
  }
}

export async function PATCH(req: NextRequest) {
  const key = getRateLimitKey(req, 'users-me-patch');
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

    const b = body as Record<string, unknown>;
    const updates: { name?: string; phone?: string } = {};

    if (b.name !== undefined) {
      if (typeof b.name !== 'string' || b.name.trim().length < 2) {
        return Errors.badRequest('name must be at least 2 characters.');
      }
      updates.name = b.name.trim();
    }

    if (b.phone !== undefined) {
      if (typeof b.phone !== 'string' || b.phone.trim().length < 5) {
        return Errors.badRequest('phone must be a valid number.');
      }
      updates.phone = b.phone.trim();
    }

    const updated = updateUser(authUser.id, updates);
    if (!updated) return Errors.notFound('User');

    return ok(updated);
  } catch (err) {
    console.error('[PATCH /api/v1/users/me]', err);
    return Errors.internalError();
  }
}
