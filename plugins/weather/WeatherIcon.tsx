import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Cloudy,
  Moon,
  Snowflake,
  Sun,
  type LucideProps,
} from 'lucide-react';

/**
 * Maps WMO weather codes to a lucide icon + a colour that reads well on dark tiles.
 */
export function WeatherIcon({ code, isDay = true, ...props }: { code: number; isDay?: boolean } & LucideProps) {
  const base = { strokeWidth: 1.75, ...props };
  const sun = '#ffd166';
  const moon = '#cdd6f4';
  const cloud = '#c9d1e0';
  const rain = '#7cc4ff';
  const snow = '#e0f2ff';
  const storm = '#c3a6ff';

  if (code === 0) return isDay ? <Sun color={sun} {...base} /> : <Moon color={moon} {...base} />;
  if (code === 1 || code === 2) return isDay ? <CloudSun color={cloud} {...base} /> : <CloudMoon color={cloud} {...base} />;
  if (code === 3) return <Cloudy color={cloud} {...base} />;
  if (code === 45 || code === 48) return <CloudFog color={cloud} {...base} />;
  if (code >= 51 && code <= 57) return <CloudDrizzle color={rain} {...base} />;
  if (code === 61 || code === 80) return <CloudRain color={rain} {...base} />;
  if (code === 63 || code === 65 || code === 81 || code === 82) return <CloudRainWind color={rain} {...base} />;
  if (code === 66 || code === 67) return <CloudHail color={rain} {...base} />;
  if (code === 71 || code === 73 || code === 85) return <CloudSnow color={snow} {...base} />;
  if (code === 75 || code === 77 || code === 86) return <Snowflake color={snow} {...base} />;
  if (code >= 95) return <CloudLightning color={storm} {...base} />;
  return <Cloud color={cloud} {...base} />;
}
