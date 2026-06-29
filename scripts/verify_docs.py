#!/usr/bin/env python3
"""Documentation drift verifier (docs/patterns/04-docs-verification.md).

Fails when the docs drift from the repo. Stdlib-only, fast, runnable
anywhere. Extend the CHECKS list as your docs grow; keep each check cheap
and deterministic.

Current checks:
  1. Patterns index: every docs/patterns/NN-*.md (except README) is linked
     from docs/patterns/README.md, and every pattern link in the README
     resolves to a file (no orphans, no dead links).
  2. Rules: every `<name>.md` in .claude/rules/ that CLAUDE.md references
     exists, and every rule file is referenced by CLAUDE.md.

Usage:
    python3 scripts/verify_docs.py        # exit 1 on drift
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PATTERNS_DIR = REPO_ROOT / "docs" / "patterns"
RULES_DIR = REPO_ROOT / ".claude" / "rules"
CLAUDE_MD = REPO_ROOT / "CLAUDE.md"


def check_patterns_index() -> list[str]:
    errors: list[str] = []
    readme = PATTERNS_DIR / "README.md"
    if not readme.exists():
        return [f"missing {readme.relative_to(REPO_ROOT)}"]
    readme_text = readme.read_text(encoding="utf-8")
    linked = set(re.findall(r"\(([0-9]{2}-[a-z0-9-]+\.md)\)", readme_text))
    on_disk = {p.name for p in PATTERNS_DIR.glob("*.md") if p.name != "README.md"}

    for name in sorted(on_disk - linked):
        errors.append(f"pattern doc not linked from patterns/README.md: {name}")
    for name in sorted(linked - on_disk):
        errors.append(f"patterns/README.md links a missing pattern doc: {name}")
    return errors


def check_rules_references() -> list[str]:
    errors: list[str] = []
    if not CLAUDE_MD.exists():
        return [f"missing {CLAUDE_MD.relative_to(REPO_ROOT)}"]
    claude_text = CLAUDE_MD.read_text(encoding="utf-8")
    referenced = set(re.findall(r"`([a-z0-9-]+\.md)`", claude_text))
    on_disk = {p.name for p in RULES_DIR.glob("*.md")}

    for name in sorted(on_disk):
        if name not in referenced:
            errors.append(f".claude/rules/{name} exists but CLAUDE.md never references it")
    return errors


CHECKS = [
    ("patterns index", check_patterns_index),
    ("rules references", check_rules_references),
]


def main() -> int:
    failed = False
    for title, check in CHECKS:
        errors = check()
        if errors:
            failed = True
            print(f"FAIL [{title}]")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"OK   [{title}]")
    if failed:
        print("\nDocumentation drift detected. Update the docs (or this verifier).")
        return 1
    print("\nverify-docs passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
