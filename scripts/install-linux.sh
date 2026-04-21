#!/bin/bash

echo "⬇️ Downloading LocalShare..."

DOWNLOAD_URL="https://github.com/bhargavprajapati949/LocalShare/releases/latest/download/localshare-linux-x64"

# Download to current directory
curl -L -o ./localshare "$DOWNLOAD_URL"

# Make it executable
chmod +x ./localshare

echo ""
echo "✅ LocalShare is now in your current directory!"
echo "🚀 Starting LocalShare..."
echo ""

# Run it
./localshare
