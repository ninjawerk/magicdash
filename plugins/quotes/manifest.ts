import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'quotes',
  name: 'Motivational quotes',
  description: 'Rotating quotes — bundled offline set, your own list, or live from the web.',
  version: '1.0.0',
  sdkVersion: 1,
  minHost: '0.1.0',
  author: 'MagicDash',
  icon: '💬',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 2, h: 1 },
  widgetConfig: [
    {
      key: 'source',
      label: 'Source',
      type: 'select',
      default: 'bundled',
      options: [
        { label: 'Bundled (works offline)', value: 'bundled' },
        { label: 'My own quotes', value: 'custom' },
        { label: 'ZenQuotes.io (online)', value: 'zenquotes' },
      ],
    },
    { key: 'custom', label: 'My quotes', type: 'list', itemLabel: 'quote', placeholder: 'Quote — Author', showWhen: { key: 'source', equals: 'custom' }, help: 'Use " — " to separate the author.' },
    { key: 'intervalMin', label: 'Change every', type: 'number', min: 1, max: 1440, default: 15, unit: 'minutes' },
    { key: 'align', label: 'Alignment', type: 'select', default: 'left', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }] },
  ],
};
export default manifest;
