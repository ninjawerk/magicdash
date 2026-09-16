import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'rahu-kaala',
  name: 'Rahu Kaala',
  description: 'Today’s Rahu period (time to avoid starting new things) and the best time of day, from local sunrise and sunset, with a live countdown. Optional Yama and Gulika periods. Works offline.',
  version: '1.0.0',
  sdkVersion: 1,
  minHost: '0.2.0',
  author: 'MagicDash',
  icon: '🪐',
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 1 },
  widgetConfig: [
    { key: 'location', label: 'Location', type: 'custom', help: 'Leave empty to use the dashboard location (Appearance → Dashboard).' },
    { key: 'showAbhijit', label: 'Show the best time of day (Abhijit Muhurta)', type: 'boolean', default: true },
    { key: 'showYamagandam', label: 'Also show the Yama period (Yamagandam)', type: 'boolean', default: false },
    { key: 'showGulika', label: 'Also show the Gulika period (Gulika Kalam)', type: 'boolean', default: false },
    { key: 'showSun', label: 'Show sunrise & sunset', type: 'boolean', default: true },
    { key: 'showTomorrow', label: 'Show tomorrow’s Rahu Kaala after today’s has passed', type: 'boolean', default: true },
    { key: 'alert', label: 'Turn the tile red during the Rahu period', type: 'boolean', default: true },
    { key: 'warnMinutes', label: 'Warn this many minutes before it starts', type: 'number', min: 0, max: 120, default: 15, unit: 'minutes' },
    { key: 'hour12', label: '12-hour clock', type: 'boolean', default: false },
  ],
};
export default manifest;
