#!/usr/bin/env bash
# Color Times — run the mobile app on the iOS Simulator against the local backend.
#
#   bash mobile/scripts/run-ios-local.sh        (run from the color-times folder)
#
# What it does (safe to re-run; each step is skipped if already done):
#   1. Applies the backend changes the app needs (color-times-web-changes.patch), once.
#   2. Installs web dependencies and starts the backend (npm run dev) in a new Terminal window.
#   3. Installs app dependencies + iOS pods.
#   4. Starts Metro in a new Terminal window and builds/launches the app in the Simulator.
#
# The backend uses .env.local as usual (your configured database).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/mobile"
step() { printf "\n\033[1;33m▸ %s\033[0m\n" "$1"; }

cd "$ROOT"

step "1/5 Backend changes for the app"
if [ -f color-times-web-changes.patch ]; then
  if git apply --check color-times-web-changes.patch 2>/dev/null; then
    git apply color-times-web-changes.patch
    echo "Applied color-times-web-changes.patch"
  elif git apply --reverse --check color-times-web-changes.patch 2>/dev/null; then
    echo "Already applied"
  else
    echo "⚠ The patch doesn't apply cleanly to your current code — stopping so nothing is half-changed."
    exit 1
  fi
else
  echo "No patch file found — assuming the backend already has the mobile changes."
fi

step "2/5 Web dependencies + backend (new Terminal window)"
[ -d node_modules ] || npm install
if curl -s -o /dev/null --max-time 2 http://localhost:3000; then
  echo "Backend already running on http://localhost:3000"
else
  osascript -e "tell application \"Terminal\" to do script \"cd '$ROOT' && npm run dev\"" >/dev/null
  echo -n "Waiting for the backend"
  for _ in $(seq 1 60); do
    curl -s -o /dev/null --max-time 2 http://localhost:3000 && break
    echo -n "."; sleep 2
  done
  echo
fi

step "3/5 App dependencies"
cd "$MOBILE"
npm install

step "4/5 iOS pods"
cd "$MOBILE/ios"
if command -v bundle >/dev/null 2>&1 && bundle install >/dev/null 2>&1; then
  bundle exec pod install
else
  pod install
fi

step "5/5 Metro (new Terminal window) + build & launch in the Simulator"
cd "$MOBILE"
osascript -e "tell application \"Terminal\" to do script \"cd '$MOBILE' && npx react-native start --reset-cache\"" >/dev/null
sleep 5
npx react-native run-ios --no-packager

printf "\n\033[1;32m✓ Color Times is running in the Simulator (backend: http://localhost:3000).\033[0m\n"
