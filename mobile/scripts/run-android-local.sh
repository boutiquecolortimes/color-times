#!/usr/bin/env bash
# Color Times - run the mobile app on the Android emulator against the local backend.
#
#   bash mobile/scripts/run-android-local.sh      (run from the color-times folder)
#
# Safe to re-run; each step is skipped if already done:
#   0. Checks Node 22+, Java and the Android SDK (and tells you exactly what to install if not).
#   1. Applies the backend changes the app needs (color-times-web-changes.patch), once.
#   2. Starts the backend (npm run dev) in a new Terminal window.
#   3. Installs app dependencies.
#   4. Boots an Android emulator if none is running.
#   5. Starts Metro in a new Terminal window, then builds and installs the app.
#
# The emulator reaches your Mac's backend at http://10.0.2.2:3000 (already the app's default).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/mobile"
step() { printf "\n\033[1;33m> %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31mx %s\033[0m\n" "$1"; exit 1; }

# ---------------------------------------------------------------------------
step "0/5 Tools"

# Free disk space: Node, Gradle and the emulator need room. Stop early instead of failing mid-way.
FREE_GB=$(df -g "$HOME" | awk 'NR==2{print $4}')
if [ "${FREE_GB:-0}" -lt 4 ]; then
  fail "Only ${FREE_GB} GB free on your Mac - the Android build needs at least 4 GB (8 GB is comfortable).
   Safe things to clear (all re-created when needed):
     rm -rf ~/Library/Developer/Xcode/DerivedData
     xcrun simctl delete unavailable
     rm -rf ~/.nvm/.cache ~/Documents/TechRover/color-times/mobile/ios/Pods
     npm cache clean --force
   Then check with:  df -h ~"
fi
echo "Disk: ${FREE_GB} GB free"
[ "$FREE_GB" -lt 8 ] && echo "  (tight - if the build fails with \"No space left\", free a few more GB and re-run)"

# Node 22.11+ (React Native 0.88 needs it). Use Homebrew's node@22 or nvm if present.
node_ok() { node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=11)?0:1)' 2>/dev/null; }
if ! node_ok; then
  for d in /opt/homebrew/opt/node@22/bin /usr/local/opt/node@22/bin; do
    [ -x "$d/node" ] && export PATH="$d:$PATH" && break
  done
fi
if ! node_ok && [ -s "$HOME/.nvm/nvm.sh" ]; then
  set +u; . "$HOME/.nvm/nvm.sh"; nvm use 22 >/dev/null 2>&1 || nvm install -b 22; set -u
fi
if ! node_ok; then
  fail "Node $(node -v 2>/dev/null || echo 'not found') is too old - React Native 0.88 needs Node 22.11 or newer.
   Install it with:   brew install node@22
   then run this script again (it picks up node@22 automatically)."
fi
echo "Node $(node -v)"

# Java 17+ (Gradle / Android build). Prefer the JDK bundled with Android Studio.
java_major() { "$1/bin/java" -version 2>&1 | awk -F'"' '/version/{split($2,v,".");print (v[1]=="1"?v[2]:v[1]);exit}'; }
JAVA_HOME_FOUND=""
for cand in \
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  "$(/usr/libexec/java_home -v 21 2>/dev/null || true)" \
  "$(/usr/libexec/java_home -v 17 2>/dev/null || true)" \
  "${JAVA_HOME:-}"; do
  if [ -n "$cand" ] && [ -x "$cand/bin/java" ] && [ "$(java_major "$cand")" -ge 17 ] 2>/dev/null; then
    JAVA_HOME_FOUND="$cand"; break
  fi
done
[ -n "$JAVA_HOME_FOUND" ] || fail "Java 17 or newer is needed (found: ${JAVA_HOME:-none}).
   Easiest: install Android Studio (it includes Java), or:  brew install --cask zulu@17"
export JAVA_HOME="$JAVA_HOME_FOUND"
export PATH="$JAVA_HOME/bin:$PATH"
echo "Java $JAVA_HOME"

# Android SDK
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
if ! command -v adb >/dev/null 2>&1; then
  fail "Android SDK not found at $ANDROID_HOME.
   Install Android Studio (developer.android.com/studio), open it once, and let it
   download the SDK. Then in Device Manager create a virtual phone (e.g. Pixel 8, API 35)."
fi
echo "Android SDK $ANDROID_HOME"

# New Terminal windows must see the same Node / Java / SDK.
ENVLINE="export PATH='$PATH' ANDROID_HOME='$ANDROID_HOME'${JAVA_HOME:+ JAVA_HOME='$JAVA_HOME'}"

cd "$ROOT"

# ---------------------------------------------------------------------------
step "1/5 Backend changes for the app"
if [ -f color-times-web-changes.patch ]; then
  if git apply --check color-times-web-changes.patch 2>/dev/null; then
    git apply color-times-web-changes.patch
    echo "Applied color-times-web-changes.patch"
  elif git apply --reverse --check color-times-web-changes.patch 2>/dev/null; then
    echo "Already applied"
  else
    echo "Skipped: your code already has newer backend changes than this patch (nothing was changed)."
  fi
else
  echo "No patch file found - assuming the backend already has the mobile changes."
fi

# ---------------------------------------------------------------------------
step "2/5 Backend (new Terminal window)"
[ -d node_modules ] || npm install
if curl -s -o /dev/null --max-time 2 http://localhost:3000; then
  echo "Backend already running on http://localhost:3000"
else
  osascript -e "tell application \"Terminal\" to do script \"$ENVLINE; cd '$ROOT' && npm run dev\"" >/dev/null
  echo -n "Waiting for the backend"
  for _ in $(seq 1 90); do
    curl -s -o /dev/null --max-time 2 http://localhost:3000 && break
    echo -n "."; sleep 2
  done
  echo
fi

# ---------------------------------------------------------------------------
step "3/5 App dependencies"
cd "$MOBILE"
npm install --no-audit --no-fund

# ---------------------------------------------------------------------------
step "4/5 Android emulator"
if adb devices | awk 'NR>1 && $2=="device"' | grep -q .; then
  echo "Using the running device: $(adb devices | awk 'NR>1 && $2=="device"{print $1; exit}')"
else
  AVD="$(emulator -list-avds 2>/dev/null | head -n1)"
  [ -n "$AVD" ] || fail "No virtual device yet. In Android Studio -> Device Manager -> Create device
   (Pixel 8, a recent API with Google Play), then run this script again."
  echo "Booting ${AVD}..."
  nohup emulator -avd "$AVD" -netdelay none -netspeed full >/dev/null 2>&1 &
  adb wait-for-device
  echo -n "Waiting for Android to finish booting"
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    echo -n "."; sleep 2
  done
  echo
fi
# Lets Metro (8081) and the backend (3000) also be reached as localhost from the device.
adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
adb reverse tcp:3000 tcp:3000 >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
step "5/5 Metro (new Terminal window) + build & install"
if ! curl -s -o /dev/null --max-time 2 http://localhost:8081/status; then
  osascript -e "tell application \"Terminal\" to do script \"$ENVLINE; cd '$MOBILE' && npx react-native start --reset-cache\"" >/dev/null
  sleep 5
fi
# First build downloads Gradle and dependencies - expect 5-15 minutes. Later builds are quick.
npx react-native run-android --no-packager --active-arch-only

printf "\n\033[1;32mOK Color Times is running on the emulator (backend: http://10.0.2.2:3000).\033[0m\n"
