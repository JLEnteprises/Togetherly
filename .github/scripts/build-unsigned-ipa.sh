#!/usr/bin/env bash
set -euo pipefail

ROOT="${GITHUB_WORKSPACE:-$(pwd)}"
cd "$ROOT"
VERSION="$(node -p "require('./package.json').version")"
DERIVED="$ROOT/build/ios-derived"
OUT="$ROOT/output"
rm -rf "$DERIVED" "$OUT"
mkdir -p "$OUT"

WORKSPACE="$(find "$ROOT/ios" -maxdepth 1 -name '*.xcworkspace' -print -quit)"
if [[ -z "$WORKSPACE" ]]; then
  echo 'No .xcworkspace found after Expo prebuild.' >&2
  exit 1
fi

xcodebuild -workspace "$WORKSPACE" -list -json > "$OUT/xcode-schemes.json"
SCHEME="$(python3 - "$OUT/xcode-schemes.json" <<'PY'
import json, sys
obj=json.load(open(sys.argv[1]))
schemes=obj.get('workspace',{}).get('schemes',[])
preferred=['Togetherly','togetherly']
for p in preferred:
    if p in schemes:
        print(p); raise SystemExit
for s in schemes:
    low=s.lower()
    if not any(x in low for x in ('pod','watch','widget')):
        print(s); raise SystemExit
raise SystemExit('No suitable main app scheme found: '+repr(schemes))
PY
)"

echo "Using workspace: $WORKSPACE"
echo "Using scheme: $SCHEME"

XCODE_LOG="$OUT/xcodebuild.log"
set +e
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath "$DERIVED" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  DEVELOPMENT_TEAM='' \
  COMPILER_INDEX_STORE_ENABLE=NO \
  ONLY_ACTIVE_ARCH=NO \
  build 2>&1 | tee "$XCODE_LOG"
XCODE_STATUS=${PIPESTATUS[0]}
set -e

if [[ $XCODE_STATUS -ne 0 ]]; then
  echo
  echo '================ Focused Xcode diagnostics ================'
  grep -nE '(^|/)(Togetherly|targets/).*:[0-9]+:[0-9]+: (error|warning):|(^|[[:space:]])error:|SwiftCompile.*Togetherly|CompileSwift.*Togetherly|BUILD FAILED|The following build commands failed' "$XCODE_LOG" | tail -n 160 || true
  echo '==========================================================='
  echo "Full Xcode log saved to $XCODE_LOG"
  exit "$XCODE_STATUS"
fi

PRODUCTS="$DERIVED/Build/Products/Release-iphoneos"
MAIN_APP="$(find "$PRODUCTS" -maxdepth 1 -type d -name '*.app' ! -iname '*watch*.app' -print -quit)"
if [[ -z "$MAIN_APP" || ! -d "$MAIN_APP" ]]; then
  echo "Main iPhone .app not found under $PRODUCTS" >&2
  find "$PRODUCTS" -maxdepth 3 -type d \( -name '*.app' -o -name '*.appex' \) -print || true
  exit 1
fi

echo "Main app: $MAIN_APP"

# This fast workflow intentionally ships one phone-only IPA. Keep the Watch/widget
# source in the repository, but strip any extension that may appear unexpectedly
# so free Apple-ID/Sideloadly testing stays simple and packaging stays deterministic.
PHONE_APP="$OUT/Togetherly-PhoneOnly.app"
ditto "$MAIN_APP" "$PHONE_APP"
rm -rf "$PHONE_APP/Watch" "$PHONE_APP/PlugIns"

STAGE="$OUT/stage-phone"
rm -rf "$STAGE"
mkdir -p "$STAGE/Payload"
ditto "$PHONE_APP" "$STAGE/Payload/Togetherly.app"
IPA_NAME="Togetherly-v${VERSION}-PhoneOnly-unsigned.ipa"
(cd "$STAGE" && zip -qry "$OUT/$IPA_NAME" Payload)
unzip -t "$OUT/$IPA_NAME" >/dev/null
rm -rf "$STAGE" "$PHONE_APP"

{
  echo "Togetherly version: $VERSION"
  echo "GitHub run: ${GITHUB_RUN_ID:-local}"
  echo "Xcode: $(xcodebuild -version | tr '\n' ' ')"
  echo "Scheme: $SCHEME"
  echo "Bundle ID: ${EXPO_PUBLIC_IOS_BUNDLE_ID:-unknown}"
  echo "API URL: ${EXPO_PUBLIC_API_URL:-unknown}"
  echo "EAS project ID configured: $([[ -n "${EXPO_PUBLIC_EAS_PROJECT_ID:-}" ]] && echo yes || echo no)"
  echo "Build mode: fast phone-only release"
  echo "Watch companion included: no"
  echo "iPhone widget included: no"
  echo "Watch widget included: no"
  echo "Development IPA included: no"
} > "$OUT/build-info.txt"

ls -lh "$OUT/$IPA_NAME" "$OUT/build-info.txt"
