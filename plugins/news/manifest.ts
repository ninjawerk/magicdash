import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'news',
  name: 'News headlines',
  description: 'Headlines from any RSS or Atom feed — rotating big headline or a compact list.',
  version: '1.0.0',
  sdkVersion: 1,
  minHost: '0.1.0',
  author: 'MagicDash',
  icon: '📰',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 2, h: 1 },
  widgetConfig: [
    {
      key: 'feeds',
      label: 'Feeds',
      type: 'list',
      itemLabel: 'feed',
      placeholder: 'Name | https://example.com/rss.xml',
      default: ['BBC News | https://feeds.bbci.co.uk/news/rss.xml'],
      help: 'One per line as “Name | URL”. Examples: BBC World https://feeds.bbci.co.uk/news/world/rss.xml · The Guardian https://www.theguardian.com/world/rss · NYT https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml · Hacker News https://hnrss.org/frontpage · The Verge https://www.theverge.com/rss/index.xml · Google News https://news.google.com/rss?hl=en',
    },
    {
      key: 'layout',
      label: 'Layout',
      type: 'select',
      default: 'headline',
      options: [
        { label: 'One big rotating headline', value: 'headline' },
        { label: 'List', value: 'list' },
      ],
    },
    { key: 'intervalSec', label: 'Rotate every', type: 'number', min: 3, max: 600, default: 12, unit: 'seconds', showWhen: { key: 'layout', equals: 'headline' } },
    { key: 'showImage', label: 'Use the article image as tile background', type: 'boolean', default: true, showWhen: { key: 'layout', equals: 'headline' } },
    { key: 'showSummary', label: 'Show summary', type: 'boolean', default: true, showWhen: { key: 'layout', equals: 'headline' } },
    { key: 'maxAgeHours', label: 'Ignore items older than', type: 'number', min: 1, max: 168, default: 48, unit: 'hours' },
  ],
};
export default manifest;
