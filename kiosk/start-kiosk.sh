#!/usr/bin/env bash
# Launches Chromium full-screen on the MagicDash server. Called from the desktop autostart.
URL="${MAGICDASH_URL:-http://localhost:3210}"

# Wait for the server (it may still be starting after boot).
for _ in $(seq 1 60); do
  curl -fs "$URL/api/health" >/dev/null 2>&1 && break
  sleep 1
done

# X11 only: never blank the screen, hide the cursor.
if [ -n "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ]; then
  xset s off; xset -dpms; xset s noblank
  command -v unclutter >/dev/null && unclutter -idle 1 -root &
fi

BROWSER=$(command -v chromium || command -v chromium-browser)
FLAGS=(
  --kiosk "$URL"
  --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-features=TranslateUI
  --check-for-update-interval=31536000 --autoplay-policy=no-user-gesture-required
  --disable-pinch --overscroll-history-navigation=0 --no-first-run --password-store=basic
  --user-data-dir="$HOME/.config/magicdash-kiosk"
)
[ -n "$WAYLAND_DISPLAY" ] && FLAGS+=(--ozone-platform=wayland --enable-features=UseOzonePlatform)

# Chromium remembers a crash and shows a restore bar; wipe that flag.
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
  "$HOME/.config/magicdash-kiosk/Default/Preferences" 2>/dev/null || true

exec "$BROWSER" "${FLAGS[@]}"
