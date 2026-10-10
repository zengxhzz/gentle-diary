#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
output="$PWD/build/ios"
mkdir -p "$output"

xcodebuild \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$output/simulator-derived" \
  CODE_SIGNING_ALLOWED=NO \
  build 2>&1 | tee "$output/simulator-build.log"

device_id="$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devices = [d for group in json.load(sys.stdin)["devices"].values() for d in group
           if d.get("isAvailable") and d["name"].startswith("iPhone")]
if not devices:
    sys.exit("No available iPhone simulator")
print(devices[0]["udid"])
')"
device_state="$(xcrun simctl list devices available -j | python3 -c '
import json, sys
target = sys.argv[1]
print(next(d["state"] for group in json.load(sys.stdin)["devices"].values() for d in group if d["udid"] == target))
' "$device_id")"
if [[ "$device_state" != Booted ]]; then xcrun simctl boot "$device_id"; fi
xcrun simctl bootstatus "$device_id" -b
xcrun simctl status_bar "$device_id" override --time '9:41' --batteryState charged --batteryLevel 100
xcrun simctl install "$device_id" "$output/simulator-derived/Build/Products/Debug-iphonesimulator/App.app"
xcrun simctl launch "$device_id" com.zhuanz1.diary | tee "$output/simulator-launch.txt"
sleep 8
xcrun simctl io "$device_id" screenshot "$output/simulator-startup.png"
xcrun simctl spawn "$device_id" launchctl list | grep -F com.zhuanz1.diary > "$output/simulator-process.txt"
echo 'Startup evidence only: manually inspect the screenshot; this does not validate typing, permissions, backups, or a physical iPhone.' >> "$output/simulator-launch.txt"
xcrun simctl shutdown "$device_id"
