import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'countdown',
  name: 'Countdown',
  description: 'Days, hours and minutes until a date. Red in the final hour.',
  version: '1.0.0',
  sdkVersion: 1,
  minHost: '0.1.0',
  author: 'ninjawerk',
  icon: '⏳',
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 1 },
  widgetConfig: [
    { key: 'title', label: 'What are we counting down to?', type: 'string', placeholder: 'Holiday' },
    { key: 'target', label: 'Date & time', type: 'string', placeholder: '2026-12-24T18:00', help: 'ISO format, local time.' },
    { key: 'showSeconds', label: 'Show seconds', type: 'boolean', default: false },
    { key: 'grabAttention', label: 'Bring this screen forward in the last minute', type: 'boolean', default: true },
    {
      key: 'style',
      label: 'Style',
      type: 'select',
      default: 'big',
      options: [
        { label: 'Big number', value: 'big' },
        { label: 'Units row', value: 'units' },
      ],
    },
  ],
};
export default manifest;
