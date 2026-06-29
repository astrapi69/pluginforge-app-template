#!/usr/bin/env python3
"""Mirror the backend i18n YAML catalogs into bundled frontend JSON.

Pattern 05 (docs/patterns/05-i18n-sync.md): `backend/config/i18n/<lang>.yaml`
is the single source of truth; this regenerates
`frontend/src/data/i18n/<lang>.json` so the frontend can load translations
from the bundle (no backend roundtrip; static-build-ready). The frontend
imports the generated JSON via `import.meta.glob` in `hooks/useI18n.ts`.

Usage:
    python3 scripts/sync_i18n.py            # write the JSON files
    python3 scripts/sync_i18n.py --check    # exit 1 if any JSON is stale

Run it through the backend Poetry env (PyYAML lives there):
    cd backend && poetry run python ../scripts/sync_i18n.py
The Makefile `sync-i18n` / `sync-i18n-check` targets do this for you.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "backend" / "config" / "i18n"
OUT_DIR = REPO_ROOT / "frontend" / "src" / "data" / "i18n"


def _catalogs() -> list[Path]:
    return sorted(SRC_DIR.glob("*.yaml"))


def _render(path: Path) -> str:
    """Render one YAML catalog to deterministic, frontend-style JSON text."""
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    # 2-space indent + trailing newline matches the repo's TS/JSON style and
    # keeps the --check diff stable.
    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def sync(check: bool) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    catalogs = _catalogs()
    if not catalogs:
        print(f"No YAML catalogs found in {SRC_DIR}", file=sys.stderr)
        return 1

    stale: list[str] = []
    for src in catalogs:
        lang = src.stem
        out = OUT_DIR / f"{lang}.json"
        rendered = _render(src)
        if check:
            current = out.read_text(encoding="utf-8") if out.exists() else ""
            if current != rendered:
                stale.append(lang)
        else:
            out.write_text(rendered, encoding="utf-8")

    if check:
        if stale:
            print(
                "i18n JSON is stale for: "
                + ", ".join(stale)
                + "\nRun `make sync-i18n` and commit frontend/src/data/i18n/.",
                file=sys.stderr,
            )
            return 1
        print(f"i18n JSON in sync ({len(catalogs)} catalogs).")
        return 0

    print(f"Wrote {len(catalogs)} catalog(s) to {OUT_DIR.relative_to(REPO_ROOT)}/.")
    return 0


def main() -> int:
    check = "--check" in sys.argv[1:]
    return sync(check=check)


if __name__ == "__main__":
    sys.exit(main())
