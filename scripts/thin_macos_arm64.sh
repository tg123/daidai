#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
    echo "Usage: $0 <universal-app.zip> <arm64-app.zip>" >&2
    exit 64
fi

source_zip=$1
output_zip=$2
if [[ ! -f "$source_zip" ]]; then
    echo "::error::Universal macOS export not found: $source_zip" >&2
    exit 1
fi
if [[ ! -d "$(dirname "$output_zip")" ]]; then
    echo "::error::Output directory does not exist: $(dirname "$output_zip")" >&2
    exit 1
fi

work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

ditto -x -k "$source_zip" "$work_dir"
app="$work_dir/DaiDai.app"
if [[ ! -d "$app" ]]; then
    echo "::error::Expected DaiDai.app in the Godot macOS export." >&2
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
    echo "::error::Expected $main_binary." >&2
    exit 1
fi
if [[ $(lipo -archs "$main_binary") != "arm64" ]]; then
    echo "::error::DaiDai main executable is not ARM64-only." >&2
    exit 1
fi

codesign --force --deep --sign - "$app"
rm -f "$output_zip"
ditto -c -k --sequesterRsrc --keepParent "$app" "$output_zip"
echo "Created ARM64-only macOS artifact: $output_zip"
