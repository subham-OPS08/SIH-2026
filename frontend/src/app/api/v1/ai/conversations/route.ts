/**
 * GET/POST /api/v1/ai/conversations
 * Manage user AI travel planning sessions and conversation threads.
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';

interface AiConversation {
  id: string;
  title: string;
  territorySlug?: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
}

// In-memory conversation store for active sessions
const sessions = new Map<string, AiConversation>();

// Initialize default sample session
sessions.set('conv_default_ladakh', {
  id: 'conv_default_ladakh',
  title: 'Ladakh High-Altitude Astrophotography Journey',
  territorySlug: 'ladakh',
  createdAt: new Date(Date.now() - 3600000).toISOString(),
  lastMessageAt: new Date().toISOString(),
  messageCount: 4,
});

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'ai-conversations');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  const convList = Array.from(sessions.values());
  return ok({
    conversations: convList,
    total: convList.length,
  });
}

export async function POST(req: NextRequest) {
  const key = getRateLimitKey(req, 'ai-conversations-create');
  const rl = checkRateLimit(key, RATE_LIMITS.USER);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    let body: { title?: string; territorySlug?: string };
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const newConv: AiConversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: body.title || 'New Travel Planning Session',
      territorySlug: body.territorySlug,
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      messageCount: 0,
    };

    sessions.set(newConv.id, newConv);
    return ok(newConv);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/v1/ai/conversations] Error:', msg);
    return Errors.internalError('Failed to create conversation session');
  }
}
