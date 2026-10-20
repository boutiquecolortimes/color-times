#!/usr/bin/env bash
# Color Times - start the already-built app on the Android emulator (no rebuild).
#
#   bash mobile/scripts/start-android.sh      (run from the color-times folder)
#
# Boots the emulator if needed, starts Metro if it isn't running,
# installs the last built APK if the app is missing, then opens the app.
# Use run-android-local.sh instead only when native code changed and a rebuild is needed.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/mobile"
PKG="com.colortimes.boutique"
APK="$MOBILE/android/app/build/outputs/apk/debug/app-debug.apk"
step() { printf "\n\033[1;33m> %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31mx %s\033[0m\n" "$1"; exit 1; }

# Same Node as the build (Homebrew node@22 or nvm 22).
for d in /opt/homebrew/opt/node@22/bin /usr/local/opt/node@22/bin; do
  [ -x "$d/node" ] && export PATH="$d:$PATH" && break
done
if [ -s "$HOME/.nvm/nvm.sh" ]; then set +u; . "$HOME/.nvm/nvm.sh"; nvm use 22 >/dev/null 2>&1; set -u; fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
command -v adb >/dev/null 2>&1 || fail "adb not found in $ANDROID_HOME/platform-tools"
ENVLINE="export PATH='$PATH' ANDROID_HOME='$ANDROID_HOME'"

step "Emulator"
if adb devices | awk 'NR>1 && $2=="device"' | grep -q .; then
  echo "Already running"
else
  AVD="$(emulator -list-avds 2>/dev/null | head -n1)"
  [ -n "$AVD" ] || fail "No virtual device found (Android Studio -> Device Manager)."
  FREE_GB=$(df -g "$HOME" | awk 'NR==2{print $4}')
  [ "${FREE_GB:-0}" -lt 3 ] && echo "  Warning: only ${FREE_GB} GB free - the emulator may refuse to start or boot slowly."
  mkdir -p "$MOBILE/.qa"
  LOG="$MOBILE/.qa/emulator.log"
  EMU_PID="$(pgrep -f "qemu-system.*-avd $AVD" | head -n1 || true)"
  if [ -n "$EMU_PID" ]; then
    echo "${AVD} is already starting (left over from an earlier run) - waiting for it."
  else
    echo "Booting ${AVD}... (emulator messages: mobile/.qa/emulator.log)"
    nohup emulator -avd "$AVD" -no-boot-anim -gpu host -netdelay none -netspeed full >"$LOG" 2>&1 &
    EMU_PID=$!
  fi
  echo -n "Waiting for Android (first boot can take 1-2 minutes; leave the emulator open next time)"
  for i in $(seq 1 120); do
    if ! kill -0 "$EMU_PID" 2>/dev/null; then
      echo; tail -n 15 "$LOG"
      fail "The emulator stopped while starting (see the lines above). Low disk space is the usual cause."
    fi
    [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
    echo -n "."; sleep 2
    [ "$i" = 120 ] && { echo; tail -n 15 "$LOG"; fail "Android didn't finish booting in 4 minutes."; }
  done
  echo
fi
adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true

# The app talks to the live site (src/config.ts), so no local backend is needed.
# Pass --local to also start `npm run dev` (only when USE_LOCAL_BACKEND = true).
if [ "${1:-}" = "--local" ]; then
  step "Local backend (http://localhost:3000)"
  if curl -s -o /dev/null --max-time 2 http://localhost:3000; then
    echo "Already running"
  else
    osascript -e "tell application \"Terminal\" to do script \"$ENVLINE; cd '$ROOT' && npm run dev\"" >/dev/null
    echo "Starting in a new Terminal window"
  fi
fi

step "Metro"
if curl -s --max-time 2 http://localhost:8081/status | grep -q running; then
  echo "Already running"
else
  osascript -e "tell application \"Terminal\" to do script \"$ENVLINE; cd '$MOBILE' && npx react-native start\"" >/dev/null
  echo -n "Starting in a new Terminal window"
  for _ in $(seq 1 60); do curl -s --max-time 2 http://localhost:8081/status | grep -q running && break; echo -n "."; sleep 2; done
  echo
fi

step "App"
if ! adb shell pm list packages 2>/dev/null | grep -q "package:$PKG"; then
  [ -f "$APK" ] || fail "The app isn't installed and no build was found - run run-android-local.sh once."
  echo "Installing the last build..."
  adb install -r "$APK" || fail "Install failed (is the emulator low on space?)"
fi
adb shell am force-stop "$PKG" >/dev/null 2>&1
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 \
  && printf "\n\033[1;32mOK Color Times is open on the emulator.\033[0m\n" \
  || fail "Couldn't open the app."
