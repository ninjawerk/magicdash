import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'home-assistant',
  name: 'Home Assistant',
  description: 'Live entity states with tap-to-toggle controls. Pick any entities per tile.',
  version: '1.0.0',
  sdkVersion: 1,
  minHost: '0.1.0',
  author: 'MagicDash',
  icon: '🏠',
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 1 },
  settings: [
    { key: 'url', label: 'Home Assistant URL', type: 'string', placeholder: 'http://homeassistant.local:8123' },
    {
      key: 'token',
      label: 'Long-lived access token',
      type: 'string',
      secret: true,
      help: 'Home Assistant → your profile → Security → Long-lived access tokens → Create token.',
    },
  ],
  widgetConfig: [
    { key: 'entities', label: 'Entities', type: 'multiselect', optionsFrom: 'entities' },
    {
      key: 'layout',
      label: 'Layout',
      type: 'select',
      default: 'tiles',
      options: [
        { label: 'Tiles', value: 'tiles' },
        { label: 'List', value: 'list' },
        { label: 'Single big value', value: 'big' },
      ],
    },
    { key: 'controls', label: 'Allow tapping to toggle / activate', type: 'boolean', default: true },
    { key: 'showLastChanged', label: 'Show "changed x ago"', type: 'boolean', default: false },
    {
      key: 'attentionOn',
      label: 'Bring this screen forward when an entity turns on / opens',
      type: 'boolean',
      default: false,
      help: 'e.g. a door sensor or motion. Holds the screen for 20 seconds (attention lock).',
    },
  ],
};
export default manifest;
