import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'clock',
  name: 'Clock',
  description: 'Big, legible time and date.',
  version: '1.0.0',
  author: 'MagicDash',
  icon: '🕰️',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 2, h: 1 },
  frameless: true,
  widgetConfig: [
    { key: 'hour12', label: '12-hour clock', type: 'boolean', default: false },
    { key: 'seconds', label: 'Show seconds', type: 'boolean', default: false },
    { key: 'date', label: 'Show date', type: 'boolean', default: true },
    { key: 'timeZone', label: 'Time zone', type: 'string', placeholder: 'e.g. Europe/London (leave empty for system)', help: 'IANA zone name.' },
    { key: 'label', label: 'Label', type: 'string', placeholder: 'e.g. Home' },
  ],
};
export default manifest;
