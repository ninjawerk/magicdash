# MagicDash

A plugin-based kiosk dashboard for a Raspberry Pi (or any always-on screen).
Drag-and-resize tiles, each backed by a plugin: your schedule front and centre, weather,
Home Assistant, photos, quotes — and anything else you write in a few dozen lines.


**Highlights**

- **Schedule first.** The Google Calendar tile shows what's on *now*, how long is left with a progress bar,
  what's *next* and a countdown to it. If nothing is on, it counts down to the next thing. In the final minute
  of an event the tile turns red and pulses.
- **Tile grid.** Press `E` (or tap the pencil) to drag, resize, add and remove tiles. Other tiles stay put while you drag; hold a tile over
  another for a moment and they swap places, like phone home screens. If the other tile doesn't fit in your old slot it
  moves to the nearest free spot; if there's no room anywhere the highlight turns red and nothing changes. Every tile has its own settings.
- **Themes.** Eleven presets — Midnight, Pure black, Nord, Dracula, Solarized, Forest, Ocean, Sunset, Rosé and two
  light ones — plus full control over background, accent, text and tile colours. Changes preview live.
- **Screens.** Several pages of tiles that rotate every N seconds. Plugins can grab **attention** — the Schedule tile
  pulls its screen forward for the last minute of an event and the two minutes before the next; Home Assistant can do
  it when a door opens. One plugin at a time, two minutes at most.
- **Admin panel** at `/admin`, password protected, Home Assistant style: live layout editor, screens, plugins and catalog,
  appearance, backup, live logs, one-click updates, API tokens. The kiosk view itself stays open on your network; editing
  needs the password.
- **Display control.** Schedule the panel off at night and on in the morning, wake it on motion or presence from Home
  Assistant, set brightness (hardware backlight on the official Touch Display, software dim elsewhere), and a **night mode**
  that dims and can switch theme.
- **Toasts.** `POST /api/notify {"message": "Washing machine done"}` from any automation pops a notification on every display.
- **Schedules.** Show a tile only between two times or on certain days; include a screen in rotation only during a window.
- **Greeting mode.** The quotes tile can greet by time of day and hint at the weather and your next event, in your language.
- **Edit from anywhere.** The layout lives on the server. Open `/admin` on your phone or laptop, rearrange, and the kiosk
  updates live.
- **Plugins.** Each widget is a folder in `plugins/` with a manifest, a React component and an optional server module.
  Settings UIs are generated from the manifest. See [docs/PLUGINS.md](docs/PLUGINS.md).
- **Kiosk-ready.** One install script sets up a systemd service, Chromium in kiosk mode, and disables screen blanking.

## Bundled plugins

| Plugin | What it does |
| --- | --- |
| 📅 **Schedule (Google Calendar)** | Now / next / countdown, agenda mode, multiple calendars, red pulse in the final minute. Google OAuth **or** any ICS feed (Google secret address, iCloud, Outlook, Nextcloud). |
| ⛅ **Weather** | Current conditions, next hours, 7-day forecast with icons. Uses Open-Meteo — no API key. |
| 🏠 **Home Assistant** | Live entity states over websocket, tap to toggle lights/switches/covers/locks, tiles / list / big-value layouts. |
| 🖼️ **Random image** | Slideshow by subject from free providers (Wikimedia Commons, NASA, Cleveland Museum of Art, LoremFlickr — no key; Unsplash, Pexels, Pixabay with a free key), a folder on the Pi, or your own URLs. Ken Burns effect. |
| 💬 **Motivational quotes** | Bundled offline set, your own list, or ZenQuotes. |
| 🕰️ **Clock** | Big time & date, optional seconds / time zone, blinking colon. |
| 📰 **News headlines** | Any RSS/Atom feeds — rotating big headline with the article image as background, or a list. |
| 📖 **Word of the day** | Merriam-Webster or Wiktionary, with pronunciation and definition. |
| 🔳 **QR code** | Guest Wi-Fi login, a link or any text as a scannable code. |
| 🪐 **Rahu Kaala** | Today’s Rahu Kaala and the auspicious Abhijit Muhurta (plus Yamagandam, Gulika) from local sunrise/sunset, live countdown, red while running. Offline. |

## Community plugins (catalog)

Installed with one click from *Admin → Plugins → Browse catalog*. Each lives in its own repo and is pinned by checksum in
[magicdash-plugins](https://github.com/ninjawerk/magicdash-plugins).

| Plugin | What it does |
| --- | --- |
| ✅ [Tasks](https://github.com/ninjawerk/magicdash-tasks) | Today’s to-dos from Todoist, Google Tasks or a Home Assistant list. Tap to complete. |
| ⏲️ [Timers](https://github.com/ninjawerk/magicdash-timers) | Tap-to-start kitchen and focus timers with presets; loud finish, shared across displays. |
| 🗓️ [Calendar week & month](https://github.com/ninjawerk/magicdash-calendar-grid) | Week strip / month grid on top of the bundled Schedule plugin. |
| 🚌 [Transit departures](https://github.com/ninjawerk/magicdash-transit) | Next buses, trams and trains from any stop worldwide, with real-time delays. |
| 📌 [Message board](https://github.com/ninjawerk/magicdash-message-board) | A shared household note, posted from the admin, your phone or an automation. |
| 🏡 [Home Assistant cards](https://github.com/ninjawerk/magicdash-ha-cards) | Camera, thermostat with controls, media player with album art, sensor history. |
| 🌬️ [Air quality & pollen](https://github.com/ninjawerk/magicdash-air-quality) | AQI, particulates, ozone, NO₂ and pollen for your location. |
| 📷 [Photo album](https://github.com/ninjawerk/magicdash-photo-album) | Your own photos from an Immich album or a Nextcloud / WebDAV folder. |
| ⏳ [Countdown](https://github.com/ninjawerk/magicdash-countdown) | Days, hours and minutes until a date, with repeat rules. The plugin from the tutorial. |

## Quick start (development)

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The API server runs on port 3210; Vite proxies `/api` to it.

## Option A: flash a ready-made image

Download the latest `magicdash-*-raspios-arm64.img.xz` from the project's Releases page and flash it with
[Raspberry Pi Imager](https://www.raspberrypi.com/software/) (*Choose OS → Use custom*) or `dd`. Boot the Pi
with an ethernet cable or a pre-baked Wi-Fi (see below).

- First boot shows a **"Setting up MagicDash"** screen while it installs Chromium and Node and builds the app —
  about 10 minutes with internet — then the Pi reboots straight into the full-screen dashboard.
- Login is `magicdash` / `magicdash`, hostname `magicdash`, SSH on. Change the password after first login (`passwd`).
- Edit from your laptop at `http://magicdash.local:3210`.

The image is the official Raspberry Pi OS (64-bit, Desktop) with MagicDash in `/opt/magicdash` and a one-shot
first-boot service. Works on Pi 3, 4, 5 and Zero 2 W (slow build).

### Building the image yourself

On Linux (needs root for loop mounts):

```bash
sudo bash image/build-image.sh
```

On macOS or Windows with Docker Desktop:

```bash
bash image/build-in-docker.sh
```

Options are environment variables, e.g. bake in your Wi-Fi and locale:

```bash
WIFI_SSID="Home" WIFI_PSK="secret" WIFI_COUNTRY=GB MD_TIMEZONE=Europe/London MD_KEYMAP=gb MD_PASSWORD=changeme sudo -E bash image/build-image.sh
```

Output lands in `image/out/` as `.img.xz` plus a `.sha256`. The GitHub Actions workflow in
`.github/workflows/build-image.yml` builds the image on every `v*` tag and attaches it to the release, and can be run
manually with a Wi-Fi SSID (put the passphrase in a `WIFI_PSK` repository secret). `image/os_list.json` is a
Raspberry Pi Imager repository file: host it and users can pick MagicDash inside Imager
(`rpi-imager --repo <url>`), after replacing `OWNER/REPO` and the version.

## Option B: install on an existing Raspberry Pi OS

Raspberry Pi OS Desktop (Bookworm or newer). Then:

```bash
git clone https://github.com/ninjawerk/magicdash.git ~/magicdash
cd ~/magicdash
bash kiosk/install.sh
sudo reboot
```

The script:

1. installs Node 22, Chromium and helpers;
2. builds the frontend and registers **`magicdash.service`** — the server starts on boot, before login,
   and restarts itself if it crashes;
3. turns on **desktop auto-login** and **SSH**, and turns off **screen blanking**;
4. adds a **kiosk autostart** entry (labwc, Wayfire, LXDE and a generic `.desktop` fallback) that runs
   `kiosk/start-kiosk.sh` at login: it waits for the server, then opens Chromium with `--kiosk --start-fullscreen`
   and relaunches it if it ever closes.

After `sudo reboot` the Pi comes up straight into the full-screen dashboard. The mouse cursor hides after a
few seconds of inactivity.

Useful afterwards:

```bash
journalctl -u magicdash -f              # server logs
tail -f ~/.local/state/magicdash-kiosk.log   # kiosk/Chromium log
sudo systemctl restart magicdash        # after git pull && npm ci && npm run build
```

### Editing from your laptop or phone

The layout lives on the Pi's server, so any browser on the same network can edit it and the kiosk
updates live. Open one of:

- `http://<hostname>.local:3210` — e.g. `http://raspberrypi.local:3210` (mDNS; works on macOS, iOS, Windows 10+, most Linux)
- `http://<pi-ip>:3210`

Press **E** or tap the pencil to enter edit mode. On the kiosk itself, *Edit → Remote* lists these addresses.

Away from home, put the Pi and your laptop on the same [Tailscale](https://tailscale.com) network
(`curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up` on the Pi) and use the Pi's Tailscale
address. The dashboard view has no login and the admin password is sent over plain http on your LAN, so don't forward port 3210
on your router; use Tailscale or a reverse proxy with TLS if you need remote access.

### If the screen still sleeps or the kiosk doesn't appear

- Screen: *Raspberry Pi Configuration → Display → Screen Blanking → Off*. On X11 sessions the kiosk script also runs `xset s off -dpms`.
- Kiosk didn't start: make sure the Pi boots to the desktop with auto-login (*Raspberry Pi Configuration → System → Auto Login*),
  then check `~/.local/state/magicdash-kiosk.log`.
- Server didn't start: `systemctl status magicdash`.

## Admin panel

Open `http://<pi>:3210/admin`. The first visit asks you to **set an admin password**; after that the panel and the
kiosk's edit mode require it (sessions last 30 days per browser). Pages:

| Page | |
| --- | --- |
| **Overview** | version, uptime, CPU temperature, memory, connected displays, addresses |
| **Layout** | the real grid in edit mode — drag, resize, add tiles, per-tile settings; the kiosk mirrors it live |
| **Screens** | add / rename / reorder screens, rotation interval |
| **Plugins** | plugin-wide settings (Google, Home Assistant, keys), catalog browse/install/update, upload, installed list |
| **Appearance** | theme presets and colours, grid size, language |
| **Display** | on/off, brightness, off/on schedule, presence wake via Home Assistant, night mode |
| **Devices** | every kiosk/browser showing the dashboard: online state, IP, viewport, current screen; per device: which screens it cycles, rotation, brightness, forced off; identify / reload / show-screen actions |
| **Backup** | export / import |
| **Logs** | live tail of the server and plugin logs with level filter and download |
| **Updates** | compares your checkout with the remote and the latest release; **Update now** runs `git pull`, `npm ci`, `npm run build` and restarts |
| **Settings** | change password, API tokens for the MCP server / automations |

Recovery: `npm run set-password <new>` on the Pi, then `sudo systemctl restart magicdash`. You can also preset the
password with `MAGICDASH_ADMIN_PASSWORD` in the systemd unit for unattended installs.

What stays public without a password: the dashboard view, plugin data routes the widgets use, `POST /api/screens/show`,
`POST /api/attention` and `POST /api/notify` (for automations; notify is rate limited). Everything that changes configuration needs a session cookie or an
`Authorization: Bearer <token>` header.

## Display, toasts and schedules

**Display** (Admin → Display): off/on schedule with weekdays, daytime brightness, night mode (dim between two times,
optional night theme), and presence wake: pick Home Assistant entities (motion, door, person) that wake the display for
N seconds or keep it on while home. Hardware paths used when available: `/sys/class/backlight/*` (the install script grants
the `video` group write access) and `wlr-randr` / `vcgencmd` for output power (or your own `MAGICDASH_DISPLAY_ON/OFF`
commands). Without them the kiosk dims in software and shows a black screen, which still works on any panel.

```bash
curl -X POST http://<pi>:3210/api/display -H 'Authorization: Bearer md_…' -H 'content-type: application/json' -d '{"on":false}'
```

**Devices**: a kiosk identifies itself with `?device=<name>` in its URL (the install script uses the hostname). Target one display
by adding `"deviceId": "kitchen"` to `/api/screens/show`, `/api/notify` or `/api/attention`; omit it to reach every display.

**Toasts**: `POST /api/notify` with `message`, optional `title`, `level` (info/success/warn/error), `durationSec`, `icon`,
`screen` + `switchScreen`. No token needed, max 30 per minute. Plugins can call `ctx.notify()` (server) or `props.notify()`.

**Schedules**: tile settings → *Visibility* (between two times, weekdays); Screens → the ⏱ button per screen sets its
rotation window. Hidden tiles keep their spot; scheduled-out screens are skipped.

**Language**: Admin → Settings → Language (also under Appearance) sets the locale for dates, times, the kiosk toolbar and every
plugin that ships translations. Host strings come in English, German, Dutch, French and Spanish; the greeting in English,
German and Dutch; Rahu Kaala in English, Tamil, Sinhala and Hindi. Plugins read the language via `props.locale` /
`useLocale()` and add their own strings with `translations`.

## Themes & grid

Edit mode → **Theme**. Pick a preset card, or open *Customise colours…* to set the background (any CSS value,
including `url(...)` for a wallpaper), accent, text and tile colours, corner radius and whether tile titles show.
The same dialog sets the grid: columns, rows, gap and screen padding. The grid always fills the screen exactly,
so more rows just means finer placement.

## Where data lives, backup & restore

Everything is in the `data/` folder next to the app (override with `MAGICDASH_DATA`):

| File | Contents |
| --- | --- |
| `data/layout.json` | tiles, per-tile settings, theme, grid |
| `data/settings.json` | plugin-wide settings, including tokens and API keys |
| `data/plugins/<id>/` | plugin files, e.g. Google sign-in tokens |

Edit mode → **Backup** downloads a single JSON file (optionally without secrets) and restores one,
with a choice of layout and/or plugin settings. The same endpoints work from a shell:

```bash
curl -o magicdash-backup.json "http://<pi>:3210/api/export?secrets=1"
```

```bash
curl -X POST http://<pi>:3210/api/import -H 'content-type: application/json' \
  -d "{\"backup\": $(cat magicdash-backup.json)}"
```

Or simply copy the `data/` folder — the server picks it up on restart.

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

### Dashboard location, name and units

*Appearance → Dashboard* sets facts every tile can use: your location (city search or `lat, lon`), your name (greetings)
and units. Weather, Rahu Kaala and the greeting use them unless a tile sets its own. Plugins receive them as
`props.context`.

### Weather

Per tile: optionally a location and units (defaults come from the dashboard). No key required.

### Home Assistant

*Plugins → Home Assistant*: your HA URL and a long-lived access token
(HA → Profile → Security → *Long-lived access tokens*). Then in each tile choose entities.
Tapping a light, switch, cover, lock, scene or script acts on it; disable this per tile if you like.

### Random image

Per tile, pick a source and type a **subject** (e.g. `mountains`, `van gogh`, `nebula`). Wikimedia Commons,
NASA, the Cleveland Museum of Art and LoremFlickr need no key. Unsplash, Pexels and Pixabay need a free API key,
entered once under *Plugins → Random image*. Results are cached on the server for 30 minutes so a tile never
hammers a provider. To show your own photos, set the folder in *Plugins → Random image* (e.g. `/home/pi/Pictures`),
then choose *Folder on the server* in the tile.

## Contributing & license

MIT. Issues and PRs welcome — plugins especially. CI runs typecheck, build and an MCP smoke test on every push.

## Project layout

```
server/        Express API: layout & settings storage, SSE event bus, plugin loader
src/sdk/       Plugin SDK (types, client hooks, server context) — import from '@sdk/client' / '@sdk/server'
src/app/       Host UI: grid, tile chrome, auto-generated settings forms, toolbar
plugins/*/     One folder per plugin: manifest.ts, client.tsx, optional server.ts
mcp/           MCP server for AI agents (stdio)
kiosk/         Pi install script, systemd unit, Chromium kiosk launcher, first-boot waiting page
image/         Flashable Raspberry Pi OS image builder + first-boot provisioner + Imager repo file
data/          Runtime state (layout.json, settings.json, plugin data) — git-ignored
```

## Installing more plugins

*Edit → Add → Browse & install plugins…* opens the **catalog**: a JSON index (default:
[ninjawerk/magicdash-plugins](https://github.com/ninjawerk/magicdash-plugins)) that the dashboard downloads and
searches locally. Each entry is pinned to a GitHub release zip and its SHA-256, which is verified before install.
Entries are labelled **reviewed** (a maintainer read that version) or **unreviewed** (listed on trust alone) — read
the label, because a plugin runs code on the Pi. You can add more indexes under *Sources* (a gist works fine).

The **Upload** tab takes a plugin `.zip` or folder. The dashboard writes it to `plugins/`,
rebuilds and restarts itself; the new widget then shows up in the Add dialog. Custom plugins can be removed from
the same dialog. Only install plugins you trust — they run on the Pi. Disable browser upload with
`MAGICDASH_PLUGIN_UPLOAD=off` in the systemd unit.

Manual alternative: copy the folder into `plugins/`, then `npm run build && sudo systemctl restart magicdash`.

## Control it from an AI agent (MCP)

`mcp/server.ts` is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the dashboard to
Claude Code, Claude Desktop, Cursor and friends: read the layout, add/move/configure tiles, manage screens and rotation,
switch themes, set plugin settings, pull a screen forward (attention lock), export/import backups, and even install a
plugin from source files and rebuild.

Create an API token under *Admin → Settings → API tokens*, then:

```bash
# Claude Code
claude mcp add magicdash -e MAGICDASH_URL=http://magicdash.local:3210 -e MAGICDASH_TOKEN=md_… -- npx tsx /path/to/magicdash/mcp/server.ts
```

Claude Desktop / other clients — `mcpServers` entry:

```json
{ "magicdash": { "command": "npx", "args": ["tsx", "/path/to/magicdash/mcp/server.ts"], "env": { "MAGICDASH_URL": "http://magicdash.local:3210", "MAGICDASH_TOKEN": "md_…" } } }
```

Then ask: *"add a weather tile for Amsterdam to the Main screen"*, *"make a second screen with news and word of the day and rotate every 20 s"*,
*"switch to the Sunset theme"*, *"write me a plugin that shows my bus departures"* (the agent reads `AGENTS.md`/`docs/PLUGINS.md`
via `read_plugin_docs`, installs with `install_plugin_files`, then `rebuild_and_restart`).

`npm run mcp:test` smoke-tests the server against a running dashboard. The same operations are plain HTTP, e.g. from a
Home Assistant automation: `POST /api/screens/show { "screenId": "Kitchen" }` or `POST /api/attention { "screenId": "Main", "reason": "Doorbell" }`
(these two need no token).

## Writing a plugin

```bash
npm run new-plugin my-widget "My Widget"   # scaffold from plugins/_template
npm run pack-plugin my-widget              # zip it up to share
```

Step-by-step tutorial: [docs/PLUGIN-TUTORIAL.md](docs/PLUGIN-TUTORIAL.md) · reference: [docs/PLUGINS.md](docs/PLUGINS.md) ·
for AI agents and contributors: [AGENTS.md](AGENTS.md).

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | server + Vite with hot reload |
| `npm run build` | production frontend build to `dist/` |
| `npm start` | production server (serves `dist/` and the API on `MAGICDASH_PORT`, default 3210) |
| `npm run typecheck` | TypeScript check across host, SDK and plugins |
| `npm run new-plugin <id>` | scaffold a plugin |
| `npm run pack-plugin <id>` | zip a plugin for sharing / uploading |
| `npm run mcp` | start the MCP server (stdio) for AI agents |
| `npm run mcp:test` | smoke-test the MCP server against a running dashboard |
| `npm run set-password <pw>` | reset the admin password (recovery) |

Environment: `MAGICDASH_PORT` (3210), `MAGICDASH_DATA` (`./data`), `PUBLIC_URL` (used for OAuth redirects when set),
`MAGICDASH_PLUGIN_UPLOAD=off` (disable installing plugins from the browser), `MAGICDASH_ADMIN_PASSWORD` (preset the admin
password on first start), `MAGICDASH_REPO` (GitHub repo checked for releases, default `ninjawerk/magicdash`).
