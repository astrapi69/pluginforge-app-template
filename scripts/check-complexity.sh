#!/usr/bin/env bash
#
# Complexity watcher (docs/patterns/07): warn-only view + a ratchet gate.
#
#   (default)           warn-only: radon average + the cc > 15 band + eslint
#                       complexity. Visibility only; never exits non-zero.
#   --gate              hard ratchet gate: compares the current offenders to
#                       .complexity-baseline and exits non-zero on a NEW
#                       over-threshold function or a regression above its frozen
#                       complexity (mirrors the .filesize-baseline ratchet).
#   --update-baseline   regenerate .complexity-baseline from the current
#                       offenders (the file may only shrink).
#
# Gate: Python radon rank D/E/F (cc > 20); TypeScript eslint complexity > 20.
# The warn-only view surfaces the cc > 15 band. radon runs from an isolated,
# gitignored .radon-venv (or `radon` / `python3 -m radon` when available); the
# watcher degrades gracefully (skips, never crashes) when radon/eslint are
# unavailable - e.g. the TypeScript half is skipped until an ESLint flat config
# (eslint.config.js) exists.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="warn"
case "${1:-}" in
    --gate) MODE="gate" ;;
    --update-baseline) MODE="update" ;;
    "") MODE="warn" ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
esac

TARGETS=(backend/app plugins)
BASELINE=".complexity-baseline"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT
RADON_JSON="$TMPDIR/radon.json"
ESLINT_JSON="$TMPDIR/eslint.json"

# Only scan target dirs that actually exist (plugins/ may be empty).
EXISTING_TARGETS=()
for target in "${TARGETS[@]}"; do
    [ -d "$target" ] && EXISTING_TARGETS+=("$target")
done

# --- radon resolution ----------------------------------------------------
RADON_VENV="${RADON_VENV:-$ROOT/.radon-venv}"
RADON=()
if command -v radon >/dev/null 2>&1; then
    RADON=(radon)
elif [ -x "$RADON_VENV/bin/radon" ]; then
    RADON=("$RADON_VENV/bin/radon")
elif python3 -c "import radon" >/dev/null 2>&1; then
    RADON=(python3 -m radon)
elif BACKEND_VENV="$(cd backend 2>/dev/null && poetry env info -p 2>/dev/null)" \
        && [ -n "${BACKEND_VENV:-}" ] && [ -x "$BACKEND_VENV/bin/radon" ]; then
    # radon is a backend dev-dependency; reuse the backend Poetry venv so no
    # extra bootstrap is needed where `poetry install` already ran (e.g. CI).
    RADON=("$BACKEND_VENV/bin/radon")
else
    echo "Bootstrapping radon into $RADON_VENV ..."
    if python3 -m venv "$RADON_VENV" 2>/dev/null \
        && "$RADON_VENV/bin/pip" install --quiet --upgrade pip radon 2>/dev/null; then
        RADON=("$RADON_VENV/bin/radon")
    fi
fi

# Produce the radon JSON (rank D and worse) once; empty object on failure.
echo "{}" > "$RADON_JSON"
if [ "${#RADON[@]}" -gt 0 ] && [ "${#EXISTING_TARGETS[@]}" -gt 0 ]; then
    "${RADON[@]}" cc "${EXISTING_TARGETS[@]}" --min D -j > "$RADON_JSON" 2>/dev/null \
        || echo "{}" > "$RADON_JSON"
else
    echo "radon unavailable - Python complexity is skipped this run." >&2
fi

# --- eslint JSON (only needed for gate / update) -------------------------
produce_eslint_json() {
    echo "[]" > "$ESLINT_JSON"
    if [ -d frontend/node_modules ]; then
        (
            cd frontend
            npx --no-install eslint src --rule 'complexity: ["warn", 20]' \
                --format json
        ) > "$ESLINT_JSON" 2>/dev/null || true
        [ -s "$ESLINT_JSON" ] || echo "[]" > "$ESLINT_JSON"
    else
        echo "frontend/node_modules missing - TypeScript complexity is skipped." >&2
    fi
}

case "$MODE" in
    warn)
        if [ "${#RADON[@]}" -gt 0 ] && [ "${#EXISTING_TARGETS[@]}" -gt 0 ]; then
            echo "== Radon: average + cyclomatic complexity (rank B and worse) =="
            "${RADON[@]}" cc "${EXISTING_TARGETS[@]}" -a -nb || true
            echo
            echo "== Radon: functions with cc > 15 (warn-only) =="
            "${RADON[@]}" cc "${EXISTING_TARGETS[@]}" --min C -j 2>/dev/null \
                | python3 "$ROOT/scripts/radon_warn.py"
        fi
        echo
        echo "== ESLint: frontend complexity (threshold 15, warn-only) =="
        if [ -d frontend/node_modules ]; then
            ( cd frontend && npx --no-install eslint src \
                --rule 'complexity: ["warn", 15]' ) 2>/dev/null \
                || echo "eslint unavailable (no flat config?) - TypeScript complexity skipped."
        else
            echo "frontend/node_modules missing - run 'npm ci' in frontend/."
        fi
        exit 0
        ;;
    update)
        produce_eslint_json
        python3 "$ROOT/scripts/complexity_gate.py" \
            --radon-json "$RADON_JSON" --eslint-json "$ESLINT_JSON" \
            --baseline "$BASELINE" --update-baseline
        exit $?
        ;;
    gate)
        produce_eslint_json
        python3 "$ROOT/scripts/complexity_gate.py" \
            --radon-json "$RADON_JSON" --eslint-json "$ESLINT_JSON" \
            --baseline "$BASELINE"
        exit $?
        ;;
esac
