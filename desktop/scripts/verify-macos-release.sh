#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

APP_PATH="${1:-}"
DMG_PATH="${2:-}"

if [[ -z "$APP_PATH" ]]; then
  APP_PATH="$(find "$ROOT_DIR/out" -maxdepth 3 -type d -name 'UpSight.app' | head -n1 || true)"
fi

if [[ -z "$DMG_PATH" ]]; then
  DMG_PATH="$(find "$ROOT_DIR/out/make" -maxdepth 3 -type f -name '*.dmg' | head -n1 || true)"
fi

if [[ -z "$APP_PATH" ]]; then
  echo "[verify] No UpSight.app found under $ROOT_DIR/out"
  exit 1
fi

echo "[verify] App: $APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl -a -vv --type execute "$APP_PATH"
xcrun stapler validate "$APP_PATH"

echo "[verify] App signature + Gatekeeper + stapler checks passed"

if [[ -n "$DMG_PATH" ]]; then
  echo "[verify] DMG: $DMG_PATH"
  spctl -a -vv --type open "$DMG_PATH"
  xcrun stapler validate "$DMG_PATH"
  echo "[verify] DMG Gatekeeper + stapler checks passed"
else
  echo "[verify] No DMG found (skipping DMG checks)"
fi
