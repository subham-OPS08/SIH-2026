/**
 * GET /api/v1/safety/contacts
 * Returns verified national emergency contacts (112, 108, 100, 1363, 1554).
 * These numbers are grounded in official government sources.
 * Do NOT override with AI-generated or community-sourced numbers.
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { VERIFIED_NATIONAL_CONTACTS } from '@/src/lib/fixtures';

export async function GET(_req: NextRequest) {
  try {
    return ok(VERIFIED_NATIONAL_CONTACTS, {
      lastUpdated: '2026-08-26',
      source: 'PRIMARY_GOVERNMENT',
      warning: 'Always dial 112 (National Emergency Response) in a life-threatening emergency.',
    });
  } catch (err) {
    console.error('[GET /api/v1/safety/contacts]', err);
    return Errors.internalError();
  }
}
