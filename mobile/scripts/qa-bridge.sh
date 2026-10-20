#!/usr/bin/env bash
# Color Times - QA bridge for the Android emulator.
#
#   bash mobile/scripts/qa-bridge.sh        (run from the color-times folder; Ctrl+C to stop)
#
# Lets Claude test the app on the emulator: it watches mobile/.qa/cmd for a short list of
# commands, runs them with adb, and writes results (screenshots, logs) into mobile/.qa/.
# Allowed commands only - anything else is ignored:
#   shot NAME            screenshot -> .qa/NAME.png
#   tap X Y              tap at screen pixels
#   swipe X1 Y1 X2 Y2 MS swipe / scroll
#   text WORD            type letters, digits and @._- only (never used for real passwords)
#   key NAME             back | home | enter | del | tab | escape
#   night yes|no         Android dark mode on/off
#   log                  last JS log lines -> .qa/log.txt
#   reload               reload the JS bundle via Metro
#   wait SECONDS         pause (max 10)
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
QA="$ROOT/mobile/.qa"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"
mkdir -p "$QA"
rm -f "$QA/cmd" "$QA/cmd.run"
num='^[0-9]{1,5}$'

run() {
  set -- $1
  case "${1:-}" in
    shot)  [[ "${2:-}" =~ ^[A-Za-z0-9_-]{1,40}$ ]] && "$ADB" exec-out screencap -p > "$QA/$2.png" ;;
    tap)   [[ "${2:-}" =~ $num && "${3:-}" =~ $num ]] && "$ADB" shell input tap "$2" "$3" ;;
    swipe) [[ "${2:-}" =~ $num && "${3:-}" =~ $num && "${4:-}" =~ $num && "${5:-}" =~ $num && "${6:-}" =~ $num ]] \
             && "$ADB" shell input swipe "$2" "$3" "$4" "$5" "$6" ;;
    text)  [[ "${2:-}" =~ ^[A-Za-z0-9@._-]{1,64}$ ]] && "$ADB" shell input text "$2" ;;
    key)   case "${2:-}" in
             back) k=4;; home) k=3;; enter) k=66;; del) k=67;; tab) k=61;; escape) k=111;; *) k="";;
           esac
           [ -n "$k" ] && "$ADB" shell input keyevent "$k" ;;
    night) [[ "${2:-}" =~ ^(yes|no)$ ]] && "$ADB" shell cmd uimode night "$2" ;;
    log)   "$ADB" logcat -d -t 400 -s ReactNativeJS:V ReactNative:V AndroidRuntime:E > "$QA/log.txt" 2>&1 ;;
    reload) curl -s -X POST http://localhost:8081/reload >/dev/null ;;
    wait)  [[ "${2:-}" =~ ^([0-9]|10)$ ]] && sleep "$2" ;;
  esac
}

echo "QA bridge running - leave this window open. Ctrl+C to stop."
while true; do
  if [ -f "$QA/cmd" ]; then
    mv "$QA/cmd" "$QA/cmd.run"
    while IFS= read -r line || [ -n "$line" ]; do
      echo "  $line"
      run "$line"
    done < "$QA/cmd.run"
    rm -f "$QA/cmd.run"
    date +%s > "$QA/done"
  fi
  sleep 0.4
done
