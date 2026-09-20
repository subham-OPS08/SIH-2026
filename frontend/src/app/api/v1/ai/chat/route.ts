/**
 * POST /api/v1/ai/chat
 * Yatra AI chat endpoint — Powered by Phase 10 Agentic Travel Intelligence Orchestrator.
 *
 * Core Capabilities:
 * 1. Hybrid RAG (Metadata Filter + BM25 + Semantic Embeddings) over 8 Union Territories
 * 2. Controlled Read/Write Tool Execution (Weather, Routing, Flights, Hotels, Emergency, Festivals)
 * 3. Prompt Injection Defense & PII Sanitization
 * 4. Grounded Source Citations & Action Confirmation Enforcements
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { yatraAiOrchestrator } from '@/src/lib/ai/orchestrator';

const MAX_MESSAGE_LENGTH = 2000;

export async function POST(req: NextRequest) {
  const key = getRateLimitKey(req, 'ai-chat');
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
    const message = typeof b.message === 'string' ? b.message.trim() : '';

    if (!message) return Errors.badRequest('message is required.');
    if (message.length > MAX_MESSAGE_LENGTH) {
      return Errors.badRequest(`message must be under ${MAX_MESSAGE_LENGTH} characters.`);
    }

    const conversationHistory = Array.isArray(b.conversationHistory)
      ? b.conversationHistory
          .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
            Boolean(
              m &&
              typeof m === 'object' &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string'
            )
          )
          .slice(-10)
      : undefined;

    const userLocation =
      b.context && typeof b.context === 'object' && typeof (b.context as Record<string, unknown>).lat === 'number'
        ? {
            lat: (b.context as { lat: number }).lat,
            lng: (b.context as { lng: number }).lng,
          }
        : undefined;

    // Process through the Master Agentic Travel Intelligence Orchestrator
    const resultMessage = await yatraAiOrchestrator.processUserMessage(message, {
      conversationHistory,
      userLocation,
    });

    return ok(resultMessage, {
      source: resultMessage.metadata?.model || 'Yatra AI Engine',
      lastUpdated: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/v1/ai/chat] Error:', msg);
    return Errors.internalError('Failed to generate travel intelligence response');
  }
}
