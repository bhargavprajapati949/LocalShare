#!/bin/bash

echo "⬇️ Downloading LocalShare for macOS..."

# Detect Mac architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    echo "Architecture: Apple Silicon (arm64)"
    FILE_NAME="LocalShare-mac-arm64.zip"
else
    echo "Architecture: Intel (x86_64)"
    FILE_NAME="LocalShare-mac-x64.zip"
fi

DOWNLOAD_URL="https://github.com/bhargavprajapati949/LocalShare/releases/latest/download/$FILE_NAME"

# Download to temporary location
TEMP_DIR=$(mktemp -d)
echo "📥 Fetching $FILE_NAME..."
curl -L -o "$TEMP_DIR/$FILE_NAME" "$DOWNLOAD_URL"

# Extract
echo "📦 Extracting..."
unzip -q "$TEMP_DIR/$FILE_NAME" -d "$TEMP_DIR"

# Move to Applications
echo "🚀 Installing to /Applications..."
# Remove old version if exists
rm -rf "/Applications/LocalShare.app"
mv "$TEMP_DIR/LocalShare.app" "/Applications/"

# Remove quarantine flag (bypasses Gatekeeper "unverified developer" warning)
echo "🛡️  Whitelisting app..."
xattr -rd com.apple.quarantine "/Applications/LocalShare.app"

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "✅ LocalShare is now installed in your /Applications folder!"
echo "✨ You can find it in your Launchpad or Applications."
echo ""
open "/Applications/LocalShare.app"
