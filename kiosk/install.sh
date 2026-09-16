#!/usr/bin/env bash
# One-shot setup for Raspberry Pi OS (Bookworm / Trixie, Desktop edition with auto-login).
#   git clone <repo> ~/magicdash && cd ~/magicdash && bash kiosk/install.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DIR=$(pwd)
USER_NAME=$(id -un)

echo "▸ Installing packages"
sudo apt-get update -qq
sudo apt-get install -y -qq curl git unclutter >/dev/null
sudo apt-get install -y -qq chromium >/dev/null 2>&1 || sudo apt-get install -y -qq chromium-browser >/dev/null

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  echo "▸ Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
  sudo apt-get install -y -qq nodejs >/dev/null
fi
echo "▸ Node $(node -v)"

echo "▸ Installing dependencies & building"
npm ci --no-audit --no-fund
npm run build

echo "▸ Installing systemd service"
sed -e "s#__USER__#$USER_NAME#g" -e "s#__DIR__#$DIR#g" -e "s#__NPM__#$(command -v npm)#g" kiosk/magicdash.service \
  | sudo tee /etc/systemd/system/magicdash.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now magicdash.service

echo "▸ Disabling screen blanking"
sudo raspi-config nonint do_blanking 1 2>/dev/null || true

echo "▸ Configuring kiosk autostart"
chmod +x kiosk/start-kiosk.sh
LINE="$DIR/kiosk/start-kiosk.sh"
if [ -d "$HOME/.config/labwc" ] || [ "${XDG_SESSION_DESKTOP:-}" = "labwc" ] || command -v labwc >/dev/null; then
  mkdir -p "$HOME/.config/labwc"
  grep -qF "$LINE" "$HOME/.config/labwc/autostart" 2>/dev/null || echo "$LINE &" >> "$HOME/.config/labwc/autostart"
  echo "  labwc autostart updated"
fi
if [ -f "$HOME/.config/wayfire.ini" ]; then
  grep -qF "$LINE" "$HOME/.config/wayfire.ini" || printf '\n[autostart]\nmagicdash = %s\n' "$LINE" >> "$HOME/.config/wayfire.ini"
  echo "  wayfire autostart updated"
fi
mkdir -p "$HOME/.config/lxsession/LXDE-pi"
if [ -f /etc/xdg/lxsession/LXDE-pi/autostart ] && [ ! -f "$HOME/.config/lxsession/LXDE-pi/autostart" ]; then
  cp /etc/xdg/lxsession/LXDE-pi/autostart "$HOME/.config/lxsession/LXDE-pi/autostart"
fi
if [ -f "$HOME/.config/lxsession/LXDE-pi/autostart" ]; then
  grep -qF "$LINE" "$HOME/.config/lxsession/LXDE-pi/autostart" || echo "@$LINE" >> "$HOME/.config/lxsession/LXDE-pi/autostart"
  echo "  LXDE autostart updated"
fi

IP=$(hostname -I | awk '{print $1}')
cat <<MSG

✔ Done. MagicDash is running at http://localhost:3210 on this Pi.
  From another device:  http://$IP:3210   (edit the layout from your phone — the Pi updates live)
  Kiosk browser starts on next login/reboot:  sudo reboot
  Logs:  journalctl -u magicdash -f
MSG
