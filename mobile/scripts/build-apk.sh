#!/usr/bin/env bash
# Color Times - build an installable Android APK (release, talks to the live site).
#
#   bash mobile/scripts/build-apk.sh              (run from the color-times folder)
#   bash mobile/scripts/build-apk.sh --install    also install it on the running emulator / plugged-in phone
#   bash mobile/scripts/build-apk.sh --all-phones also include 32-bit phones (bigger, slower to build)
#
# The APK is copied to your Desktop as ColorTimes-<version>.apk. Send it on WhatsApp or
# Drive; on the phone, allow "Install unknown apps" for that app when Android asks.
# It's signed with the debug key unless your Play Store upload key is set up (see README),
# so it's for testing and sharing, not for the Play Store.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/mobile"
step() { printf "\n\033[1;33m> %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31mx %s\033[0m\n" "$1"; exit 1; }

INSTALL=0
ARCHS="arm64-v8a"
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=1 ;;
    --all-phones) ARCHS="arm64-v8a,armeabi-v7a" ;;
  esac
done

step "1/4 Tools"
FREE_GB=$(df -g "$HOME" | awk 'NR==2{print $4}')
[ "${FREE_GB:-0}" -lt 3 ] && fail "Only ${FREE_GB} GB free - building the APK needs about 3 GB. Free some space and try again."
echo "Disk: ${FREE_GB} GB free"

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


step "2/4 App dependencies"
cd "$MOBILE"
[ -d node_modules ] || npm install --no-audit --no-fund
VERSION=$(sed -n 's/.*versionName "\(.*\)".*/\1/p' android/app/build.gradle | head -n1)
VERSION=${VERSION:-1.0.0}

step "3/4 Building the release APK ($ARCHS) - the first time takes 5-15 minutes"
cd "$MOBILE/android"
./gradlew assembleRelease -PreactNativeArchitectures="$ARCHS" --console=plain

APK="$MOBILE/android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] || fail "The build finished but no APK was found at $APK"
OUT="$HOME/Desktop/ColorTimes-$VERSION.apk"
cp "$APK" "$OUT"

step "4/4 Done"
SIZE=$(du -h "$OUT" | awk '{print $1}')
printf "\033[1;32mOK APK ready: %s (%s)\033[0m\n" "$OUT" "$SIZE"
echo "It connects to https://colortimesboutique.com (set in mobile/src/config.ts)."

if [ "$INSTALL" = 1 ]; then
  if adb devices | awk 'NR>1 && $2=="device"' | grep -q .; then
    echo "Installing on $(adb devices | awk 'NR>1 && $2=="device"{print $1; exit}')..."
    adb install -r "$OUT" && echo "Installed. Open Color Times on the device."
  else
    echo "No emulator or phone connected - skipped installing."
  fi
fi
