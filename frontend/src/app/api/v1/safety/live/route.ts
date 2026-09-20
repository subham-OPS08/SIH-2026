import { NextResponse } from 'next/server';
import { liveIntelligenceService } from '@/src/lib/services/liveIntelligenceService';

export async function GET() {
  try {
    const conditions = await liveIntelligenceService.getLiveSafetyConditions();
    return NextResponse.json(conditions);
  } catch (error) {
    console.error('Error fetching live safety conditions in API route:', error);
    return NextResponse.json({ error: true, liveAlerts: [], advisories: [] }, { status: 500 });
  }
}
