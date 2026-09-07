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
  # Swift/Clang diagnostics normally contain file:line:column: error:, but include
  # nearby target/build-failure lines as a fallback for generated-source failures.
  grep -nE '(^|/)(Togetherly|targets/).*:[0-9]+:[0-9]+: (error|warning):|(^|[[:space:]])error:|SwiftCompile.*Togetherly|CompileSwift.*Togetherly|BUILD FAILED|The following build commands failed' "$XCODE_LOG" | tail -n 160 || true
  echo '==========================================================='
  echo "Full Xcode log saved to $XCODE_LOG"
  exit "$XCODE_STATUS"
fi

PRODUCTS="$DERIVED/Build/Products/Release-iphoneos"
MAIN_APP="$(find "$PRODUCTS" -maxdepth 1 -type d -name '*.app' ! -iname '*watch*.app' -print -quit)"
if [[ -z "$MAIN_APP" || ! -d "$MAIN_APP" ]]; then
  echo "Main iPhone .app not found under $PRODUCTS" >&2
  find "$PRODUCTS" -maxdepth 3 -type d -name '*.app' -o -name '*.appex' || true
  exit 1
fi

echo "Main app: $MAIN_APP"
echo 'Embedded Apple targets:'
find "$MAIN_APP" -type d \( -name '*.app' -o -name '*.appex' \) -print | sed 's#^#  #'

# Full Everywhere IPA. Fail loudly if the expected v1.14 Apple targets were not embedded.
WATCH_APP="$(find "$MAIN_APP/Watch" -maxdepth 1 -type d -name '*.app' -print -quit 2>/dev/null || true)"
PHONE_WIDGET="$(find "$MAIN_APP/PlugIns" -maxdepth 1 -type d -name '*.appex' -print -quit 2>/dev/null || true)"
WATCH_WIDGET=""
if [[ -n "$WATCH_APP" ]]; then
  WATCH_WIDGET="$(find "$WATCH_APP/PlugIns" -maxdepth 1 -type d -name '*.appex' -print -quit 2>/dev/null || true)"
fi

if [[ -z "$WATCH_APP" ]]; then
  echo 'Expected Watch companion was not embedded in the iPhone app.' >&2
  exit 1
fi
if [[ -z "$PHONE_WIDGET" ]]; then
  echo 'Expected iPhone WidgetKit extension was not embedded.' >&2
  exit 1
fi
if [[ -z "$WATCH_WIDGET" ]]; then
  echo 'Expected Watch widget/complication extension was not embedded.' >&2
  exit 1
fi

make_ipa() {
  local app_source="$1"
  local ipa_name="$2"
  local stage="$OUT/stage-$ipa_name"
  rm -rf "$stage"
  mkdir -p "$stage/Payload"
  ditto "$app_source" "$stage/Payload/Togetherly.app"
  (cd "$stage" && zip -qry "$OUT/$ipa_name" Payload)
  unzip -t "$OUT/$ipa_name" >/dev/null
  rm -rf "$stage"
}

make_ipa "$MAIN_APP" "Togetherly-v${VERSION}-Everywhere-unsigned.ipa"

# Free Apple-ID signing can reject advanced extensions/entitlements. Ship a fallback IPA
# from the same build so phone testing can continue even if Sideloadly cannot sign Watch/widgets.
PHONE_ONLY_APP="$OUT/Togetherly-PhoneOnly.app"
ditto "$MAIN_APP" "$PHONE_ONLY_APP"
rm -rf "$PHONE_ONLY_APP/Watch" "$PHONE_ONLY_APP/PlugIns"
make_ipa "$PHONE_ONLY_APP" "Togetherly-v${VERSION}-PhoneOnly-unsigned.ipa"
rm -rf "$PHONE_ONLY_APP"

{
  echo "Togetherly version: $VERSION"
  echo "GitHub run: ${GITHUB_RUN_ID:-local}"
  echo "Xcode: $(xcodebuild -version | tr '\n' ' ')"
  echo "Scheme: $SCHEME"
  echo "Bundle ID: ${EXPO_PUBLIC_IOS_BUNDLE_ID:-unknown}"
  echo "API URL: ${EXPO_PUBLIC_API_URL:-unknown}"
  echo "EAS project ID configured: $([[ -n "${EXPO_PUBLIC_EAS_PROJECT_ID:-}" ]] && echo yes || echo no)"
  echo "Full IPA includes Watch app: yes"
  echo "Full IPA includes iPhone widget: yes"
  echo "Full IPA includes Watch widget: yes"
  echo "PhoneOnly IPA strips Watch/Widget extensions for free-signing fallback."
} > "$OUT/build-info.txt"

rm -f "$OUT/xcode-schemes.json"
ls -lh "$OUT"/*.ipa "$OUT/build-info.txt"
