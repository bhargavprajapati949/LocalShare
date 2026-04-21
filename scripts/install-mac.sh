#!/bin/bash

echo "⬇️ Downloading LocalShare..."

# Detect Mac architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    echo "Architecture: Apple Silicon (arm64)"
    DOWNLOAD_URL="https://github.com/bhargavprajapati949/LocalShare/releases/latest/download/localshare-macos-arm64"
else
    echo "Architecture: Intel (x86_64)"
    DOWNLOAD_URL="https://github.com/bhargavprajapati949/LocalShare/releases/latest/download/localshare-macos-x64-intel"
fi

# Download to Desktop
curl -L -o ~/Desktop/LocalShare "$DOWNLOAD_URL"

# Make it executable (bypasses Gatekeeper since it was downloaded via curl)
chmod +x ~/Desktop/LocalShare

echo ""
echo "✅ LocalShare is now on your Desktop!"
echo "🚀 Starting LocalShare..."
echo ""

# Run it
~/Desktop/LocalShare
