#!/usr/bin/env bash
# 组装 dist/Binny.app + zip。不需要 Xcode，系统自带的 osacompile 就够。
#   VERSION  CFBundleShortVersionString, 默认 0.1.0
#   BUILD    CFBundleVersion, 默认 1
set -euo pipefail

VERSION="${VERSION:-0.1.0}"
BUILD="${BUILD:-1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="Binny"
APP="$ROOT/dist/$NAME.app"

rm -rf "$APP"
mkdir -p "$ROOT/dist"
osacompile -l JavaScript -s -o "$APP" "$ROOT/src/main.js"
mkdir -p "$APP/Contents/Resources/mascot"
cp "$ROOT/assets/mascot/"*.png "$APP/Contents/Resources/mascot/"
cp "$ROOT/assets/mascot/pet-face-idle.png" "$APP/Contents/Resources/cat.png"
cp "$ROOT/assets/mascot/pet-face-idle.png" "$ROOT/assets/cat.png"

PLIST="$APP/Contents/Info.plist"
buddy() { /usr/libexec/PlistBuddy -c "$1" "$PLIST" >/dev/null; }
set_or_add() {
  local key="$1" type="$2" value="$3"
  buddy "Set :$key $value" 2>/dev/null || buddy "Add :$key $type $value"
}
set_or_add CFBundleName string "纸篓猫"
set_or_add CFBundleDisplayName string "纸篓猫"
set_or_add CFBundleIdentifier string "io.github.renpengkai.binny"
set_or_add CFBundleShortVersionString string "$VERSION"
set_or_add CFBundleVersion string "$BUILD"
set_or_add LSUIElement bool true
set_or_add LSMinimumSystemVersion string "13.0"
set_or_add NSHighResolutionCapable bool true
set_or_add NSAppleEventsUsageDescription string "清空废纸篓时需要让访达执行清空。"
set_or_add LSApplicationCategoryType string "public.app-category.utilities"

if python3 "$ROOT/scripts/generate-app-icon.py" >/dev/null 2>&1 && command -v iconutil >/dev/null; then
  ICONSET="$ROOT/dist/AppIcon.iconset"
  if iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns" 2>/dev/null; then
    set_or_add CFBundleIconFile string "AppIcon"
  fi
  rm -rf "$ICONSET"
fi

for key in NSHomeKitUsageDescription NSAppleMusicUsageDescription NSCalendarsUsageDescription \
           NSSiriUsageDescription NSCameraUsageDescription NSMicrophoneUsageDescription \
           NSRemindersUsageDescription NSContactsUsageDescription NSPhotoLibraryUsageDescription \
           NSSystemAdministrationUsageDescription; do
  buddy "Delete :$key" 2>/dev/null || true
done

codesign --force --sign - --timestamp=none "$APP" >/dev/null
codesign --verify --strict --verbose=2 "$APP" >/dev/null

ZIP="$ROOT/dist/$NAME-$VERSION.zip"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"

echo "== size =="
du -sh "$APP" "$ZIP"
ls -l "$APP/Contents/MacOS/" "$APP/Contents/Resources/mascot/" "$ZIP"
