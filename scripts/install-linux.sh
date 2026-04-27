#!/bin/bash

echo "⬇️ Downloading LocalShare for Linux..."

FILE_NAME="LocalShare-linux-x64.AppImage"
DOWNLOAD_URL="https://github.com/bhargavprajapati949/LocalShare/releases/latest/download/$FILE_NAME"

# Download to current directory
echo "📥 Fetching $FILE_NAME..."
curl -L -o ./LocalShare.AppImage "$DOWNLOAD_URL"

# Make it executable
chmod +x ./LocalShare.AppImage

echo ""
echo "✅ LocalShare (AppImage) is now in your current directory!"
echo "🚀 Starting LocalShare..."
echo ""

# Run it
./LocalShare.AppImage
