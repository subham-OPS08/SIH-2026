/**
 * 🇮🇳 BHARAT SAFE YATRA — STATES & UNION TERRITORIES DATASET API
 * GET /api/v1/states-and-uts
 *
 * Query params:
 *   - type: 'State' | 'Union Territory' (filter by entity type)
 *   - zone: 'Northern' | 'Southern' | 'Western' | 'Eastern' | 'North-Eastern' | 'Central'
 *   - search: query matching name, capital, ISO code, or vehicle code
 */

import { NextRequest } from 'next/server';
import { ok, Errors } from '@/src/lib/api/utils';
import { STATES_AND_UTS_DATASET } from '@/src/lib/fixtures';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const zone = searchParams.get('zone');
    const search = searchParams.get('search')?.toLowerCase().trim();

    let results = [...STATES_AND_UTS_DATASET];

    if (type) {
      results = results.filter((item) => item.type.toLowerCase() === type.toLowerCase());
    }

    if (zone) {
      results = results.filter((item) => item.zone.toLowerCase() === zone.toLowerCase());
    }

    if (search) {
      results = results.filter(
        (item) =>
          item.name.toLowerCase().includes(search) ||
          item.capital.toLowerCase().includes(search) ||
          item.isoCode.toLowerCase().includes(search) ||
          item.vehicleCode.toLowerCase().includes(search) ||
          item.largestCity.toLowerCase().includes(search)
      );
    }

    return ok({
      total: results.length,
      items: results,
      source: 'Kaggle nihxlt/states-and-uts-of-india (Official Government Census)',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/v1/states-and-uts] Error:', msg);
    return Errors.internalError('Failed to retrieve states and UTs dataset');
  }
}
