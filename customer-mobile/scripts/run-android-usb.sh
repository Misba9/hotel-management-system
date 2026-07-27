#!/usr/bin/env bash
# Always launch the Android dev client over USB (adb reverse + localhost).
# Avoids Expo opening the Mac LAN IP, which fails when the phone is on mobile data
# or a different Wi-Fi network.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export REACT_NATIVE_PACKAGER_HOSTNAME=localhost

if command -v adb >/dev/null 2>&1; then
  adb start-server >/dev/null 2>&1 || true
  adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
  adb reverse tcp:8082 tcp:8082 >/dev/null 2>&1 || true
fi

exec npx expo run:android "$@"
