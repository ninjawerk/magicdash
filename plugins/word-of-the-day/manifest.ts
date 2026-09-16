import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'word-of-the-day',
  name: 'Word of the day',
  description: 'A new word every day with pronunciation and definition, from Merriam-Webster or Wiktionary.',
  version: '1.0.0',
  author: 'MagicDash',
  icon: '📖',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 2, h: 1 },
  widgetConfig: [
    {
      key: 'source',
      label: 'Source',
      type: 'select',
      default: 'merriam-webster',
      options: [
        { label: 'Merriam-Webster', value: 'merriam-webster' },
        { label: 'Wiktionary', value: 'wiktionary' },
      ],
    },
    { key: 'showPronunciation', label: 'Show pronunciation', type: 'boolean', default: true },
    { key: 'showSource', label: 'Show source', type: 'boolean', default: true },
    { key: 'align', label: 'Alignment', type: 'select', default: 'left', options: [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }] },
  ],
};
export default manifest;
