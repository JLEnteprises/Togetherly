#!/usr/bin/env bash
set -euo pipefail

ROOT="${GITHUB_WORKSPACE:-$(pwd)}"
cd "$ROOT"
VERSION="$(node -p "require('./package.json').version")"
DERIVED="$ROOT/build/ios-dev-derived"
OUT="$ROOT/output"
mkdir -p "$OUT"
rm -rf "$DERIVED"

WORKSPACE="$(find "$ROOT/ios" -maxdepth 1 -name '*.xcworkspace' -print -quit)"
if [[ -z "$WORKSPACE" ]]; then
  echo 'No .xcworkspace found after Expo prebuild.' >&2
  exit 1
fi

SCHEME="Togetherly"
DEV_LOG="$OUT/xcodebuild-dev.log"

set +e
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination "generic/platform=iOS" \
  -derivedDataPath "$DERIVED" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  DEVELOPMENT_TEAM='' \
  COMPILER_INDEX_STORE_ENABLE=NO \
  ONLY_ACTIVE_ARCH=NO \
  build 2>&1 | tee "$DEV_LOG"
STATUS=${PIPESTATUS[0]}
set -e

if [[ $STATUS -ne 0 ]]; then
  echo
  echo '================ Focused development-build diagnostics ================'
  grep -nE '(^|/)(Togetherly|targets/).*:[0-9]+:[0-9]+: (error|warning):|(^|[[:space:]])error:|BUILD FAILED|The following build commands failed' "$DEV_LOG" | tail -n 180 || true
  echo '======================================================================='
  exit "$STATUS"
fi

PRODUCTS="$DERIVED/Build/Products/Debug-iphoneos"
MAIN_APP="$(find "$PRODUCTS" -maxdepth 1 -type d -name '*.app' ! -iname '*watch*.app' -print -quit)"
if [[ -z "$MAIN_APP" || ! -d "$MAIN_APP" ]]; then
  echo "Development iPhone .app not found under $PRODUCTS" >&2
  exit 1
fi

# Keep this diagnostic build phone-only to avoid Sideloadly extension-signing noise.
DEV_APP="$OUT/Togetherly-Development.app"
ditto "$MAIN_APP" "$DEV_APP"
rm -rf "$DEV_APP/Watch" "$DEV_APP/PlugIns"

STAGE="$OUT/stage-development"
rm -rf "$STAGE"
mkdir -p "$STAGE/Payload"
ditto "$DEV_APP" "$STAGE/Payload/Togetherly.app"
(cd "$STAGE" && zip -qry "$OUT/Togetherly-v${VERSION}-Development-unsigned.ipa" Payload)
unzip -t "$OUT/Togetherly-v${VERSION}-Development-unsigned.ipa" >/dev/null
rm -rf "$STAGE" "$DEV_APP"

echo "Development IPA: Togetherly-v${VERSION}-Development-unsigned.ipa"
