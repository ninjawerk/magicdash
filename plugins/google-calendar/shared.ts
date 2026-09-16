export interface CalEvent {
  id: string;
  title: string;
  /** ISO string. For all-day events this is local midnight of the first day. */
  start: string;
  /** ISO string, exclusive. */
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  calendarId: string;
  calendarName: string;
  color?: string;
  status?: string;
  htmlLink?: string;
}

export interface Status {
  configured: boolean;
  /** Google account connected. */
  connected: boolean;
  /** Number of ICS feeds configured. */
  icsCount: number;
  email?: string;
  redirectUri: string;
  error?: string;
}
