import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'random-image',
  name: 'Random image',
  description: 'A slideshow from a folder on the Pi, a list of URLs, or random photos from the web.',
  version: '1.0.0',
  author: 'MagicDash',
  icon: '🖼️',
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  frameless: true,
  settings: [
    {
      key: 'folder',
      label: 'Image folder on the server',
      type: 'string',
      placeholder: '/home/pi/Pictures',
      help: 'Absolute path. jpg / png / gif / webp / avif files are picked up (sub-folders included).',
    },
  ],
  widgetConfig: [
    {
      key: 'source',
      label: 'Source',
      type: 'select',
      default: 'picsum',
      options: [
        { label: 'Random photos (picsum.photos, online)', value: 'picsum' },
        { label: 'Folder on the server', value: 'folder' },
        { label: 'List of image URLs', value: 'urls' },
      ],
    },
    { key: 'urls', label: 'Image URLs', type: 'list', itemLabel: 'URL', placeholder: 'https://…', showWhen: { key: 'source', equals: 'urls' } },
    { key: 'subfolder', label: 'Sub-folder filter', type: 'string', placeholder: 'e.g. holidays/2025', showWhen: { key: 'source', equals: 'folder' }, help: 'Only show images whose path contains this text.' },
    { key: 'intervalSec', label: 'Change every', type: 'number', min: 3, max: 86400, default: 60, unit: 'seconds' },
    { key: 'fit', label: 'Fit', type: 'select', default: 'cover', options: [{ label: 'Fill tile (crop)', value: 'cover' }, { label: 'Fit inside', value: 'contain' }] },
    { key: 'kenBurns', label: 'Slow zoom effect', type: 'boolean', default: true },
    { key: 'shuffle', label: 'Shuffle', type: 'boolean', default: true },
    { key: 'caption', label: 'Show file name', type: 'boolean', default: false },
  ],
};
export default manifest;
