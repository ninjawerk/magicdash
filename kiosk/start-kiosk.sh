#!/usr/bin/env bash
# Launches Chromium full-screen on the MagicDash server and keeps it running.
# Called from the desktop session's autostart (labwc / Wayfire / LXDE).
URL="${MAGICDASH_URL:-http://localhost:3210}"
PROFILE="$HOME/.config/magicdash-kiosk"
LOG="$HOME/.local/state/magicdash-kiosk.log"
mkdir -p "$(dirname "$LOG")" "$PROFILE"
exec >>"$LOG" 2>&1
echo "[$(date -Is)] kiosk starting → $URL (WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-} DISPLAY=${DISPLAY:-})"

# Wait for the server (it may still be starting after boot). Give up waiting after 2 min and open anyway;
# the page retries on its own until the API answers.
for _ in $(seq 1 120); do
  curl -fs "$URL/api/health" >/dev/null 2>&1 && break
  sleep 1
done

# X11 only: never blank the screen, hide the idle cursor. (Wayland blanking is handled by raspi-config.)
if [ -n "${DISPLAY:-}" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
  xset s off; xset -dpms; xset s noblank
  command -v unclutter >/dev/null && unclutter -idle 1 -root &
fi

BROWSER=$(command -v chromium || command -v chromium-browser)
if [ -z "$BROWSER" ]; then echo "chromium not found"; exit 1; fi

FLAGS=(
  --kiosk --start-fullscreen --start-maximized
  --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-features=TranslateUI
  --disable-component-update --check-for-update-interval=31536000
  --autoplay-policy=no-user-gesture-required --disable-pinch --overscroll-history-navigation=0
  --no-first-run --password-store=basic --disable-translate --hide-scrollbars
  --user-data-dir="$PROFILE"
)
[ -n "${WAYLAND_DISPLAY:-}" ] && FLAGS+=(--ozone-platform=wayland --enable-features=UseOzonePlatform)

while true; do
  # Chromium remembers a crash and shows a restore bar; clear that flag before each launch.
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
    "$PROFILE/Default/Preferences" 2>/dev/null || true
  "$BROWSER" "${FLAGS[@]}" "$URL"
  echo "[$(date -Is)] chromium exited ($?) — restarting in 3s"
  sleep 3
done
