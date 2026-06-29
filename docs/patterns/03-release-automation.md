# Pattern: Release automation (single-source version + aggregate targets)

> Backported from adaptive-learner. Template-neutral; adapt the names to your app.

**Status in this template:** the single-source propagation machinery (`scripts/sync_versions.py`, `make sync-versions` / `sync-versions-dry` / `sync-versions-check`, `scripts/verify_version_pins.sh`) and the CI enforcement workflow (`.github/workflows/release-gate.yml`) are present. The gitflow `release-prepare` / `release-finish` / `release-publish` Makefile targets now ship (they assume a `develop` branch — create one before use). The aggregate `release-test` gate is still left as a manual checklist in `.claude/rules/release-workflow.md` Steps 4-7; the skeleton below shows how to wire it.

---

## Why

A multi-subsystem app - backend, frontend, launcher, N plugins, install scripts - has the version string in many files. Editing each at release time drifts. In adaptive-learner, an audit of the same machinery found pins that were 8, 13, and 3 versions behind the canonical `backend/pyproject.toml`, discovered only because a verify script was introduced and run for the first time. The pattern exists to make that class of bug impossible by construction, and to make the entire release a repeatable single command rather than a mental checklist that gets shortened under pressure.

---

## The pattern

The pattern has two halves that reinforce each other.

**Half 1: one canonical version per language subsystem; everything else derived.**

`backend/pyproject.toml` is the only file a human edits at release time for the Python subsystem. `frontend/package.json` is the only file edited for the JS subsystem. Every other version-bearing field derives from one of those two canonical sources, via a mechanism that can be re-run idempotently from a clean checkout.

Derivation table (template defaults, adapt as needed):

| Derived location | Source | Mechanism |
|---|---|---|
| `frontend/package.json` | `backend/pyproject.toml` | `make sync-versions` (JSON key write) |
| `launcher/pyproject.toml` | `backend/pyproject.toml` | `make sync-versions` (TOML regex) |
| `launcher/myapp_launcher/__init__.py` | `backend/pyproject.toml` | `make sync-versions` literal substitution (kept for frozen-binary compat) |
| `launcher/myapp-launcher.spec` CFBundle fields | `backend/pyproject.toml` | `make sync-versions` literal substitution |
| `plugins/*/pyproject.toml` | `backend/pyproject.toml` | `make sync-versions` (all plugins in lock-step) |
| `install.sh` / `install.ps1` | `install.sh.template` / `install.ps1.template` + `backend/pyproject.toml` | `make sync-versions` template substitution (`@@MYAPP_VERSION@@`) |
| `backend/app/__init__.py:__version__` | `backend/pyproject.toml` | `tomllib` parse at module import (not by `sync-versions`) |
| `frontend/src` `__APP_VERSION__` | `frontend/package.json` | Vite `define` block at build time |
| Launcher `MYAPP_TARGET_VERSION` | `backend/pyproject.toml` | PyInstaller spec injects `_build_info.py` at build time |

If a hardcoded version literal reappears in any "DO NOT EDIT" row, the derivation is broken. Fix the derivation, not the literal. `scripts/verify_version_pins.sh` contains regex-based regression detectors for each class.

**Half 2: aggregate Makefile targets so the gate cannot be skipped.**

A single `make release-test` chains every mandatory pre-tag check. A single `make release-tag` handles the canonical bump, propagation, commit, tag, and push. The CI `release-gate.yml` workflow is the hard backstop that runs the same verification on every tag push and blocks artifact attachment on failure. The combination means: the human edits one field, runs two commands, and cannot accidentally ship a broken or version-drifted tag.

---

## What the template already provides

- `scripts/sync_versions.py` - applies / dry-runs / checks propagation for all derived locations. `make sync-versions`, `make sync-versions-dry`, `make sync-versions-check`.
- `scripts/verify_version_pins.sh <version>` - confirms canonical pins match the expected version, checks installer artifact sync, and runs regression detectors for forbidden hardcoded literals.
- `.github/workflows/release-gate.yml` - CI gate on `v*` tag push: confirms tag matches canonical, runs `verify_version_pins.sh`, runs `sync_versions.py --check`. The launcher build workflows re-run the same gate as their first step and block artifact attachment on failure.
- `make lock-all-plugins` / `make verify-plugin-locks` - re-locks per-plugin `poetry.lock` files after a shared-dep bump, and detects drift between each plugin's `pyproject.toml` and its lock.
- `.claude/rules/release-workflow.md` - the manual checklist covering Steps 1-11, including the pre-tag verification commands.

---

## To complete it

Add three Makefile targets. Skeleton:

```makefile
# Aggregate every mandatory pre-tag check into one command.
# Adapt the list to your app: add the dexie-mode gate (pattern 02),
# docs-verify (pattern 04), and any app-specific build gates.
release-test: ## Run every mandatory pre-tag gate
	make test
	cd frontend && npx tsc --noEmit
	cd frontend && npm run test
	npx playwright test --project=smoke
	cd backend && poetry run ruff check app/ && poetry run mypy app/
	cd backend && poetry run pre-commit run --all-files
	cd frontend && npm run build
	cd backend && poetry build
	@echo "All release-test gates passed."

# Bump the canonical version, propagate to all subsystems,
# commit, tag, and push. Expects VERSION= to be set:
#   make release-tag VERSION=1.2.3
release-tag: ## Bump, sync, commit, tag, push (set VERSION=x.y.z)
	@test -n "$(VERSION)" || (echo "ERROR: set VERSION=x.y.z"; exit 1)
	@echo "Bumping backend/pyproject.toml to $(VERSION)"
	@sed -i 's/^version = .*/version = "$(VERSION)"/' backend/pyproject.toml
	make sync-versions
	scripts/verify_version_pins.sh $(VERSION)
	git add -A
	git commit -m "chore(release): bump version to v$(VERSION)"
	git tag v$(VERSION)
	git push origin main --tags
	@echo "Tagged v$(VERSION) and pushed."
```

Two rules for every new version-bearing location you add:

1. Add it to `collect_targets()` in `scripts/sync_versions.py`.
2. Add a regression detector to `scripts/verify_version_pins.sh`.
3. Confirm the CI gate in `release-gate.yml` would catch drift (it delegates to the same two scripts, so it usually requires no change).

Three artifacts per new pin. Never one or two.

---

## Gotchas

**Never add a "convenience" hardcoded version literal.** Strings like `APP_VERSION = "1.2.3"` in a component, a footer, or an issue-body template look harmless. They stale silently. The regression detectors in `verify_version_pins.sh` exist specifically to catch reintroductions; do not defeat them by suppressing the grep pattern.

**Two plugin installation paths drift independently.** `make test` installs plugins from the backend's combined `poetry.lock` (path-deps). CI installs each plugin from its own per-plugin `poetry.lock`. When a shared external pin (e.g. `fastapi`) bumps in every plugin `pyproject.toml`, only running `poetry lock` in the backend directory is not enough. Run `make lock-all-plugins` after any shared-dep bump to regenerate each plugin's lock, then commit all changed `poetry.lock` files. The pre-commit hook `plugin-lock-paired-with-pyproject` catches the case where a plugin `pyproject.toml` is staged without a paired lock change.

**`--check` modes must be idempotent.** `make sync-versions-check` and `make verify-plugin-locks` must produce the same answer when run twice in a row without writes, and must not depend on environment state beyond the repo tree. CI relies on this property; a check that mutates state on first run and passes on second run is a false gate.

**Keep failed-gate tags as historical record.** A tag pushed before the gate passed is part of the audit trail. Do not delete published tags to clean up a hotfix cluster. Note the failure in the per-release changelog file and ship the corrected tag as the next patch. The only safe exception is a tag pushed in the last few minutes that no one could have fetched and for which no GitHub Release was published.

**`pluginforge` is not auto-synced.** It has an independent release lifecycle and is pinned via Poetry directly in `backend/pyproject.toml` and every `plugins/*/pyproject.toml`. Verify the pin manually at release time per the checklist in `.claude/rules/release-workflow.md` Step 4.
