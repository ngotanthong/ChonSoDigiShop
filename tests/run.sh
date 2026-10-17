#!/usr/bin/env bash
# Chạy bộ test chấm điểm SIM.
#   bash tests/run.sh
set -uo pipefail

cd "$(dirname "$0")/.."

JSC="/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"

if command -v node >/dev/null 2>&1; then
    OUT="$(node tests/ai-scoring.test.js 2>&1)"
elif [ -x "$JSC" ]; then
    OUT="$("$JSC" tests/ai-scoring.test.js 2>&1)"
else
    echo "Cần node hoặc jsc để chạy test." >&2
    exit 2
fi

echo "$OUT"

if echo "$OUT" | grep -q "ALL PASSED"; then
    exit 0
else
    exit 1
fi
