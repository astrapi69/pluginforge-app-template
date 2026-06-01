# Pattern: Documentation verification

> Backported from adaptive-learner. Template-neutral; adapt the names to your app.

**Status in this template:** not yet implemented. The Makefile has no `verify-docs` or `verify-docs-discipline` target, `scripts/verify_docs.py` does not exist, and no MkDocs or nav-source-of-truth setup is present. The discipline is documented in `.claude/rules/ai-workflow.md` (single-source-of-truth for volatile stats; numeric-claims verification); the enforcement tooling is missing.

## Why

Docs rot silently. Version badges, plugin counts, feature lists, and help-page nav entries drift from the code across releases. Nobody notices until a user reports a discrepancy or a new contributor follows outdated instructions. By then trust is eroded and the fix requires a manual audit across many files.

The problem has two sub-shapes:

- **Content drift.** A version badge in `README.md` that was accurate at release becomes stale after the next bump. A plugin count mentioned in the architecture docs drifts when a plugin is added or removed. A feature list promises something the code has not shipped yet.
- **Nav drift.** A help page exists on disk and is reachable via a direct URL, but was never added to the site nav. From the user's perspective the page does not exist.

Both are invisible to the human author, because the author who wrote the page also knew where it was. Automated checks catch what humans miss.

The governing principle from `.claude/rules/ai-workflow.md` applies directly: numbers in docs must be read from code, not from memory. If a value is not findable in the code or config, that is a signal to flag it, not to guess.

## The pattern

Two layers, aggregated behind a single Make target `make verify-docs-discipline`:

### Layer 1 - drift verifier (`scripts/verify_docs.py`)

A stdlib-only Python script (no heavy deps, runs anywhere fast) that reads the **code and config as the source of truth** and compares what docs claim.

**FAIL gates** - these block the build and the release:

- Version badge or header in `README.md` / `README-de.md` does not match the canonical version in `backend/pyproject.toml`.
- Plugin count mentioned in docs does not match `ls plugins/*/` on disk.
- Locale parity: every help page present in one locale directory must exist in all other locale directories (e.g. `docs/help/en/` vs `docs/help/de/`).
- Nav orphans: every help page file on disk has a nav entry; every nav entry resolves to a file. Filesystem-based, not crawl-based.
- Dead internal links: a `[text](path)` in any doc file points to a path that does not exist relative to the repo root.

**WARN signals** - non-blocking, printed but do not exit non-zero:

- Test count mentioned in a doc is more than 10% away from the count reported by `pytest --collect-only -q`.
- A README feature paragraph mentions a named feature that has no corresponding source file, route, or i18n key.
- A date in a doc header is more than six months in the past without a known stable-content annotation.
- i18n key drift: a key referenced in frontend code is absent from one or more locale YAML catalogs.

Warn signals are informational. Do not promote them to FAIL without deliberate review - blocking a release on a stale test-count annotation would be noise; blocking on a wrong version badge is correct.

### Layer 2 - nav sync check (`verify-mkdocs-nav` or equivalent)

When you adopt a documentation site (MkDocs, Docusaurus, plain HTML, anything with a nav config), keep one file as the single source of truth for the navigation structure - for example `docs/help/_meta.yaml`. A second script or Make step verifies that the site nav config (e.g. `mkdocs.yml`) matches that file exactly. Drift here is the classic "page exists on disk, is unreachable from the side nav" bug.

If you do not have a docs site yet, this layer is a no-op. Add it when you wire one.

### Aggregate target

```makefile
verify-docs-discipline: verify-docs verify-mkdocs-nav  ## Fail on version/plugin/locale/nav drift

verify-docs:  ## Run scripts/verify_docs.py (version badges, plugin counts, locale parity, orphans)
	cd backend && poetry run python ../scripts/verify_docs.py

verify-mkdocs-nav:  ## Check nav config matches docs/help/_meta.yaml (no-op until MkDocs is added)
	@echo "verify-mkdocs-nav: no nav source of truth configured yet - skipping"
```

Wire `verify-docs-discipline` into CI and into the `release-test` chain (see `03-release-automation.md`) so drift cannot ship.

## What the template already provides

- `docs/configuration.md` - a real doc file, so the drift verifier has something to validate against from day one.
- `.github/workflows/ci.yml` - CI infrastructure ready to accept a `verify-docs-discipline` step.
- `.claude/rules/ai-workflow.md` sections "Single source of truth for volatile statistics" and "Numeric claims verification" - the AI-workflow discipline is documented. The enforcement script is the missing piece.
- `backend/pyproject.toml` as the canonical version source - the verifier has an unambiguous place to read the true version.

## To complete it

1. **Write `scripts/verify_docs.py`** (stdlib only: `pathlib`, `re`, `tomllib`, `sys`, `subprocess`). Start with the two highest-value FAIL checks: version-badge vs `backend/pyproject.toml`, and plugin-count vs `ls plugins/*/`. Add locale-parity and orphan checks once those pass.

2. **Add `make verify-docs` and `make verify-docs-discipline`** to the Makefile.

3. **Wire into CI** - add a step in `.github/workflows/ci.yml` after the existing linting job:
   ```yaml
   - name: Docs verification
     run: make verify-docs-discipline
   ```

4. **Wire into the release-test chain** - in `docs/patterns/03-release-automation.md` (or your release workflow), add `make verify-docs-discipline` to the pre-tag checklist so a wrong version badge cannot pass the gate.

5. **Add a nav source of truth** if you adopt MkDocs or another docs site. A single `_meta.yaml` that both the nav generator and the verifier read prevents the orphan problem from the start.

## Gotchas

**File existence is not discoverability.** A help page that is not listed in the site nav is unreachable to users even though direct URLs still resolve. Orphan detection must be filesystem-based: enumerate every `.md` file under `docs/help/` and assert each one has a nav entry. Do not rely on a successful HTTP crawl - that only catches 404s, not silent navigation gaps.

**Keep the verifier stdlib-only.** Adding `requests`, `beautifulsoup4`, or any other non-stdlib dependency to the script creates a bootstrap problem: the script must be runnable before the dev environment is fully set up, and in CI before the Poetry venv is activated. `pathlib`, `re`, `tomllib` (Python 3.11+ stdlib), and `subprocess` are sufficient for all FAIL-gate checks.

**WARN vs FAIL tiers matter.** A wrong version badge in `README.md` is a factual error that ships to users - it is a FAIL. A test count that is 5% stale in a journal doc is noise - it is a WARN. Promoting everything to FAIL trains contributors to ignore the gate. Reserve FAIL for claims users rely on to make decisions (version, plugin names, feature availability).

**The verifier is not a spell checker or a style linter.** Scope it to machine-verifiable facts: version strings, file counts, file existence. Prose quality, completeness, and accuracy are human review concerns.
