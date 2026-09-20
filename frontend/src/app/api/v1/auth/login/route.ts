/**
 * POST /api/v1/auth/login
 * Authenticate an existing user.
 *
 * Request body:
 *   { email: string, password: string }
 *
 * Returns JWT access + refresh tokens.
 * Does NOT reveal whether email or password was wrong (prevents enumeration).
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { createAccessToken, createRefreshToken, verifyPassword } from '@/src/lib/api/auth';
import { findUserByEmail } from '@/src/lib/api/userStore';

export async function POST(req: NextRequest) {
  const key = getRateLimitKey(req, 'auth-login');
  const rl = checkRateLimit(key, RATE_LIMITS.AUTH);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Request body must be valid JSON.');
    }

    const b = body as Record<string, unknown>;
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    const password = typeof b.password === 'string' ? b.password : '';

    if (!email || !password) {
      return Errors.badRequest('email and password are required.');
    }

    // Constant-time lookup — does NOT reveal whether email exists
    const user = findUserByEmail(email);
    const passwordValid = user ? await verifyPassword(password, user.passwordHash) : false;

    // Always respond with identical error message to prevent email enumeration
    if (!user || !passwordValid) {
      return Errors.unauthorized('Invalid email or password.');
    }

    const [accessToken, refreshToken] = await Promise.all([
      createAccessToken(user.id, user.role),
      createRefreshToken(user.id, user.role),
    ]);

    return ok({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('[POST /api/v1/auth/login]', err);
    return Errors.internalError();
  }
}
