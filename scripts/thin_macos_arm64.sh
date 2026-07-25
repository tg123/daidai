#!/usr/bin/env bash
set -euo pipefail

source_zip=$1
output_zip=$2
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

ditto -x -k "$source_zip" "$work_dir"
app="$work_dir/DaiDai.app"
if [[ ! -d "$app" ]]; then
    echo "::error::Expected DaiDai.app in the Godot macOS export."
    exit 1
fi

while IFS= read -r -d '' binary; do
    if ! file "$binary" | grep -q 'Mach-O'; then
        continue
    fi
    archs=$(lipo -archs "$binary" 2>/dev/null || true)
    if [[ "$archs" == *arm64* && "$archs" == *x86_64* ]]; then
        lipo "$binary" -thin arm64 -output "$binary.arm64"
        mv "$binary.arm64" "$binary"
    fi
done < <(find "$app" -type f -print0)

main_binary="$app/Contents/MacOS/DaiDai"
if [[ ! -f "$main_binary" ]]; then
    echo "::error::Expected $main_binary."
    exit 1
fi
if [[ $(lipo -archs "$main_binary") != "arm64" ]]; then
    echo "::error::DaiDai main executable is not ARM64-only."
    exit 1
fi

codesign --force --deep --sign - "$app"
rm -f "$output_zip"
ditto -c -k --sequesterRsrc --keepParent "$app" "$output_zip"
echo "Created ARM64-only macOS artifact: $output_zip"
