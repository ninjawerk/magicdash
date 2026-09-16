#!/usr/bin/env bash
# First-boot provisioner for the MagicDash image. Runs once as root via magicdash-provision.service.
set -uo pipefail
LOG=/var/log/magicdash-provision.log
exec > >(tee -a "$LOG") 2>&1
echo "=== MagicDash provisioning started $(date -Is) ==="
. /etc/default/magicdash 2>/dev/null || true
MD_USER="${MD_USER:-magicdash}"
DIR=/opt/magicdash

# Wait for the user to exist (Pi OS creates it from userconf.txt on first boot) and for the network.
for _ in $(seq 1 60); do id "$MD_USER" >/dev/null 2>&1 && break; sleep 2; done
id "$MD_USER" >/dev/null 2>&1 || { echo "user $MD_USER not found — did userconf run?"; exit 1; }
HOME_DIR=$(getent passwd "$MD_USER" | cut -d: -f6)
chown -R "$MD_USER:$MD_USER" "$DIR"

echo "waiting for network…"
for _ in $(seq 1 150); do
  curl -fsI https://deb.debian.org >/dev/null 2>&1 && break
  sleep 2
done

if [ -f /etc/magicdash-wifi-country ] && command -v raspi-config >/dev/null; then
  raspi-config nonint do_wifi_country "$(cat /etc/magicdash-wifi-country)" || true
fi

# The kiosk autostart came from /etc/skel; make sure it is in place even if the home pre-existed.
mkdir -p "$HOME_DIR/.config/labwc" "$HOME_DIR/.config/autostart"
grep -qF "$DIR/kiosk/start-kiosk.sh" "$HOME_DIR/.config/labwc/autostart" 2>/dev/null || echo "$DIR/kiosk/start-kiosk.sh &" >> "$HOME_DIR/.config/labwc/autostart"
cp -n /etc/skel/.config/autostart/magicdash-kiosk.desktop "$HOME_DIR/.config/autostart/" 2>/dev/null || true
chown -R "$MD_USER:$MD_USER" "$HOME_DIR/.config"

# Run the normal installer as the user (it uses sudo internally; the first user has passwordless sudo).
echo "running kiosk/install.sh as $MD_USER"
if sudo -u "$MD_USER" -H bash -c "cd '$DIR' && MAGICDASH_UNATTENDED=1 bash kiosk/install.sh"; then
  date -Is > "$DIR/.provisioned"
  chown "$MD_USER:$MD_USER" "$DIR/.provisioned"
  systemctl disable magicdash-provision.service 2>/dev/null || true
  echo "=== provisioning finished $(date -Is); rebooting ==="
  sleep 2
  systemctl reboot
else
  echo "=== provisioning FAILED $(date -Is) — it will retry on next boot. Log: $LOG ==="
  exit 1
fi
