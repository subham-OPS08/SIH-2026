/**
 * POST /api/v1/payments/create-order
 * Initiate a Razorpay payment order for verified bookings or ePermits.
 */

import { NextRequest } from 'next/server';
import { ok, created, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { createPaymentOrder } from '@/src/lib/providers/payments';

export async function POST(req: NextRequest) {
  const key = getRateLimitKey(req, 'payments-create');
  const rl = checkRateLimit(key, RATE_LIMITS.BOOKING);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    let body: {
      amountINR: number;
      currency?: string;
      receiptId?: string;
      customer?: { name: string; email: string; phone?: string };
      notes?: Record<string, string>;
    };

    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Invalid JSON body');
    }

    if (!body.amountINR || body.amountINR <= 0) {
      return Errors.badRequest('amountINR must be a positive number');
    }

    const order = await createPaymentOrder({
      amountINR: body.amountINR,
      currency: body.currency || 'INR',
      receiptId: body.receiptId || `rec_${Date.now()}`,
      customer: body.customer || { name: 'Verified Tourist', email: 'tourist@bharatsafeyatra.in' },
      notes: body.notes,
    });

    return created(order);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/v1/payments/create-order] Error:', msg);
    return Errors.internalError('Failed to initiate payment order');
  }
}
