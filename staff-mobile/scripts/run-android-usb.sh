#!/usr/bin/env bash
# Always launch the Android dev client over USB (adb reverse + localhost).
# Avoids Expo opening the Mac LAN IP, which fails when the phone is on mobile data
# or a different Wi-Fi network.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export REACT_NATIVE_PACKAGER_HOSTNAME=localhost

# If something is listening on 8081 but Metro /status is dead (common after Ctrl+Z),
# Expo "Skips" starting a server and the app times out on OkHttp.
if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1; then
    if ! curl -4 -sf --connect-timeout 1 --max-time 2 http://127.0.0.1:8081/status >/dev/null 2>&1; then
      echo "[run-android-usb] Port 8081 is open but Metro is not responding — restarting packager."
      lsof -nP -iTCP:8081 -sTCP:LISTEN -t 2>/dev/null | xargs kill -9 2>/dev/null || true
      sleep 1
    fi
  fi
fi

if command -v adb >/dev/null 2>&1; then
  adb start-server >/dev/null 2>&1 || true
  adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
  adb reverse tcp:8082 tcp:8082 >/dev/null 2>&1 || true
  # Pixel Tablet / virtio-wifi sometimes boots without a main-table default route,
  # which makes Firebase Auth fail with auth/network-request-failed.
  if adb get-state >/dev/null 2>&1; then
    adb shell "su 0 ip route replace default via 10.0.2.2 dev wlan0" >/dev/null 2>&1 || true
    adb shell "su 0 setprop net.dns1 8.8.8.8" >/dev/null 2>&1 || true
    adb shell "su 0 setprop net.dns2 1.1.1.1" >/dev/null 2>&1 || true
  fi
fi

exec npx expo run:android "$@"
