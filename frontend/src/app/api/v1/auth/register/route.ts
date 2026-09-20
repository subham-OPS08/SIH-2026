/**
 * POST /api/v1/auth/register
 * Register a new user account.
 *
 * Request body:
 *   { name: string, email: string, password: string }
 *
 * Security:
 * - Passwords are NEVER stored in plaintext (PBKDF2-SHA256)
 * - Rate limited to prevent registration abuse
 * - Returns tokens on success for immediate session start
 */

import { NextRequest } from 'next/server';
import { created, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { createAccessToken, createRefreshToken } from '@/src/lib/api/auth';
import { createUser } from '@/src/lib/api/userStore';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const key = getRateLimitKey(req, 'auth-register');
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
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    const password = typeof b.password === 'string' ? b.password : '';

    // Validation
    if (!name || name.length < 2) return Errors.badRequest('name must be at least 2 characters.');
    if (!EMAIL_REGEX.test(email)) return Errors.badRequest('email must be a valid email address.');
    if (password.length < 8) return Errors.badRequest('password must be at least 8 characters.');
    if (password.length > 128) return Errors.badRequest('password must be under 128 characters.');

    let user: Awaited<ReturnType<typeof createUser>>;
    try {
      user = await createUser(email, name, password);
    } catch (e) {
      if ((e as Error).message === 'EMAIL_ALREADY_EXISTS') {
        return Errors.conflict('An account with this email address already exists.');
      }
      throw e;
    }

    const [accessToken, refreshToken] = await Promise.all([
      createAccessToken(user.id, user.role),
      createRefreshToken(user.id, user.role),
    ]);

    return created({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('[POST /api/v1/auth/register]', err);
    return Errors.internalError();
  }
}
