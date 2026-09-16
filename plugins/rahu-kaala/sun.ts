/**
 * Sunrise / sunset from latitude & longitude (NOAA "sunrise equation"), accurate to about a minute.
 * Returns local Dates for the given calendar day, or null in polar day/night.
 */
export function sunTimes(date: Date, lat: number, lon: number): { sunrise: Date; sunset: Date } | null {
  const rad = Math.PI / 180;
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Julian day at local midnight → days since J2000 (noon)
  const jd = dayStart.getTime() / 86_400_000 + 2440587.5;
  const n = Math.ceil(jd - 2451545.0 + 0.0008);
  const Jstar = n - lon / 360; // mean solar noon
  const M = (357.5291 + 0.98560028 * Jstar) % 360; // solar mean anomaly
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360; // ecliptic longitude
  const Jtransit = 2451545.0 + Jstar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const delta = Math.asin(Math.sin(lambda * rad) * Math.sin(23.4397 * rad)); // declination
  const cosw = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(delta)) / (Math.cos(lat * rad) * Math.cos(delta));
  if (cosw < -1 || cosw > 1) return null;
  const w = Math.acos(cosw) / rad; // hour angle in degrees
  const toDate = (j: number) => new Date((j - 2440587.5) * 86_400_000);
  return { sunrise: toDate(Jtransit - w / 360), sunset: toDate(Jtransit + w / 360) };
}

/**
 * Vedic day periods: the daylight (sunrise → sunset) is split into 8 equal parts; each inauspicious period
 * falls in a fixed part depending on the weekday (0 = Sunday).
 */
const SEGMENT: Record<'rahu' | 'yamagandam' | 'gulika', number[]> = {
  //          Sun Mon Tue Wed Thu Fri Sat
  rahu: /*  */ [8, 2, 7, 5, 6, 4, 3],
  yamagandam: [5, 4, 3, 2, 1, 7, 6],
  gulika: /**/ [7, 6, 5, 4, 3, 2, 1],
};

export interface Period {
  key: 'rahu' | 'yamagandam' | 'gulika';
  start: Date;
  end: Date;
}

export function vedicPeriods(date: Date, lat: number, lon: number): { sunrise: Date; sunset: Date; periods: Period[] } | null {
  const sun = sunTimes(date, lat, lon);
  if (!sun) return null;
  const part = (sun.sunset.getTime() - sun.sunrise.getTime()) / 8;
  const day = date.getDay();
  const periods = (Object.keys(SEGMENT) as Period['key'][]).map((key) => {
    const seg = SEGMENT[key][day];
    return { key, start: new Date(sun.sunrise.getTime() + (seg - 1) * part), end: new Date(sun.sunrise.getTime() + seg * part) };
  });
  return { ...sun, periods };
}
