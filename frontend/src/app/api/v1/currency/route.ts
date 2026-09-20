/**
 * GET /api/v1/currency
 * Convert currency amounts and retrieve reference exchange rates.
 *
 * Connected to Phase 9B Multi-Tier Currency Provider:
 * 1. ExchangeRate-API (Live INR Reference Base)
 * 2. Frankfurter European Central Bank (Fallback)
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { convertCurrencyWithFallback } from '@/src/lib/providers/currency';

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'currency');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  const { searchParams } = req.nextUrl;
  const amount = parseFloat(searchParams.get('amount') || '1000');
  const from = searchParams.get('from') || 'INR';
  const to = searchParams.get('to') || 'USD';

  if (isNaN(amount) || amount <= 0) {
    return Errors.badRequest('Amount must be a positive numeric value.');
  }

  try {
    const result = await convertCurrencyWithFallback(amount, from, to);
    return ok(result, {
      source: result.metadata.source,
      lastUpdated: result.metadata.retrievedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/v1/currency] Error:', msg);
    return Errors.internalError('Failed to calculate currency exchange rate');
  }
}
