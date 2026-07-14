#!/bin/zsh
set -euo pipefail

arch="${1:-}"
case "$arch" in
  x64|arm64|ia32) ;;
  *) echo "Usage: $0 <x64|arm64|ia32>" >&2; exit 2 ;;
esac

version="${ELECTRON_VERSION:-43.1.0}"
base_url="https://cdn.npmmirror.com/binaries/electron/v${version}"
filename="electron-v${version}-win32-${arch}.zip"
url="${base_url}/${filename}"
download_dir="build/electron-windows"
parts_dir="${download_dir}/.${filename}.parts"
output="${download_dir}/${filename}"
part_count=10

mkdir -p "$download_dir" "$parts_dir"
if [[ -f "$output" ]] && unzip -tq "$output" >/dev/null 2>&1; then
  echo "Using existing $output"
  exit 0
fi

size="$(curl -fsIL "$url" | tr -d '\r' | awk 'tolower($1)=="content-length:"{value=$2} END{print value}')"
if [[ -z "$size" || "$size" -le 0 ]]; then
  echo "Unable to determine download size for $url" >&2
  exit 1
fi

chunk=$(( (size + part_count - 1) / part_count ))
pids=()
for ((index=0; index<part_count; index++)); do
  start=$(( index * chunk ))
  end=$(( start + chunk - 1 ))
  (( end >= size )) && end=$(( size - 1 ))
  part="${parts_dir}/part-$(printf '%02d' "$index")"
  curl -fsSL --retry 6 --retry-delay 2 --connect-timeout 20 -r "${start}-${end}" -o "$part" "$url" &
  pids+=("$!")
done

for pid in "${pids[@]}"; do wait "$pid"; done

rm -f "$output"
for part in "${parts_dir}"/part-*; do
  cat "$part" >> "$output"
done
unzip -tq "$output"
rm -rf "$parts_dir"
echo "Downloaded $output"
