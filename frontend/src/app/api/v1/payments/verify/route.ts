/**
 * POST /api/v1/payments/verify
 * Cryptographically verify Razorpay payment signature (HMAC-SHA256).
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { verifyPayment } from '@/src/lib/providers/payments';

export async function POST(req: NextRequest) {
  const key = getRateLimitKey(req, 'payments-verify');
  const rl = checkRateLimit(key, RATE_LIMITS.BOOKING);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    let body: {
      orderId: string;
      paymentId: string;
      signature: string;
    };

    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Invalid JSON body');
    }

    if (!body.orderId || !body.paymentId || !body.signature) {
      return Errors.badRequest('orderId, paymentId, and signature are required for verification.');
    }

    const isValid = verifyPayment({
      orderId: body.orderId,
      paymentId: body.paymentId,
      signature: body.signature,
    });

    if (!isValid) {
      return Errors.badRequest('Invalid payment signature verification failed.');
    }

    return ok({
      verified: true,
      orderId: body.orderId,
      paymentId: body.paymentId,
      status: 'PAYMENT_VERIFIED_SUCCESSFULLY',
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/v1/payments/verify] Error:', msg);
    return Errors.internalError('Failed to verify payment');
  }
}
