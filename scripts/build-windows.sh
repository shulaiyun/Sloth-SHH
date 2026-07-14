#!/bin/zsh
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root_dir"

npm run build

./scripts/download-electron-windows.sh x64 &
x64_download=$!
./scripts/download-electron-windows.sh arm64 &
arm64_download=$!
ELECTRON_VERSION=39.8.10 ./scripts/download-electron-windows.sh ia32 &
ia32_download=$!
wait "$x64_download"
wait "$arm64_download"
wait "$ia32_download"

npx electron-builder --win nsis --x64 \
  --config.electronDist=build/electron-windows/electron-v43.1.0-win32-x64.zip
npx electron-builder --win nsis --arm64 \
  --config.electronDist=build/electron-windows/electron-v43.1.0-win32-arm64.zip
npx electron-builder --win nsis --ia32 \
  --config.electronVersion=39.8.10 \
  --config.electronDist=build/electron-windows/electron-v39.8.10-win32-ia32.zip

echo "Windows installers are ready in $root_dir/release"
