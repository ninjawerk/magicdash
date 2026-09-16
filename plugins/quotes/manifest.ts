import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'quotes',
  name: 'Quotes & greetings',
  description: 'Rotating quotes, or a greeting that changes with the time of day and the weather (“Good morning — take an umbrella”).',
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
        { label: 'Greeting — time of day & weather aware', value: 'greeting' },
        { label: 'Bundled quotes (works offline)', value: 'bundled' },
        { label: 'My own quotes', value: 'custom' },
        { label: 'ZenQuotes.io (online)', value: 'zenquotes' },
      ],
    },
    { key: 'name', label: 'Your name', type: 'string', placeholder: 'e.g. Deshan', showWhen: { key: 'source', equals: 'greeting' }, help: '“Good morning, Deshan”. Leave empty for no name.' },
    { key: 'weatherHints', label: 'Add weather hints (umbrella, sunscreen…) when a weather tile is on the dashboard', type: 'boolean', default: true, showWhen: { key: 'source', equals: 'greeting' } },
    { key: 'calendarHints', label: 'Mention the next calendar event when it is close', type: 'boolean', default: true, showWhen: { key: 'source', equals: 'greeting' } },
    {
      key: 'extraGreetings',
      label: 'Extra lines to mix in',
      type: 'list',
      itemLabel: 'line',
      placeholder: 'e.g. You look great today.',
      showWhen: { key: 'source', equals: 'greeting' },
    },
    { key: 'custom', label: 'My quotes', type: 'list', itemLabel: 'quote', placeholder: 'Quote — Author', showWhen: { key: 'source', equals: 'custom' }, help: 'Use " — " to separate the author.' },
    { key: 'intervalMin', label: 'Change every', type: 'number', min: 1, max: 1440, default: 15, unit: 'minutes' },
    { key: 'align', label: 'Alignment', type: 'select', default: 'left', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }] },
  ],
};
export default manifest;
