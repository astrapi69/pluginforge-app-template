#!/usr/bin/env bash
# Thin wrapper over scripts/bootstrap/bootstrap.py.
#
# Usage:
#   scripts/bootstrap/bootstrap-app.sh \
#       --manifest path/to/entities.yaml \
#       --target-dir /absolute/path/to/new/app \
#       [--dry-run] \
#       [--skip-migration] \
#       [--with-example-plugin] \
#       [--verbose]
#
# Linux + macOS only in v1. Windows users: WSL or follow CUSTOMIZE.md manually.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pick the Python interpreter: prefer the template's backend Poetry env
# if available (PyYAML is already installed there), otherwise fall back
# to the system python3.
if command -v poetry >/dev/null 2>&1 && [ -f "${HERE}/../../backend/pyproject.toml" ]; then
    cd "${HERE}/../../backend"
    exec poetry run python "${HERE}/bootstrap.py" "$@"
fi

exec python3 "${HERE}/bootstrap.py" "$@"
