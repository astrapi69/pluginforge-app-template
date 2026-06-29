#!/usr/bin/env bash
# check-directory-size.sh - god-folder watcher (docs/patterns/07).
#
# Counts the FLAT (maxdepth 1) source files (*.ts / *.tsx, tests excluded) in
# each directory under frontend/src and warns when a directory holds too many.
# Like the file-size watcher, this prevents god-folders from returning after
# they were grouped by concern.
#
# Two modes:
#   (default)  WARN_THRESHOLD (default 15) - warn, no fail.
#   --gate     exit 1 when a directory NOT listed in .dirsize-baseline is over
#              the threshold (ratchet: existing, not-yet-split god-folders are
#              tolerated, but a NEW one fails).
#
# Only version-controlled sources under frontend/src (git ls-files), so
# generated / gitignored trees drop out automatically.
#
# Exit codes:
#   0 = clean, warnings only, or only tolerated baseline directories
#   1 = (only with --gate) a new directory over the threshold

set -euo pipefail

WARN_THRESHOLD="${WARN_THRESHOLD:-15}"
ROOT_DIR="${ROOT_DIR:-frontend/src}"
BASELINE_FILE=".dirsize-baseline"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

GATE=0
[[ "${1:-}" == "--gate" ]] && GATE=1

# Tolerated (not-yet-split) directories, one path per line, '#' comments ok.
declare -A BASELINE=()
if [[ -f "$BASELINE_FILE" ]]; then
    while IFS= read -r line; do
        line="${line%%#*}"; line="$(echo -n "$line" | xargs || true)"
        [[ -n "$line" ]] && BASELINE["$line"]=1
    done < "$BASELINE_FILE"
fi

# Count flat (maxdepth 1) tracked *.ts/*.tsx per directory. Co-located test
# files (*.test.ts/x) are excluded: the guard is about grouping SOURCE files
# by concern, and tests live next to their subject by convention.
declare -A COUNT=()
while IFS= read -r f; do
    [[ "$f" == */* ]] || continue
    case "$f" in *.test.ts|*.test.tsx) continue;; esac
    dir="${f%/*}"
    COUNT["$dir"]=$(( ${COUNT["$dir"]:-0} + 1 ))
done < <(git ls-files "$ROOT_DIR" | grep -E '\.tsx?$' || true)

status=0
warned=0
for dir in $(printf '%s\n' "${!COUNT[@]}" | sort); do
    n="${COUNT[$dir]}"
    (( n > WARN_THRESHOLD )) || continue
    if [[ -n "${BASELINE[$dir]:-}" ]]; then
        echo "BASELINE (tolerated): $dir has $n files (max $WARN_THRESHOLD)"
        continue
    fi
    echo "WARNING: $dir has $n files (max $WARN_THRESHOLD) - group by concern"
    warned=1
    (( GATE == 1 )) && status=1
done

if (( warned == 0 )); then
    echo "check-directory-size: OK - no un-baselined directory over $WARN_THRESHOLD flat files."
fi
exit $status
