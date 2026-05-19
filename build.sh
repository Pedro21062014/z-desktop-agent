#!/bin/bash
# Build script for creating distributable packages
# Run this after running setup.sh

set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     Z Desktop Agent - Build          ║"
echo "╚══════════════════════════════════════╝"
echo ""

PLATFORM=$(uname -s)

# Build renderer first
echo "📦 Building renderer (React)..."
npx webpack --config webpack.renderer.js --mode production

echo ""
echo "✅ Renderer built successfully!"
echo ""

if [ "$1" = "linux" ] || [ "$1" = "all" ]; then
    echo "🐧 Building Linux packages (.deb + AppImage)..."
    npx electron-builder --linux
    echo "✅ Linux packages built in dist/"
fi

if [ "$1" = "win" ] || [ "$1" = "all" ]; then
    echo "🪟 Building Windows package (.exe)..."
    npx electron-builder --win
    echo "✅ Windows package built in dist/"
fi

if [ -z "$1" ]; then
    echo "Specify target: ./build.sh linux | ./build.sh win | ./build.sh all"
    echo ""
    echo "Current platform: $PLATFORM"
    if [ "$PLATFORM" = "Linux" ]; then
        echo "Recommended: ./build.sh linux"
    elif [ "$PLATFORM" = "MINGW"* ] || [ "$PLATFORM" = "MSYS"* ] || [ "$PLATFORM" = "CYGWIN"* ]; then
        echo "Recommended: ./build.sh win"
    fi
fi

echo ""
echo "Build complete! Check the dist/ directory for installers."
