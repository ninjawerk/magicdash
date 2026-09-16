/** Types shared by weather server & client. */
export interface Location {
  name: string;
  country?: string;
  admin?: string;
  lat: number;
  lon: number;
  timezone?: string;
}

export interface Forecast {
  location: Location;
  units: 'metric' | 'imperial';
  fetchedAt: string;
  timezone: string;
  current: {
    time: string;
    temp: number;
    feelsLike: number;
    humidity: number;
    wind: number;
    windDir: number;
    gusts: number;
    precip: number;
    code: number;
    isDay: boolean;
    uv: number;
    pressure: number;
  };
  hourly: Array<{ time: string; temp: number; code: number; precipProb: number; isDay: boolean }>;
  daily: Array<{
    date: string;
    code: number;
    tMax: number;
    tMin: number;
    precipProb: number;
    precipSum: number;
    sunrise: string;
    sunset: string;
    uv: number;
    wind: number;
  }>;
}

/** WMO weather interpretation codes → label. */
export function describeCode(code: number): string {
  const map: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    56: 'Freezing drizzle',
    57: 'Freezing drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Light showers',
    81: 'Showers',
    82: 'Violent showers',
    85: 'Snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Thunderstorm with hail',
  };
  return map[code] ?? 'Unknown';
}
