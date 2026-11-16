#!/bin/zsh
set -e
cd "$(dirname "$0")/dist"

if [ ! -f "jacaranda-corner.html" ]; then
  echo "Build the page first: node scripts/build-standalone.mjs"
  exit 1
fi

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)"
echo
echo "  Jacaranda Days — mobile preview"
echo "  Phone URL: http://${IP}:8080/jacaranda-corner.html"
echo "  Keep this Mac and the phone on the same Wi-Fi."
echo "  Press Ctrl+C to stop."
echo
exec python3 -m http.server 8080 --bind 0.0.0.0
