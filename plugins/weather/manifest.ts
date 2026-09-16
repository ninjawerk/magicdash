import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'weather',
  name: 'Weather',
  description: 'Current conditions, the next hours and a 7-day forecast. Powered by Open-Meteo — no API key needed.',
  version: '1.0.0',
  author: 'MagicDash',
  icon: '⛅',
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  widgetConfig: [
    { key: 'location', label: 'Location', type: 'custom', help: 'Search for a city or type coordinates.' },
    {
      key: 'units',
      label: 'Units',
      type: 'select',
      default: 'metric',
      options: [
        { label: 'Metric (°C, km/h, mm)', value: 'metric' },
        { label: 'Imperial (°F, mph, in)', value: 'imperial' },
      ],
    },
    { key: 'showHourly', label: 'Show next hours', type: 'boolean', default: true },
    { key: 'days', label: 'Forecast days', type: 'number', min: 0, max: 14, default: 7 },
    { key: 'showDetails', label: 'Show humidity, wind, sunrise…', type: 'boolean', default: true },
    {
      key: 'background',
      label: 'Tile background',
      type: 'select',
      default: 'auto',
      options: [
        { label: 'Match the weather (colour by conditions)', value: 'auto' },
        { label: 'Match the weather, subtle', value: 'subtle' },
        { label: 'None (plain tile)', value: 'none' },
        { label: 'Custom…', value: 'custom' },
      ],
    },
    {
      key: 'customBackground',
      label: 'Custom background',
      type: 'textarea',
      rows: 2,
      placeholder: 'linear-gradient(135deg, rgba(56,140,255,0.35), rgba(255,140,90,0.25))',
      showWhen: { key: 'background', equals: 'custom' },
      help: 'Any CSS background. Translucent colours work on every theme.',
    },
  ],
};
export default manifest;
