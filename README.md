# MagicDash

A plugin-based kiosk dashboard for a Raspberry Pi (or any always-on screen).
Drag-and-resize tiles, each backed by a plugin: your schedule front and centre, weather,
Home Assistant, photos, quotes — and anything else you write in a few dozen lines.


**Highlights**

- **Schedule first.** The Google Calendar tile shows what's on *now*, how long is left with a progress bar,
  what's *next* and a countdown to it. If nothing is on, it counts down to the next thing. In the final minute
  of an event the tile turns red and pulses.
- **Tile grid.** Press `E` (or tap the pencil) to drag, resize, add and remove tiles. Every tile has its own settings.
- **Edit from anywhere.** The layout lives on the server. Open the dashboard on your phone or laptop, rearrange,
  and the kiosk updates live.
- **Plugins.** Each widget is a folder in `plugins/` with a manifest, a React component and an optional server module.
  Settings UIs are generated from the manifest. See [docs/PLUGINS.md](docs/PLUGINS.md).
- **Kiosk-ready.** One install script sets up a systemd service, Chromium in kiosk mode, and disables screen blanking.

## Bundled plugins

| Plugin | What it does |
| --- | --- |
| 📅 **Schedule (Google Calendar)** | Now / next / countdown, agenda mode, multiple calendars, red pulse in the final minute. Google OAuth **or** any ICS feed (Google secret address, iCloud, Outlook, Nextcloud). |
| ⛅ **Weather** | Current conditions, next hours, 7-day forecast with icons. Uses Open-Meteo — no API key. |
| 🏠 **Home Assistant** | Live entity states over websocket, tap to toggle lights/switches/covers/locks, tiles / list / big-value layouts. |
| 🖼️ **Random image** | Slideshow from a folder on the Pi, a list of URLs, or random photos. Ken Burns effect. |
| 💬 **Motivational quotes** | Bundled offline set, your own list, or ZenQuotes. |
| 🕰️ **Clock** | Big time & date, optional seconds / time zone. |

## Quick start (development)

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The API server runs on port 3210; Vite proxies `/api` to it.

## Install on a Raspberry Pi

Raspberry Pi OS Desktop (Bookworm or newer) with auto-login enabled. Then:

```bash
git clone <this repo> ~/magicdash
cd ~/magicdash
bash kiosk/install.sh
sudo reboot
```

The script installs Node 22 and Chromium, builds the frontend, registers `magicdash.service`
(serves on port 3210, restarts on failure), disables screen blanking and adds a kiosk autostart
entry for labwc, Wayfire or LXDE — whichever your Pi uses.

Useful afterwards:

```bash
journalctl -u magicdash -f        # server logs
sudo systemctl restart magicdash  # after git pull && npm run build
```

Open `http://<pi-ip>:3210` from any device on your network to edit the layout.

### Keeping the display on

`install.sh` runs `raspi-config nonint do_blanking 1`. If the screen still sleeps, open
*Raspberry Pi Configuration → Display → Screen Blanking → Off*. On X11 sessions `kiosk/start-kiosk.sh`
also runs `xset s off -dpms`.

## Configuring plugins

Enter edit mode (`E`), then either open a tile's settings (⚙ on the tile) or **Plugins** in the toolbar
for plugin-wide settings such as tokens. Secrets are stored in `data/settings.json` on the server
and never sent to the browser.

### Google Calendar

Two options — pick whichever is easier:

**A. ICS feeds (no Google Cloud setup).** In Google Calendar → calendar settings → *Integrate calendar*
→ copy the **Secret address in iCal format**. Paste it under *Plugins → Schedule → Extra calendar feeds*
as `Work | https://calendar.google.com/calendar/ical/…/basic.ics`. Works for iCloud/Outlook/Nextcloud too.
Feeds refresh every minute.

**B. Google account (OAuth).**

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project, enable the **Google Calendar API**,
   and create an **OAuth client ID** of type *Web application*.
2. Add the redirect URI shown in *Plugins → Schedule* (e.g. `http://localhost:5173/api/plugins/google-calendar/auth/callback`
   in dev, `http://localhost:3210/...` on the Pi). Google only allows plain `http://` for `localhost`, so do the
   connect step from a browser where the dashboard is reachable as localhost — on the Pi itself, or through
   `ssh -L 3210:localhost:3210 pi@raspberrypi.local` and then <http://localhost:3210>.
3. Paste the Client ID and Secret, **Save**, reopen the dialog and click **Connect Google**.

Then in each Schedule tile pick which calendars to show.

### Weather

Per tile: search a city (or type `lat, lon`), pick units. No key required.

### Home Assistant

*Plugins → Home Assistant*: your HA URL and a long-lived access token
(HA → Profile → Security → *Long-lived access tokens*). Then in each tile choose entities.
Tapping a light, switch, cover, lock, scene or script acts on it; disable this per tile if you like.

### Random image

To use photos on the Pi, set the folder in *Plugins → Random image* (e.g. `/home/pi/Pictures`), then choose
*Folder on the server* in the tile.

## Project layout

```
server/        Express API: layout & settings storage, SSE event bus, plugin loader
src/sdk/       Plugin SDK (types, client hooks, server context) — import from '@sdk/client' / '@sdk/server'
src/app/       Host UI: grid, tile chrome, auto-generated settings forms, toolbar
plugins/*/     One folder per plugin: manifest.ts, client.tsx, optional server.ts
kiosk/         Pi install script, systemd unit, Chromium kiosk launcher
data/          Runtime state (layout.json, settings.json, plugin data) — git-ignored
```

## Writing a plugin

```bash
npm run new-plugin my-widget "My Widget"
```

That copies `plugins/_template` and you're off. Full guide: [docs/PLUGINS.md](docs/PLUGINS.md).

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | server + Vite with hot reload |
| `npm run build` | production frontend build to `dist/` |
| `npm start` | production server (serves `dist/` and the API on `MAGICDASH_PORT`, default 3210) |
| `npm run typecheck` | TypeScript check across host, SDK and plugins |
| `npm run new-plugin <id>` | scaffold a plugin |

Environment: `MAGICDASH_PORT` (3210), `MAGICDASH_DATA` (`./data`), `PUBLIC_URL` (used for OAuth redirects when set).
