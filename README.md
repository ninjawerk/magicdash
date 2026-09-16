# MagicDash

A plugin-based kiosk dashboard for a Raspberry Pi (or any always-on screen).
Drag-and-resize tiles, each backed by a plugin: your schedule front and centre, weather,
Home Assistant, photos, quotes — and anything else you write in a few dozen lines.


**Highlights**

- **Schedule first.** The Google Calendar tile shows what's on *now*, how long is left with a progress bar,
  what's *next* and a countdown to it. If nothing is on, it counts down to the next thing. In the final minute
  of an event the tile turns red and pulses.
- **Tile grid.** Press `E` (or tap the pencil) to drag, resize, add and remove tiles. Every tile has its own settings.
- **Themes.** Eleven presets — Midnight, Pure black, Nord, Dracula, Solarized, Forest, Ocean, Sunset, Rosé and two
  light ones — plus full control over background, accent, text and tile colours. Changes preview live.
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
git clone <this repo> ~/magicdash
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
address. The dashboard has no login of its own, so don't forward port 3210 on your router.

### If the screen still sleeps or the kiosk doesn't appear

- Screen: *Raspberry Pi Configuration → Display → Screen Blanking → Off*. On X11 sessions the kiosk script also runs `xset s off -dpms`.
- Kiosk didn't start: make sure the Pi boots to the desktop with auto-login (*Raspberry Pi Configuration → System → Auto Login*),
  then check `~/.local/state/magicdash-kiosk.log`.
- Server didn't start: `systemctl status magicdash`.

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
kiosk/         Pi install script, systemd unit, Chromium kiosk launcher, first-boot waiting page
image/         Flashable Raspberry Pi OS image builder + first-boot provisioner + Imager repo file
data/          Runtime state (layout.json, settings.json, plugin data) — git-ignored
```

## Installing a custom plugin

*Edit → Add → Install a plugin…* and upload a plugin `.zip` or folder. The dashboard writes it to `plugins/`,
rebuilds and restarts itself; the new widget then shows up in the Add dialog. Custom plugins can be removed from
the same dialog. Only install plugins you trust — they run on the Pi. Disable browser upload with
`MAGICDASH_PLUGIN_UPLOAD=off` in the systemd unit.

Manual alternative: copy the folder into `plugins/`, then `npm run build && sudo systemctl restart magicdash`.

## Writing a plugin

```bash
npm run new-plugin my-widget "My Widget"   # scaffold from plugins/_template
npm run pack-plugin my-widget              # zip it up to share
```

Full guide: [docs/PLUGINS.md](docs/PLUGINS.md).

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | server + Vite with hot reload |
| `npm run build` | production frontend build to `dist/` |
| `npm start` | production server (serves `dist/` and the API on `MAGICDASH_PORT`, default 3210) |
| `npm run typecheck` | TypeScript check across host, SDK and plugins |
| `npm run new-plugin <id>` | scaffold a plugin |
| `npm run pack-plugin <id>` | zip a plugin for sharing / uploading |

Environment: `MAGICDASH_PORT` (3210), `MAGICDASH_DATA` (`./data`), `PUBLIC_URL` (used for OAuth redirects when set),
`MAGICDASH_PLUGIN_UPLOAD=off` (disable installing plugins from the browser).
