#!/usr/bin/env bash
# Chạy toàn bộ bộ test (chấm điểm SIM + hiển thị nhịp/mark).
#   bash tests/run.sh
set -uo pipefail

cd "$(dirname "$0")/.."

JSC="/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"

if command -v node >/dev/null 2>&1; then
    RUNNER="node"
elif [ -x "$JSC" ]; then
    RUNNER="$JSC"
else
    echo "Cần node hoặc jsc để chạy test." >&2
    exit 2
fi

STATUS=0
for t in tests/*.test.js; do
    OUT="$("$RUNNER" "$t" 2>&1)"
    echo "$OUT"
    if ! echo "$OUT" | grep -q "ALL PASSED"; then
        STATUS=1
    fi
done

exit $STATUS
