#!/usr/bin/env bash
# check-file-sizes.sh - cohesion watcher (docs/patterns/07).
#
# Three layers:
#   WHITELIST (.filesize-whitelist)  - deliberately large, cohesive files; never an error
#   BASELINE  (.filesize-baseline)   - ratchet: existing god-files frozen at their
#                                      current size. Tolerated, but must NOT grow.
#   Thresholds:
#     WARN_THRESHOLD  (default 500)  - warn in the PR, no fail
#     ERROR_THRESHOLD (default 1000) - blocks the merge (exit 1)
#
# Only version-controlled sources are checked (git ls-files), so generated /
# gitignored directories drop out automatically; test/spec files are excluded
# by convention. The baseline may only shrink: split a god-file (remove its
# entry) rather than raising its number.
#
# Exit codes:
#   0 = clean, warnings only, or only tolerated baseline files
#   1 = at least one file over ERROR_THRESHOLD or over its baseline

set -euo pipefail

WARN_THRESHOLD="${WARN_THRESHOLD:-500}"
ERROR_THRESHOLD="${ERROR_THRESHOLD:-1000}"
WHITELIST_FILE=".filesize-whitelist"
BASELINE_FILE=".filesize-baseline"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# --- Load whitelist (one path per line, # = comment) ---
declare -A WHITELISTED
if [[ -f "$WHITELIST_FILE" ]]; then
    while IFS= read -r line; do
        line="${line%%#*}"
        line="${line// /}"
        [[ -z "$line" ]] && continue
        WHITELISTED["$line"]=1
    done < "$WHITELIST_FILE"
fi

# --- Load baseline (ratchet). Format: <relative path>  <max-lines> ---
declare -A BASELINE
if [[ -f "$BASELINE_FILE" ]]; then
    while IFS= read -r line; do
        line="${line%%#*}"
        [[ -z "${line// /}" ]] && continue
        read -r bl_path bl_max _ <<< "$line"
        [[ -z "$bl_path" || -z "${bl_max:-}" ]] && continue
        [[ "$bl_max" =~ ^[0-9]+$ ]] || continue
        BASELINE["$bl_path"]="$bl_max"
    done < "$BASELINE_FILE"
fi

# --- List source files ---
list_source_files() {
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        git ls-files --cached --others --exclude-standard -- '*.py' '*.ts' '*.tsx' '*.js' '*.jsx'
    else
        find . -type f \( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
            ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/build/*" \
            ! -path "*/__pycache__/*" ! -path "*/migrations/*" ! -path "*/.venv/*" \
            ! -path "*/venv/*" ! -path "*/.git/*" ! -path "*/coverage/*" \
            ! -path "*/.next/*" ! -path "*/site/*" ! -path "*/dev-dist/*" \
            | sed 's|^\./||'
    fi
}

FILES=$(list_source_files \
    | grep -vE '(^|/)(tests?|e2e)/' \
    | grep -vE '\.(test|spec)\.(ts|tsx|js|jsx)$' \
    | grep -vE '(^|/)test_[^/]*\.py$' \
    | grep -vE '(^|/)conftest\.py$' \
    | sort)

warnings=0
errors=0
baselined=0
total_checked=0

# ${#ARR[@]} on an EMPTY associative array errors under set -u, so count via
# the -v guard. An empty baseline is the success state of the ratchet.
whitelist_count=0
[[ -v WHITELISTED[@] ]] && whitelist_count=${#WHITELISTED[@]}
baseline_count=0
[[ -v BASELINE[@] ]] && baseline_count=${#BASELINE[@]}

printf "\n=== Cohesion check: file sizes ===\n"
printf "Warn threshold: %d lines | Error threshold: %d lines\n" "$WARN_THRESHOLD" "$ERROR_THRESHOLD"
printf "Whitelist: %d entries | Baseline: %d entries\n\n" "$whitelist_count" "$baseline_count"

for relpath in $FILES; do
    [[ -f "$relpath" ]] || continue
    lines=$(wc -l < "$relpath")
    total_checked=$((total_checked + 1))

    # 1) Whitelist: deliberately large + cohesive -> never an error
    if [[ -n "${WHITELISTED[$relpath]:-}" ]]; then
        [[ "$lines" -gt "$WARN_THRESHOLD" ]] \
            && printf "  SKIP  %6d  %s  (whitelisted)\n" "$lines" "$relpath"
        continue
    fi

    # 2) Baseline (ratchet): current state tolerated, must not grow
    if [[ -n "${BASELINE[$relpath]:-}" ]]; then
        bl="${BASELINE[$relpath]}"
        if [[ "$lines" -gt "$bl" ]]; then
            printf "  ERROR %6d  %s  (baseline %d exceeded - split it)\n" "$lines" "$relpath" "$bl"
            errors=$((errors + 1))
        else
            printf "  BASE  %6d  %s  (frozen at <=%d)\n" "$lines" "$relpath" "$bl"
            baselined=$((baselined + 1))
        fi
        continue
    fi

    # 3) Normal thresholds
    if [[ "$lines" -gt "$ERROR_THRESHOLD" ]]; then
        printf "  ERROR %6d  %s  (new god-file > %d)\n" "$lines" "$relpath" "$ERROR_THRESHOLD"
        errors=$((errors + 1))
    elif [[ "$lines" -gt "$WARN_THRESHOLD" ]]; then
        printf "  WARN  %6d  %s\n" "$lines" "$relpath"
        warnings=$((warnings + 1))
    fi
done

printf "\n--- Result ---\n"
printf "Checked:   %d files\n" "$total_checked"
printf "Baseline:  %d file(s) frozen (tolerated)\n" "$baselined"
printf "Warnings:  %d (> %d lines)\n" "$warnings" "$WARN_THRESHOLD"
printf "Errors:    %d (> %d lines or baseline exceeded)\n" "$errors" "$ERROR_THRESHOLD"

if [[ "$errors" -gt 0 ]]; then
    printf "\nCohesion policy violated. %d file(s) too large.\n" "$errors"
    printf "Options: split the file, or record it with a reason in\n"
    printf "  .filesize-whitelist (deliberately large + cohesive) or\n"
    printf "  .filesize-baseline (temporary legacy, must not grow).\n"
    exit 1
fi

if [[ "$warnings" -gt 0 ]]; then
    printf "\n%d file(s) over %d lines. Not a blocker, but refactoring is encouraged.\n" \
        "$warnings" "$WARN_THRESHOLD"
fi

printf "\nCohesion check passed.\n"
exit 0
