import type { PluginManifest } from '../../src/sdk/types';

const manifest: PluginManifest = {
  id: 'google-calendar',
  name: 'Schedule (Google Calendar)',
  description: 'What’s happening now, what’s next and how long until it. Pulses red in the final minute of an event. Google account or any ICS feed.',
  version: '1.0.0',
  author: 'MagicDash',
  icon: '📅',
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 3, h: 2 },
  settings: [
    {
      key: 'clientId',
      label: 'Google OAuth Client ID',
      type: 'string',
      placeholder: '1234567890-abc.apps.googleusercontent.com',
      help: 'Create an OAuth client (type: Web application) in Google Cloud Console → APIs & Services → Credentials, and enable the Google Calendar API.',
    },
    { key: 'clientSecret', label: 'Google OAuth Client Secret', type: 'string', secret: true },
    {
      key: 'redirectUri',
      label: 'Redirect URI override',
      type: 'string',
      placeholder: 'leave empty to use the address you are browsing from',
      help: 'Must match an "Authorized redirect URI" on the OAuth client.',
    },
    {
      key: 'icsFeeds',
      label: 'Extra calendar feeds (ICS)',
      type: 'list',
      itemLabel: 'feed',
      placeholder: 'Work | https://calendar.google.com/calendar/ical/…/basic.ics',
      help: 'No Google Cloud setup needed: paste a calendar’s "Secret address in iCal format" (Google), or any iCloud / Outlook / Nextcloud ICS link. Format: Name | URL',
    },
  ],
  widgetConfig: [
    { key: 'calendars', label: 'Calendars', type: 'multiselect', optionsFrom: 'calendars', help: 'Leave empty to use your primary calendar.' },
    {
      key: 'mode',
      label: 'Layout',
      type: 'select',
      default: 'schedule',
      options: [
        { label: 'Now & next (focus)', value: 'schedule' },
        { label: 'Agenda list', value: 'agenda' },
      ],
    },
    { key: 'days', label: 'Look ahead', type: 'number', min: 1, max: 14, default: 2, unit: 'days' },
    { key: 'alertSeconds', label: 'Alert when this much time is left', type: 'number', min: 10, max: 900, default: 60, unit: 'seconds' },
    { key: 'showAllDay', label: 'Show all-day events', type: 'boolean', default: true },
    { key: 'showLocation', label: 'Show location', type: 'boolean', default: true },
    { key: 'hour12', label: '12-hour clock', type: 'boolean', default: false },
  ],
};
export default manifest;
