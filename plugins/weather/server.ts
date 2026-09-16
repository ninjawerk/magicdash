import { asyncHandler, defineServerPlugin } from '../../src/sdk/server';
import type { Forecast, Location } from './shared';

const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const API = 'https://api.open-meteo.com/v1/forecast';

export default defineServerPlugin((ctx) => {
  /** GET /search?q=berlin → Location[] */
  ctx.router.get(
    '/search',
    asyncHandler(async (req, res) => {
      const q = String(req.query.q ?? '').trim();
      if (q.length < 2) {
        res.json([]);
        return;
      }
      const coords = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (coords) {
        res.json([{ name: `${coords[1]}, ${coords[2]}`, lat: Number(coords[1]), lon: Number(coords[2]) } satisfies Location]);
        return;
      }
      const results = await ctx.cache.wrap(`geo:${q.toLowerCase()}`, 24 * 3600_000, async () => {
        const r = await fetch(`${GEO}?name=${encodeURIComponent(q)}&count=8&language=en&format=json`);
        if (!r.ok) throw new Error(`Geocoding failed (${r.status})`);
        const data = (await r.json()) as { results?: Array<Record<string, unknown>> };
        return (data.results ?? []).map<Location>((x) => ({
          name: String(x.name),
          country: x.country as string | undefined,
          admin: x.admin1 as string | undefined,
          lat: Number(x.latitude),
          lon: Number(x.longitude),
          timezone: x.timezone as string | undefined,
        }));
      });
      res.json(results);
    }),
  );

  /** GET /forecast?lat=&lon=&units=metric|imperial&name= */
  ctx.router.get(
    '/forecast',
    asyncHandler(async (req, res) => {
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);
      const units = req.query.units === 'imperial' ? 'imperial' : 'metric';
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        res.status(400).json({ error: 'Pick a location in this tile’s settings.' });
        return;
      }
      const key = `fc:${lat.toFixed(3)}:${lon.toFixed(3)}:${units}`;
      const forecast = await ctx.cache.wrap(key, 10 * 60_000, async () => {
        const params = new URLSearchParams({
          latitude: String(lat),
          longitude: String(lon),
          timezone: 'auto',
          forecast_days: '14',
          current: [
            'temperature_2m',
            'apparent_temperature',
            'relative_humidity_2m',
            'wind_speed_10m',
            'wind_direction_10m',
            'wind_gusts_10m',
            'precipitation',
            'weather_code',
            'is_day',
            'uv_index',
            'surface_pressure',
          ].join(','),
          hourly: ['temperature_2m', 'weather_code', 'precipitation_probability', 'is_day'].join(','),
          daily: [
            'weather_code',
            'temperature_2m_max',
            'temperature_2m_min',
            'precipitation_probability_max',
            'precipitation_sum',
            'sunrise',
            'sunset',
            'uv_index_max',
            'wind_speed_10m_max',
          ].join(','),
        });
        if (units === 'imperial') {
          params.set('temperature_unit', 'fahrenheit');
          params.set('wind_speed_unit', 'mph');
          params.set('precipitation_unit', 'inch');
        }
        const r = await fetch(`${API}?${params}`);
        if (!r.ok) throw new Error(`Open-Meteo failed (${r.status})`);
        const d = (await r.json()) as Record<string, Record<string, unknown[]> & Record<string, unknown>> & { timezone: string };
        const c = d.current as unknown as Record<string, number | string>;
        const h = d.hourly as Record<string, unknown[]>;
        const dl = d.daily as Record<string, unknown[]>;

        const nowIdx = Math.max(
          0,
          (h.time as string[]).findIndex((t) => new Date(t).getTime() > Date.now()) - 1,
        );
        const fc: Forecast = {
          location: { name: String(req.query.name ?? ''), lat, lon, timezone: d.timezone },
          units,
          fetchedAt: new Date().toISOString(),
          timezone: d.timezone,
          current: {
            time: String(c.time),
            temp: Number(c.temperature_2m),
            feelsLike: Number(c.apparent_temperature),
            humidity: Number(c.relative_humidity_2m),
            wind: Number(c.wind_speed_10m),
            windDir: Number(c.wind_direction_10m),
            gusts: Number(c.wind_gusts_10m),
            precip: Number(c.precipitation),
            code: Number(c.weather_code),
            isDay: Number(c.is_day) === 1,
            uv: Number(c.uv_index),
            pressure: Number(c.surface_pressure),
          },
          hourly: (h.time as string[]).slice(nowIdx, nowIdx + 48).map((t, i) => ({
            time: t,
            temp: Number((h.temperature_2m as number[])[nowIdx + i]),
            code: Number((h.weather_code as number[])[nowIdx + i]),
            precipProb: Number((h.precipitation_probability as number[])[nowIdx + i] ?? 0),
            isDay: Number((h.is_day as number[])[nowIdx + i]) === 1,
          })),
          daily: (dl.time as string[]).map((date, i) => ({
            date,
            code: Number((dl.weather_code as number[])[i]),
            tMax: Number((dl.temperature_2m_max as number[])[i]),
            tMin: Number((dl.temperature_2m_min as number[])[i]),
            precipProb: Number((dl.precipitation_probability_max as number[])[i] ?? 0),
            precipSum: Number((dl.precipitation_sum as number[])[i] ?? 0),
            sunrise: String((dl.sunrise as string[])[i]),
            sunset: String((dl.sunset as string[])[i]),
            uv: Number((dl.uv_index_max as number[])[i] ?? 0),
            wind: Number((dl.wind_speed_10m_max as number[])[i] ?? 0),
          })),
        };
        return fc;
      });
      res.json(forecast);
    }),
  );
});
