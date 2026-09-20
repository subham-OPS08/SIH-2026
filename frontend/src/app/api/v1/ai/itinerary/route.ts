/**
 * POST /api/v1/ai/itinerary
 * AI-assisted itinerary generation with route travel-time validation and source grounding.
 *
 * Connected to Phase 10 Itinerary Generator & Confirmation Flow.
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { createItineraryProposalTool } from '@/src/lib/ai/tools/writeTools';

const VALID_TERRITORY_CODES = new Set([
  'ANDAMAN_NICOBAR', 'CHANDIGARH', 'DNH_DD', 'DELHI',
  'JAMMU_KASHMIR', 'LADAKH', 'LAKSHADWEEP', 'PUDUCHERRY',
  'andaman-nicobar', 'chandigarh', 'dnh-dd', 'delhi',
  'jammu-kashmir', 'ladakh', 'lakshadweep', 'puducherry',
]);

export async function POST(req: NextRequest) {
  const key = getRateLimitKey(req, 'ai-itinerary');
  const rl = checkRateLimit(key, RATE_LIMITS.AI);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Request body must be valid JSON.');
    }

    const b = body as Record<string, unknown>;
    const destinationId = typeof b.destinationId === 'string' ? b.destinationId : undefined;
    const rawTerritory = typeof b.territoryId === 'string' ? b.territoryId : undefined;
    const territorySlug = rawTerritory ? rawTerritory.toLowerCase().replace(/_/g, '-') : undefined;
    const durationDays = typeof b.durationDays === 'number' ? b.durationDays : 3;
    const travellers = typeof b.travellers === 'number' ? b.travellers : 2;
    const travelStyle = typeof b.travelStyle === 'string' ? b.travelStyle.toUpperCase() : 'BALANCED';

    if (rawTerritory && !VALID_TERRITORY_CODES.has(rawTerritory) && !VALID_TERRITORY_CODES.has(territorySlug!)) {
      return Errors.badRequest(`Invalid territoryId. Must be one of the 8 Union Territories.`);
    }
    if (durationDays < 1 || durationDays > 14) {
      return Errors.badRequest('durationDays must be between 1 and 14.');
    }

    const toolResult = await createItineraryProposalTool.execute(
      {
        destinationId,
        territorySlug,
        durationDays,
        travelStyle,
        travellers,
      },
      `itinerary_gen_${Date.now()}`
    );

    return ok(
      {
        proposal: toolResult.data,
        status: 'PROPOSAL_PENDING_CONFIRMATION',
        confirmationRequired: true,
        confirmationPayload: toolResult.confirmationPayload,
        citations: toolResult.citations,
        message: 'This itinerary is a proposal generated via Bharat Safe Yatra Intelligence. Review and confirm before saving.',
      },
      {
        source: 'Bharat Safe Yatra Travel Intelligence Engine',
        lastUpdated: new Date().toISOString(),
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/v1/ai/itinerary] Error:', msg);
    return Errors.internalError('Failed to generate structured itinerary proposal');
  }
}
