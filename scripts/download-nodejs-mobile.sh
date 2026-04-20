#!/usr/bin/env bash
# =============================================================================
# download-nodejs-mobile.sh
#
# Downloads the nodejs-mobile-android AAR from janeasystems GitHub releases
# and places it in android/app/libs/ for use as a local file dependency.
#
# Usage:
#   ./scripts/download-nodejs-mobile.sh [version]
#
#   version defaults to 0.3.2
# =============================================================================
set -euo pipefail

REPO="janeasystems/nodejs-mobile-android"
VERSION="${1:-0.3.2}"
DEST="android/app/libs"
FILENAME="nodejs-mobile-android.aar"
URL="https://github.com/${REPO}/releases/download/v${VERSION}/nodejs-mobile-android-${VERSION}.aar"

cd "$(dirname "$0")/.."

echo "Downloading nodejs-mobile-android v${VERSION}…"
mkdir -p "${DEST}"

if command -v curl &>/dev/null; then
  curl -fL --progress-bar -o "${DEST}/${FILENAME}" "${URL}"
elif command -v wget &>/dev/null; then
  wget -q --show-progress -O "${DEST}/${FILENAME}" "${URL}"
else
  echo "ERROR: curl or wget is required." >&2
  exit 1
fi

echo "Saved to ${DEST}/${FILENAME}"
echo ""
echo "Next: run ./scripts/sync-android.sh, then open android/ in Android Studio."
