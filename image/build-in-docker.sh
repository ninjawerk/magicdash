#!/usr/bin/env bash
# Build the image from macOS / Windows / any Docker host. Needs Docker Desktop (privileged container for loop devices).
# Usage: bash image/build-in-docker.sh            (env vars from build-image.sh are passed through)
set -euo pipefail
cd "$(dirname "$0")/.."
docker run --rm --privileged \
  -v "$PWD:/src" -w /src \
  -e RASPIOS_URL -e IMAGE_NAME -e MD_HOSTNAME -e MD_USER -e MD_PASSWORD -e MD_TIMEZONE -e MD_KEYMAP \
  -e WIFI_SSID -e WIFI_PSK -e WIFI_COUNTRY -e SKIP_COMPRESS \
  debian:bookworm-slim bash -c '
    apt-get update -qq && apt-get install -y -qq --no-install-recommends curl xz-utils mount util-linux fdisk e2fsprogs parted openssl ca-certificates nodejs >/dev/null
    bash image/build-image.sh'
