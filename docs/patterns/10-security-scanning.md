# Pattern: Security scanning (warn-only night shift + blocking gate)

> Backported from adaptive-learner. Template-neutral; adapt the names to your app.

**Status in this template:** the Makefile target *structure* ships
(`audit-backend`, `audit-frontend`, `bandit-backend`, `check-security`)
with **empty placeholder ignore-lists** — no app's accepted-CVE baseline
is carried over. Wiring the scheduled CI workflow is the remaining step.

---

## Why

Dependency vulnerabilities and SAST findings need two different
treatments. Most findings are informational — you want to SEE them
regularly without a transient advisory blocking every unrelated PR. A
small subset (HIGH/CRITICAL dependency CVEs) genuinely should block a
release. Splitting the two keeps PRs fast while still gating what matters.

---

## The pattern

**Warn-only sweep (night shift + on demand).** A daily/weekly scheduled
job (mirrored by local Makefile targets) runs:

- `pip-audit` over the backend venv (incl. plugin path-deps).
- `npm audit` over the frontend lockfile.
- `bandit` SAST over backend app + plugins + scripts (MEDIUM+ severity and
  confidence).

All three are `|| true` — they report, never fail. They live on a
`schedule:` + `workflow_dispatch:` trigger (and on `push: release/**`),
NOT on `pull_request`.

**Blocking gate (manual pre-PR + release).** A single `check-security`
target fails on HIGH/CRITICAL dependency vulnerabilities only
(`pip-audit` strict + `npm audit --audit-level=high`). Run it before a PR
and as part of the release gate. This is the narrow set that should stop a
ship; everything else is the warn-only sweep's job.

---

## What the template already provides

- `make audit-backend` / `make audit-frontend` / `make bandit-backend` /
  `make security-backend` — warn-only sweeps mirroring the nightly scan.
- `make check-security` — the blocking HIGH/CRITICAL dependency gate.
- The ignore-lists in these targets are **empty placeholders**. Populate
  them with YOUR app's reviewed-and-accepted findings; never inherit
  another app's accepted-CVE list.

---

## To complete it

1. Add a `security-scan.yml` workflow with `schedule:` +
   `workflow_dispatch:` + `push: release/**` triggers that runs the
   warn-only sweep and uploads the reports as artifacts.
2. Add `check-security` to your `release-test` aggregate so a release
   cannot ship with a known HIGH/CRITICAL dependency CVE.
3. When you accept a specific finding, record it in the target's ignore
   list WITH a justification comment and a review date — an accepted CVE
   is a decision, not a default.

---

## Gotchas

**Accepted-CVE lists are app-specific and must be reviewed, not
inherited.** An ignore entry says "this team looked at this advisory in
this context and accepted the risk." Copying another app's list
launders an unmade decision. Start empty.

**Warn-only must stay warn-only.** The moment a transient upstream
advisory can fail an unrelated PR, contributors start ignoring or
suppressing the scan. Keep the sweep `|| true`; reserve failure for the
narrow `check-security` gate.

**`pip-audit --skip-editable`** avoids noise from path-installed local
plugins; the real third-party deps are still audited.
