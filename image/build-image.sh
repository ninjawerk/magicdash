#!/usr/bin/env bash
# Build a flashable Raspberry Pi OS image with MagicDash baked in.
#
# Runs on Linux as root (needs losetup / mount). On macOS or Windows use image/build-in-docker.sh,
# or let GitHub Actions do it (.github/workflows/build-image.yml).
#
# What ends up in the image:
#   • Raspberry Pi OS (64-bit, Desktop) as published by Raspberry Pi
#   • the MagicDash source tree in /opt/magicdash (owned by the first user)
#   • a first-boot provisioner (image/provision.sh) that installs Node + Chromium, builds the app,
#     registers the systemd service and kiosk autostart, then reboots into the dashboard
#   • hostname, a user with password, SSH enabled, optional Wi-Fi, timezone, and no welcome wizard
#
# Environment variables (all optional):
#   RASPIOS_URL        image to start from (.img.xz)           default: pinned Bookworm arm64 desktop
#   OUT_DIR            where to write results                 default: ./image/out
#   IMAGE_NAME         base name of the output                default: magicdash-<version>-raspios-arm64
#   MD_HOSTNAME        hostname                               default: magicdash
#   MD_USER            login user                             default: magicdash
#   MD_PASSWORD        login password                         default: magicdash  (change it after first login!)
#   MD_TIMEZONE        e.g. Europe/London                     default: Etc/UTC
#   MD_KEYMAP          e.g. gb                                default: us
#   WIFI_SSID / WIFI_PSK / WIFI_COUNTRY   pre-configure Wi-Fi (country is the 2-letter code)
#   SKIP_COMPRESS=1    leave the .img uncompressed
set -euo pipefail

SRC_DIR=$(cd "$(dirname "$0")/.." && pwd)
RASPIOS_URL="${RASPIOS_URL:-https://downloads.raspberrypi.com/raspios_arm64/images/raspios_arm64-2025-05-13/2025-05-13-raspios-bookworm-arm64.img.xz}"
OUT_DIR="${OUT_DIR:-$SRC_DIR/image/out}"
VERSION=$(node -p "require('$SRC_DIR/package.json').version" 2>/dev/null || sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$SRC_DIR/package.json" | head -1)
IMAGE_NAME="${IMAGE_NAME:-magicdash-${VERSION}-raspios-arm64}"
MD_HOSTNAME="${MD_HOSTNAME:-magicdash}"
MD_USER="${MD_USER:-magicdash}"
MD_PASSWORD="${MD_PASSWORD:-magicdash}"
MD_TIMEZONE="${MD_TIMEZONE:-Etc/UTC}"
MD_KEYMAP="${MD_KEYMAP:-us}"
WIFI_SSID="${WIFI_SSID:-}"
WIFI_PSK="${WIFI_PSK:-}"
WIFI_COUNTRY="${WIFI_COUNTRY:-}"

step() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
# Inside containers (Docker Desktop) udev doesn't create /dev/loopNpM — make the nodes from /sys.
part_nodes() {
  local loop=$1 n
  partprobe "$loop" 2>/dev/null || partx -u "$loop" 2>/dev/null || true
  for d in /sys/block/"$(basename "$loop")"/"$(basename "$loop")"p*; do
    [ -e "$d/dev" ] || continue
    n=/dev/$(basename "$d")
    [ -e "$n" ] || mknod "$n" b "$(cut -d: -f1 "$d/dev")" "$(cut -d: -f2 "$d/dev")"
  done
}
die() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "Run as root (sudo) — mounting the image needs it."
for t in losetup mount xz sha256sum tar openssl; do command -v "$t" >/dev/null || die "Missing tool: $t"; done
[[ "$MD_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || die "MD_USER must be a lowercase unix username"

mkdir -p "$OUT_DIR" "$OUT_DIR/cache"
IMG="$OUT_DIR/$IMAGE_NAME.img"

# --- 1. Base image -----------------------------------------------------------------
step "Base image"
BASE_XZ="$OUT_DIR/cache/$(basename "$RASPIOS_URL")"
if [ ! -f "$BASE_XZ" ]; then
  echo "  downloading $RASPIOS_URL"
  curl -fL --retry 3 -o "$BASE_XZ.part" "$RASPIOS_URL" && mv "$BASE_XZ.part" "$BASE_XZ"
else
  echo "  using cached $(basename "$BASE_XZ")"
fi
echo "  decompressing → $IMG"
xz -dkc "$BASE_XZ" > "$IMG"
# Headroom in the root partition for /opt/magicdash: grow the image, then partition 2 (on the file, before
# attaching it — re-reading partition tables on loop devices is flaky inside containers), then the filesystem.
truncate -s +256M "$IMG"
if command -v sfdisk >/dev/null; then
  echo ", +" | sfdisk -q -N 2 --no-reread --no-tell-kernel "$IMG" >/dev/null 2>&1 || echo "  ! could not grow partition 2 (continuing)"
fi

# --- 2. Mount ------------------------------------------------------------------------
step "Mounting"
LOOP=$(losetup --find --show -P "$IMG")
part_nodes "$LOOP"
cleanup() {
  set +e
  sync
  [ -n "${MNT:-}" ] && { umount "$MNT/boot/firmware" 2>/dev/null; umount "$MNT/boot" 2>/dev/null; umount "$MNT" 2>/dev/null; }
  [ -n "${LOOP:-}" ] && losetup -d "$LOOP" 2>/dev/null
}
trap cleanup EXIT
if command -v resize2fs >/dev/null; then
  e2fsck -pf "${LOOP}p2" >/dev/null 2>&1 || true
  resize2fs "${LOOP}p2" >/dev/null 2>&1 || echo "  ! resize2fs failed (continuing)"
fi
MNT=$(mktemp -d)
mount "${LOOP}p2" "$MNT"
BOOT="$MNT/boot/firmware"
[ -d "$BOOT" ] || BOOT="$MNT/boot"
mount "${LOOP}p1" "$BOOT"
echo "  root: $MNT   boot: $BOOT"
[ -f "$MNT/etc/os-release" ] || die "That doesn't look like a Raspberry Pi OS image."
grep -q 'VERSION_CODENAME=bookworm' "$MNT/etc/os-release" || echo "  ! image is not Bookworm — this script is tested against Bookworm; proceeding anyway."

# --- 3. Boot partition: user, ssh ---------------------------------------------------------
step "First user, SSH"
HASH=$(openssl passwd -6 "$MD_PASSWORD")
echo "$MD_USER:$HASH" > "$BOOT/userconf.txt"    # Pi OS creates this user on first boot (uid 1000, sudo)
touch "$BOOT/ssh"                                # enables the SSH server
echo "  user $MD_USER, ssh enabled"

# --- 4. Root partition: hostname, timezone, keymap, wifi -----------------------------------------
step "System settings"
echo "$MD_HOSTNAME" > "$MNT/etc/hostname"
sed -i "s/^127\.0\.1\.1.*/127.0.1.1\t$MD_HOSTNAME/" "$MNT/etc/hosts"
grep -q '^127.0.1.1' "$MNT/etc/hosts" || printf '127.0.1.1\t%s\n' "$MD_HOSTNAME" >> "$MNT/etc/hosts"
if [ -f "$MNT/usr/share/zoneinfo/$MD_TIMEZONE" ]; then
  ln -sf "/usr/share/zoneinfo/$MD_TIMEZONE" "$MNT/etc/localtime"
  echo "$MD_TIMEZONE" > "$MNT/etc/timezone"
fi
if [ -f "$MNT/etc/default/keyboard" ]; then sed -i "s/^XKBLAYOUT=.*/XKBLAYOUT=\"$MD_KEYMAP\"/" "$MNT/etc/default/keyboard"; fi
if [ -n "$WIFI_SSID" ]; then
  mkdir -p "$MNT/etc/NetworkManager/system-connections"
  UUID=$(cat /proc/sys/kernel/random/uuid)
  cat > "$MNT/etc/NetworkManager/system-connections/magicdash-wifi.nmconnection" <<NM
[connection]
id=$WIFI_SSID
uuid=$UUID
type=wifi
autoconnect=true

[wifi]
mode=infrastructure
ssid=$WIFI_SSID

[wifi-security]
key-mgmt=wpa-psk
psk=$WIFI_PSK

[ipv4]
method=auto

[ipv6]
method=auto
NM
  chmod 600 "$MNT/etc/NetworkManager/system-connections/magicdash-wifi.nmconnection"
  echo "  wifi: $WIFI_SSID"
fi
if [ -n "$WIFI_COUNTRY" ]; then
  echo "$WIFI_COUNTRY" > "$MNT/etc/magicdash-wifi-country"   # applied by provision.sh via raspi-config
fi
# No welcome wizard — the user is pre-configured.
rm -f "$MNT/etc/xdg/autostart/piwiz.desktop"
echo "  hostname $MD_HOSTNAME, timezone $MD_TIMEZONE, keymap $MD_KEYMAP"

# --- 5. MagicDash source + first-boot provisioner ------------------------------------------------
step "Copying MagicDash to /opt/magicdash"
mkdir -p "$MNT/opt/magicdash"
tar -C "$SRC_DIR" --exclude=node_modules --exclude=dist --exclude=data --exclude=.git --exclude='image/out' --exclude='*.zip' -cf - . | tar -C "$MNT/opt/magicdash" -xf -
mkdir -p "$MNT/opt/magicdash/data"
chown -R 1000:1000 "$MNT/opt/magicdash"           # uid/gid of the first user created by userconf
chmod +x "$MNT/opt/magicdash/kiosk/"*.sh "$MNT/opt/magicdash/image/"*.sh
echo "  $(du -sh "$MNT/opt/magicdash" | cut -f1)"

step "First-boot provisioner"
cat > "$MNT/etc/systemd/system/magicdash-provision.service" <<UNIT
[Unit]
Description=MagicDash first-boot setup (installs Node, Chromium, builds the dashboard)
After=network-online.target userconfig.service
Wants=network-online.target
ConditionPathExists=!/opt/magicdash/.provisioned

[Service]
Type=oneshot
ExecStart=/opt/magicdash/image/provision.sh
StandardOutput=journal+console
StandardError=journal+console
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
UNIT
mkdir -p "$MNT/etc/systemd/system/multi-user.target.wants"
ln -sf /etc/systemd/system/magicdash-provision.service "$MNT/etc/systemd/system/multi-user.target.wants/magicdash-provision.service"
echo "MD_USER=$MD_USER" > "$MNT/etc/default/magicdash"

# Kiosk autostart goes into /etc/skel so the first user gets it when their home is created.
mkdir -p "$MNT/etc/skel/.config/labwc" "$MNT/etc/skel/.config/autostart"
echo "/opt/magicdash/kiosk/start-kiosk.sh &" >> "$MNT/etc/skel/.config/labwc/autostart"
cat > "$MNT/etc/skel/.config/autostart/magicdash-kiosk.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=MagicDash kiosk
Exec=/opt/magicdash/kiosk/start-kiosk.sh
X-GNOME-Autostart-enabled=true
DESKTOP
# Boot to desktop with auto-login for that user (what raspi-config do_boot_behaviour B4 does).
mkdir -p "$MNT/etc/systemd/system/getty@tty1.service.d"
cat > "$MNT/etc/systemd/system/getty@tty1.service.d/autologin.conf" <<GETTY
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $MD_USER --noclear %I \$TERM
GETTY
if [ -f "$MNT/etc/lightdm/lightdm.conf" ]; then
  sed -i "s/^#\?autologin-user=.*/autologin-user=$MD_USER/" "$MNT/etc/lightdm/lightdm.conf"
  grep -q '^autologin-user=' "$MNT/etc/lightdm/lightdm.conf" || sed -i "/^\[Seat:\*\]/a autologin-user=$MD_USER" "$MNT/etc/lightdm/lightdm.conf"
fi
echo "  provision service enabled; kiosk autostart in /etc/skel; autologin for $MD_USER"

# --- 6. Finish ------------------------------------------------------------------------------
step "Unmounting"
sync
cleanup
trap - EXIT
LOOP=""; MNT=""

if [ "${SKIP_COMPRESS:-0}" != 1 ]; then
  step "Compressing"
  rm -f "$IMG.xz"
  xz -T0 -6 "$IMG"
  OUT="$IMG.xz"
else
  OUT="$IMG"
fi
(cd "$OUT_DIR" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256")
step "Done"
ls -lh "$OUT" "$OUT.sha256" | sed 's/^/  /'
cat <<MSG

  Flash with Raspberry Pi Imager (Choose OS → Use custom → this file), or:
    $( [ "${SKIP_COMPRESS:-0}" = 1 ] && echo "sudo dd if=$(basename "$OUT") of=/dev/sdX bs=4M status=progress" || echo "xz -dc $(basename "$OUT") | sudo dd of=/dev/sdX bs=4M status=progress" )
  First boot needs internet and takes ~10 minutes (installs Chromium + Node, builds the app), then reboots into the dashboard.
  Login: $MD_USER / $MD_PASSWORD  ·  http://$MD_HOSTNAME.local:3210 from your laptop
MSG
