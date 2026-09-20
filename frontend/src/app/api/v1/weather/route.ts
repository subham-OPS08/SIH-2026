/**
 * GET /api/v1/weather
 * Fetch current weather and 5-day forecast for coordinates or destination slug.
 *
 * Connected to Phase 9B Multi-Tier Weather Provider:
 * 1. OpenWeather One Call 3.0 + Air Pollution (Primary)
 * 2. WeatherAPI.com (Marine swell & Island telemetry)
 * 3. IMD 30-Year Climatological Normals & Open-Meteo (Sovereign Fallback)
 *
 * Never fabricates data. Returns full freshness metadata.
 */

import { NextRequest } from 'next/server';
import { ok, Errors, isValidLatitude, isValidLongitude } from '@/src/lib/api/utils';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/src/lib/api/rateLimit';
import { VERIFIED_DESTINATIONS } from '@/src/lib/fixtures';
import { getWeatherData } from '@/src/lib/providers/weather';

export async function GET(req: NextRequest) {
  const key = getRateLimitKey(req, 'weather');
  const rl = checkRateLimit(key, RATE_LIMITS.PUBLIC);
  if (!rl.allowed) return Errors.tooManyRequests();

  try {
    const { searchParams } = req.nextUrl;
    let lat: number | null = null;
    let lng: number | null = null;
    let destinationName: string | undefined;

    const destinationSlug = searchParams.get('destinationId') ?? searchParams.get('slug');
    if (destinationSlug) {
      const dest = VERIFIED_DESTINATIONS.find((d) => d.slug === destinationSlug || d.id === destinationSlug);
      if (!dest) return Errors.notFound(`Destination "${destinationSlug}"`);
      lat = dest.coordinates.lat;
      lng = dest.coordinates.lng;
      destinationName = dest.name;
    } else {
      const rawLat = parseFloat(searchParams.get('lat') ?? '');
      const rawLng = parseFloat(searchParams.get('lng') ?? '');
      if (!isValidLatitude(rawLat)) return Errors.badRequest('lat must be a valid decimal latitude.');
      if (!isValidLongitude(rawLng)) return Errors.badRequest('lng must be a valid decimal longitude.');
      lat = rawLat;
      lng = rawLng;
    }

    const weatherData = await getWeatherData(lat, lng);

    return ok(
      {
        destination: destinationName,
        coordinates: { lat, lng },
        current: weatherData.current,
        forecast: weatherData.forecast,
        marine: weatherData.marine,
        metadata: weatherData.metadata,
      },
      {
        lastUpdated: weatherData.metadata.retrievedAt,
        source: weatherData.metadata.source,
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/v1/weather] Error:', msg);
    return Errors.internalError('Failed to retrieve weather intelligence');
  }
}
