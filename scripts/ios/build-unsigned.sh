#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
configuration="${BUILD_CONFIGURATION:-Release}"
case "$configuration" in
  Release|Debug) ;;
  *) echo 'BUILD_CONFIGURATION must be Release or Debug' >&2; exit 1 ;;
esac

output="$PWD/build/ios"
mkdir -p "$output"
version="$(node -p "require('./package.json').version")"
build_number="${GITHUB_RUN_NUMBER:-1}"
archive="$output/App-${configuration}-${build_number}.xcarchive"
staging="$(mktemp -d "$output/package.XXXXXX")"

# No Apple account, certificate, provisioning profile, or exportArchive step.
xcodebuild \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration "$configuration" \
  -destination 'generic/platform=iOS' \
  -archivePath "$archive" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY='' \
  DEVELOPMENT_TEAM='' \
  MARKETING_VERSION="$version" \
  CURRENT_PROJECT_VERSION="$build_number" \
  archive 2>&1 | tee "$output/device-build.log"

app="$archive/Products/Applications/App.app"
test -f "$app/App"
test -f "$app/public/index.html"
test -f "$app/PrivacyInfo.xcprivacy"
/usr/libexec/PlistBuddy -c 'Print :CFBundleSupportedPlatforms:0' "$app/Info.plist" | grep -qx iPhoneOS
lipo -info "$app/App"

mkdir -p "$staging/Payload"
ditto "$app" "$staging/Payload/App.app"
ipa="$output/gentle-diary-${version}-${configuration}-${build_number}-unsigned.ipa"
(cd "$staging" && /usr/bin/zip -qry "$ipa" Payload)
unzip -tq "$ipa"
(cd "$output" && shasum -a 256 "$(basename "$ipa")" > SHA256SUMS.txt)
{
  echo "App: gentle-diary"
  echo "Version: $version"
  echo "Build: $build_number"
  echo "Configuration: $configuration"
  echo "Commit: ${GITHUB_SHA:-local}"
  echo "Bundle ID: com.zhuanz1.diary"
  echo "Signing: unsigned; re-sign app AND embedded frameworks before installation"
  xcodebuild -version
} > "$output/build-info.txt"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo '### Unsigned IPA ready'
    echo 'Download the gentle-diary-unsigned artifact, extract the IPA, and sign locally.'
    echo 'The signing tool must also sign embedded frameworks. No Apple credentials were used in this build.'
    echo 'Device functionality and signing compatibility still require testing on your iPhone.'
  } >> "$GITHUB_STEP_SUMMARY"
fi
