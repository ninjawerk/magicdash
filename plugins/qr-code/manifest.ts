import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'qr-code',
  name: 'QR code',
  description: 'Wi-Fi login for guests, a link, or any text as a scannable QR code.',
  version: '1.0.0',
  author: 'MagicDash',
  icon: '🔳',
  defaultSize: { w: 2, h: 2 },
  minSize: { w: 1, h: 1 },
  widgetConfig: [
    {
      key: 'mode',
      label: 'Content',
      type: 'select',
      default: 'wifi',
      options: [
        { label: 'Wi-Fi network', value: 'wifi' },
        { label: 'Link (URL)', value: 'url' },
        { label: 'Text', value: 'text' },
      ],
    },
    { key: 'ssid', label: 'Network name (SSID)', type: 'string', showWhen: { key: 'mode', equals: 'wifi' } },
    { key: 'password', label: 'Password', type: 'string', showWhen: { key: 'mode', equals: 'wifi' }, help: 'Shown on the kiosk if “Show details” is on — this is meant for guests.' },
    {
      key: 'security',
      label: 'Security',
      type: 'select',
      default: 'WPA',
      options: [
        { label: 'WPA / WPA2 / WPA3', value: 'WPA' },
        { label: 'WEP', value: 'WEP' },
        { label: 'Open (no password)', value: 'nopass' },
      ],
      showWhen: { key: 'mode', equals: 'wifi' },
    },
    { key: 'hidden', label: 'Hidden network', type: 'boolean', default: false, showWhen: { key: 'mode', equals: 'wifi' } },
    { key: 'url', label: 'URL', type: 'string', placeholder: 'https://…', showWhen: { key: 'mode', equals: 'url' } },
    { key: 'text', label: 'Text', type: 'textarea', rows: 3, showWhen: { key: 'mode', equals: 'text' } },
    { key: 'label', label: 'Caption', type: 'string', placeholder: 'e.g. Guest Wi-Fi — scan to join' },
    { key: 'showDetails', label: 'Show details (SSID / password / URL) under the code', type: 'boolean', default: true },
  ],
};
export default manifest;
