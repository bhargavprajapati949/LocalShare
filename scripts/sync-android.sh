#!/usr/bin/env bash
# =============================================================================
# sync-android.sh
#
# Prepares the Node.js project bundle for the Android APK.
#
# What it does:
#   1. Builds the TypeScript server (npm run build).
#   2. Installs production-only node_modules into a staging area.
#   3. Copies dist/ + node_modules/ + package.json into
#      android/app/src/main/assets/nodejs-project/.
#
# Run this every time you change server source code before building the APK.
#
# Usage:
#   ./scripts/sync-android.sh
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_DIR="${ROOT}/android/app/src/main/assets/nodejs-project"
STAGING="${ROOT}/.android-staging"

cd "${ROOT}"

echo "==> Building TypeScript…"
npm run build

echo "==> Installing production dependencies…"
rm -rf "${STAGING}"
mkdir -p "${STAGING}"
cp package.json package-lock.json "${STAGING}/"
# npm ci --omit=dev installs only runtime dependencies (no devDependencies)
(cd "${STAGING}" && npm ci --omit=dev --ignore-scripts 2>&1)

echo "==> Syncing to Android assets…"
# Clear previous bundle (keep hand-authored main.js and .gitignore)
rm -rf "${ASSETS_DIR}/dist" "${ASSETS_DIR}/node_modules" "${ASSETS_DIR}/package.json"

cp -r "${ROOT}/dist"         "${ASSETS_DIR}/dist"
cp -r "${STAGING}/node_modules" "${ASSETS_DIR}/node_modules"
cp    "${ROOT}/package.json" "${ASSETS_DIR}/package.json"

rm -rf "${STAGING}"

# Report bundle size
BUNDLE_SIZE=$(du -sh "${ASSETS_DIR}" 2>/dev/null | cut -f1)
echo ""
echo "==> Done. Asset bundle size: ${BUNDLE_SIZE}"
echo "    ${ASSETS_DIR}"
echo ""
echo "Next: open android/ in Android Studio and run Build > Generate Signed APK."
