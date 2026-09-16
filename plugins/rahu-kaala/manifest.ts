import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'rahu-kaala',
  name: 'Rahu Kaala',
  description: 'Today’s Rahu Kaala (and optionally Yamagandam and Gulika Kalam) from local sunrise and sunset, with a live countdown. Works offline.',
  version: '1.0.0',
  sdkVersion: 1,
  minHost: '0.2.0',
  author: 'MagicDash',
  icon: '🪐',
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 1 },
  widgetConfig: [
    { key: 'location', label: 'Location', type: 'custom', help: 'Leave empty to use the dashboard location (Appearance → Dashboard).' },
    { key: 'showYamagandam', label: 'Also show Yamagandam', type: 'boolean', default: false },
    { key: 'showGulika', label: 'Also show Gulika Kalam', type: 'boolean', default: false },
    { key: 'showSun', label: 'Show sunrise & sunset', type: 'boolean', default: true },
    { key: 'showTomorrow', label: 'Show tomorrow’s Rahu Kaala after today’s has passed', type: 'boolean', default: true },
    { key: 'alert', label: 'Turn the tile red while Rahu Kaala is running', type: 'boolean', default: true },
    { key: 'warnMinutes', label: 'Warn this many minutes before it starts', type: 'number', min: 0, max: 120, default: 15, unit: 'minutes' },
    { key: 'hour12', label: '12-hour clock', type: 'boolean', default: false },
  ],
};
export default manifest;
