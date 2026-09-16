#!/usr/bin/env bash
# One-shot setup for Raspberry Pi OS (Bookworm / Trixie, Desktop edition).
#   git clone <repo> ~/magicdash && cd ~/magicdash && bash kiosk/install.sh
#
# What it does:
#   1. installs Node 22, Chromium and helpers
#   2. builds the app and registers a systemd service (starts on boot, restarts on crash)
#   3. turns on desktop auto-login and SSH, turns off screen blanking
#   4. adds a kiosk autostart entry so Chromium opens the dashboard full-screen at login
set -euo pipefail
cd "$(dirname "$0")/.."
DIR=$(pwd)
USER_NAME=$(id -un)
PORT="${MAGICDASH_PORT:-3210}"

step() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }

export DEBIAN_FRONTEND=noninteractive
step "Installing packages"
sudo apt-get update -qq
sudo apt-get install -y -qq curl git unclutter avahi-daemon >/dev/null
sudo apt-get install -y -qq chromium >/dev/null 2>&1 || sudo apt-get install -y -qq chromium-browser >/dev/null

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  step "Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
  sudo apt-get install -y -qq nodejs >/dev/null
fi
echo "  Node $(node -v)"

step "Installing dependencies & building"
[ -f package-lock.json ] && npm ci --no-audit --no-fund || npm install --no-audit --no-fund
npm run build

step "Installing systemd service (starts on boot)"
sed -e "s#__USER__#$USER_NAME#g" -e "s#__DIR__#$DIR#g" -e "s#__NPM__#$(command -v npm)#g" -e "s#MAGICDASH_PORT=3210#MAGICDASH_PORT=$PORT#" \
  kiosk/magicdash.service | sudo tee /etc/systemd/system/magicdash.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now magicdash.service
sleep 2
if curl -fs "http://localhost:$PORT/api/health" >/dev/null; then echo "  server is up on :$PORT"; else echo "  ! server not answering yet — check: journalctl -u magicdash -e"; fi

step "Desktop auto-login, SSH on, screen blanking off"
if command -v raspi-config >/dev/null; then
  sudo raspi-config nonint do_boot_behaviour B4 || true   # boot to desktop, auto-login
  sudo raspi-config nonint do_ssh 0 || true               # enable SSH (for remote maintenance / OAuth tunnel)
  sudo raspi-config nonint do_blanking 1 || true          # disable screen blanking
else
  echo "  raspi-config not found — set auto-login and screen blanking manually."
fi

step "Kiosk autostart (Chromium full-screen at login)"
chmod +x kiosk/start-kiosk.sh
LINE="$DIR/kiosk/start-kiosk.sh"
added=0
# labwc (Raspberry Pi OS Bookworm 2024-10+ and Trixie)
if command -v labwc >/dev/null || [ -d "$HOME/.config/labwc" ]; then
  mkdir -p "$HOME/.config/labwc"
  grep -qF "$LINE" "$HOME/.config/labwc/autostart" 2>/dev/null || echo "$LINE &" >> "$HOME/.config/labwc/autostart"
  echo "  labwc: ~/.config/labwc/autostart"; added=1
fi
# Wayfire (early Bookworm)
if [ -f "$HOME/.config/wayfire.ini" ] || command -v wayfire >/dev/null; then
  touch "$HOME/.config/wayfire.ini"
  if ! grep -qF "$LINE" "$HOME/.config/wayfire.ini"; then
    grep -q '^\[autostart\]' "$HOME/.config/wayfire.ini" || printf '\n[autostart]\n' >> "$HOME/.config/wayfire.ini"
    sed -i "/^\[autostart\]/a magicdash = $LINE" "$HOME/.config/wayfire.ini"
  fi
  echo "  wayfire: ~/.config/wayfire.ini [autostart]"; added=1
fi
# LXDE / X11 (Bullseye and older, or if you switched back to X11)
if [ -f /etc/xdg/lxsession/LXDE-pi/autostart ]; then
  mkdir -p "$HOME/.config/lxsession/LXDE-pi"
  [ -f "$HOME/.config/lxsession/LXDE-pi/autostart" ] || cp /etc/xdg/lxsession/LXDE-pi/autostart "$HOME/.config/lxsession/LXDE-pi/autostart"
  grep -qF "$LINE" "$HOME/.config/lxsession/LXDE-pi/autostart" || echo "@$LINE" >> "$HOME/.config/lxsession/LXDE-pi/autostart"
  echo "  LXDE: ~/.config/lxsession/LXDE-pi/autostart"; added=1
fi
# Fallback that every freedesktop session honours
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/magicdash-kiosk.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=MagicDash kiosk
Exec=$LINE
X-GNOME-Autostart-enabled=true
DESKTOP
[ "$added" = 1 ] || echo "  using ~/.config/autostart/magicdash-kiosk.desktop"

HOST=$(hostname)
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
cat <<MSG

✔ Done.

  On this Pi:            http://localhost:$PORT   (Chromium opens it full-screen at every login)
  From your laptop:      http://$HOST.local:$PORT   or   http://$IP:$PORT
  Admin panel:           http://$HOST.local:$PORT/admin   (first visit sets the admin password)

  Start the kiosk now:   sudo reboot
  Server logs:           journalctl -u magicdash -f
  Kiosk log:             ~/.local/state/magicdash-kiosk.log
  Update later:          cd $DIR && git pull && npm ci && npm run build && sudo systemctl restart magicdash
MSG
