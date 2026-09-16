import type { PluginManifest } from '../../src/sdk/types';

/**
 * 1. Copy this folder to plugins/<your-id>  (or run: npm run new-plugin <your-id>)
 * 2. Set `id` to the folder name.
 * 3. Describe the widget & its settings below — the host builds the settings UI for you.
 */
const manifest: PluginManifest = {
  id: '_template',
  name: 'My plugin',
  description: 'One sentence about what this tile shows.',
  version: '0.1.0',
  author: 'you',
  icon: '🧩',
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 1 },

  // Shared by every tile of this plugin. Stored on the server; `secret: true` never reaches the browser.
  settings: [{ key: 'apiKey', label: 'API key', type: 'string', secret: true }],

  // Per-tile settings.
  widgetConfig: [
    { key: 'greeting', label: 'Greeting', type: 'string', default: 'Hello' },
    { key: 'refreshSec', label: 'Refresh every', type: 'number', min: 5, default: 60, unit: 'seconds' },
    { key: 'flavour', label: 'Flavour', type: 'select', optionsFrom: 'flavours' },
  ],
};
export default manifest;
