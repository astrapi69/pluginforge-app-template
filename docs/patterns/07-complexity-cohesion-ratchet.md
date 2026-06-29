# Pattern: Complexity + cohesion ratchet gates

> Backported from adaptive-learner. Template-neutral; adapt the names to your app.

**Status in this template:** the **cohesion (file-size) gate** and the
**complexity ratchet gate (Python/radon)** both ship -
`scripts/check-file-sizes.sh` + `scripts/check-complexity.sh` (+
`radon_warn.py` / `complexity_gate.py`), with `make check-file-sizes` /
`check-complexity` / `check-complexity-gate` / `check-complexity-gate-update`
and shrink-only `.filesize-baseline` + `.complexity-baseline` (plus a
`.filesize-whitelist`). radon is a backend dev-dependency. The **TypeScript
(eslint) half of the complexity gate degrades gracefully** and is inactive
until the template has an ESLint flat config (`eslint.config.js`); the
**god-folder watcher** is still documented-only - add it as below.

---

## Why

Codebases rot one acceptable-looking commit at a time: a function grows
from 18 to 25 branches, a file from 400 to 1200 lines, a directory from 12
to 30 flat modules. No single diff looks bad enough to block, so nothing
ever does — until the whole tree is a field of god-files. A **ratchet
gate** makes the metric monotonic: existing offenders are grandfathered in
a baseline file, but a NEW offender (or a regression of an existing one)
fails the build. The baseline may only shrink. You never have to do a big
cleanup; you just can't get worse.

---

## The pattern

Three independent watchers, each with the same shape — measure, compare to
a committed baseline, fail only on regression:

1. **Cohesion / file size** — lines per source file. Warn over a soft
   limit (e.g. 500), error over a hard limit (e.g. 1000). Existing
   over-limit files are listed in `.filesize-baseline`; a new one over the
   threshold, or an existing one growing past its recorded cap, fails.
2. **Cyclomatic complexity** — per-function complexity. Python via
   `radon` (rank D/E/F ~ cc > 20), TypeScript via the ESLint `complexity`
   rule. Offenders are recorded in `.complexity-baseline`; new or
   regressed offenders fail the gate.
3. **God-folder / directory size** — flat source files per directory
   (e.g. > 15). New oversized directories fail against `.dirsize-baseline`,
   pushing you to group by concern with a barrel + parent re-export.

Each watcher has a **warn-only** mode (informational, never blocks) and a
**gate** mode (the ratchet, fails CI). The gate degrades gracefully when a
tool is missing (radon/eslint absent -> skip that half, never crash).

The baselines are committed and shrink-only: a `*-baseline-update` target
re-records the current offenders but, by policy, may only remove entries —
never add — unless an explicit override flag is passed.

---

## What the template already provides

- The directory layout (`backend/app`, `plugins`, `frontend/src`) the
  watchers target.
- ESLint with TypeScript support (the `complexity` rule plugs straight in).
- `.claude/rules/quality-checks.md` documents the strategy and coverage
  targets the gates enforce.

---

## To complete it

1. Add three shell scripts under `scripts/` — `check-file-sizes.sh`,
   `check-complexity.sh`, `check-directory-size.sh` — each taking an
   optional `--gate` flag. Have `check-complexity.sh` bootstrap `radon`
   into a gitignored `.radon-venv` (or use `python3 -m radon` when
   importable) and skip gracefully when neither radon nor eslint is
   available.
2. Seed each baseline file. For a fresh template the honest seed is an
   **empty baseline** (zero grandfathered offenders) — the gate then keeps
   the tree clean from day one. For an existing codebase, seed from the
   current offenders so the gate does not block legitimate work.
3. Wire Makefile targets:

```makefile
check-file-sizes:        ## Cohesion watcher: warn/error on oversized files (ratchet via .filesize-baseline)
	bash scripts/check-file-sizes.sh
check-complexity:        ## Complexity watcher (warn-only): radon + eslint complexity
	bash scripts/check-complexity.sh
check-complexity-gate:   ## Complexity ratchet gate: fail on new/regressed offenders vs .complexity-baseline
	bash scripts/check-complexity.sh --gate
check-directory-size-gate: ## God-folder ratchet: fail on a NEW oversized dir vs .dirsize-baseline
	bash scripts/check-directory-size.sh --gate
```

4. Add a CI workflow (`complexity-check.yml`) that runs the `*-gate`
   targets. Run it on the night shift, not on every PR, unless your team
   wants the complexity gate to be merge-blocking (see pattern 08 for the
   PR-gates-vs-night-shift split).

---

## Gotchas

**Seed the baseline honestly, then only let it shrink.** The whole value
is that the baseline cannot grow silently. If `*-baseline-update` can add
entries freely, the ratchet is decorative. Gate growth behind an explicit
`--allow-baseline-growth` flag and require a justification in the PR.

**Warn-only first, gate later.** Introduce each watcher in warn-only mode
for a release or two so contributors see the signal before it can block
them. Flip to gate mode once the baseline is stable.

**A gate that crashes on a missing tool is worse than no gate.** Every
watcher must skip-and-continue when radon/eslint/node_modules are absent,
the same way diagnostic features fail open (see `lessons-learned.md`).
