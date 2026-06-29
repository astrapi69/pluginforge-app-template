# Pattern: Test Impact Analysis + CI cadence

> Backported from adaptive-learner. Template-neutral; adapt the names to your app.

**Status in this template:** the `test-fast` and `test-changed` Makefile
targets ship (added alongside this doc); the CI cadence split (PR gates vs
night shift) is documented here and partly reflected in the existing
workflows (`ci.yml`, `coverage.yml`, `mutation-import.yml`).

---

## Why

Two related wastes creep into a growing test suite:

1. **PRs run everything.** A one-line change reruns the full backend +
   frontend + plugin + E2E matrix. Slow feedback, wasted CI minutes.
2. **Expensive, rarely-relevant jobs block merges.** Security scans,
   coverage, mutation testing, the backend-free static-build gate — none
   of these should fail a feature PR, yet they sit on the `pull_request`
   trigger and slow it down.

Test Impact Analysis (TIA) fixes (1): on a PR, run only the tests whose
covered code changed. The CI cadence split fixes (2): correctness gates on
every PR, everything informational on a daily/weekly schedule.

---

## The pattern

**TIA — selective on PRs, full nightly + release.**

| Trigger | Frontend | Backend |
|---------|----------|---------|
| PR | `vitest run --changed origin/<base>` | `pytest --testmon` |
| dev-branch push | full suite | full suite |
| Nightly | full suite | full suite |
| Release (`release-test`) | full suite | full suite |

The full suite is the safety net against false negatives. **Fallback to
the full suite is automatic**: an unresolvable base ref (frontend) or a
testmon cache miss (backend, which makes testmon rebuild its DB and run
everything) — never a silent skip. Plugin suites are cheap; keep them full.

**CI cadence — PR gates vs the night shift.**

PRs run **correctness gates only** — the checks whose failure must block a
merge. Everything informational, warn-only, or driven by external state
runs on a **schedule + `workflow_dispatch`**.

| Every PR (correctness gates) | Night shift (schedule + dispatch) |
|---|---|
| backend/frontend/plugin tests, ruff + mypy, pre-commit, type checks | security scan (pip-audit / npm audit / bandit) — warn-only |
| complexity/cohesion ratchet gates (if merge-blocking, pattern 07) | coverage report (not a gate) |
| | mutation testing (mutmut / Stryker) |
| | the backend-free static-build gate (pattern 02), if you adopt it |

Rule of thumb: if a job's failure should NOT block a merge, it belongs on
the night shift, not on `pull_request`.

---

## What the template already provides

- `make test-fast` — fast PR-mirror gate: backend ruff + mypy + pytest,
  frontend tsc + vitest, no coverage, no plugins. Mirrors what a lean PR
  CI job should run.
- `make test-changed` — TIA: `vitest run --changed origin/<base>` +
  `pytest --testmon`. Installs `pytest-testmon` on the fly.
- `ci.yml` (PR correctness gates), `coverage.yml` + `mutation-import.yml`
  (already schedule/dispatch-driven).

---

## To complete it

1. Point `test-changed` at your actual base branch (`origin/develop` under
   gitflow, else `origin/main`).
2. In CI, cache `.testmondata` (backend) keyed by a run-id with a prefix
   restore-key so it stays both warm and current; let `vitest --changed`
   resolve against the PR base ref.
3. Move any informational job currently on `pull_request` to a
   `schedule:` + `workflow_dispatch:` trigger. Gate nightly-only jobs
   behind a repo variable so a fork does not run them by accident.

---

## Gotchas

**Never weaken the nightly to make a selective PR run green.** If TIA
misses a test, the bug is in the selection mechanism — debug that, do not
shrink the full suite. The nightly full run is the thing that makes
selective PR runs safe.

**`--changed` needs the base ref fetched.** In CI, do a non-shallow
checkout (or fetch the base branch) so `vitest --changed origin/<base>`
and `pytest --testmon` can diff against it. A shallow clone makes the base
ref missing and forces (correctly) a full-suite fallback — fine for
safety, but it defeats the speed-up.

**testmon cache miss = full run, by design.** Treat a cold cache as
expected on the first run after the suite or dependencies change, not as a
failure.
