# Patterns

Reusable architecture + tooling patterns for apps built on this template,
backported from the reference downstream app
[adaptive-learner](https://github.com/astrapi69/adaptive-learner). Each doc
is **template-neutral**: it documents the PATTERN (design, motivation, how
to wire it up) rather than copying any one app's domain code. Adapt the
`myapp` naming to your app.

Each page states what this template **already provides** and what you'd
**add** to complete the pattern, so you can adopt them incrementally.

| # | Pattern | What it gives you | Status in this template |
|---|---------|-------------------|-------------------------|
| 01 | [Dual-storage `IStorageService`](01-dual-storage.md) | One interface, two backings (server + browser IndexedDB) so the same UI runs with or without a backend | Partial (Dexie used for drafts only; no abstraction yet) |
| 02 | [Dexie-mode release gate](02-dexie-mode-release-gate.md) | A gate that exercises the backend-free static build so browser-mode regressions never reach production | Partial (Playwright present; no Dexie gate) |
| 03 | [Release automation](03-release-automation.md) | One canonical version + tooling propagation + aggregate release targets | Present (sync-versions + release-gate CI; explicit release-* targets missing) |
| 04 | [Documentation verification](04-docs-verification.md) | A check that fails the build when docs drift from the code | Not yet (discipline documented, enforcement missing) |
| 05 | [i18n sync pipeline](05-i18n-sync.md) | Backend YAML catalogs as the single source, mirrored to bundled frontend JSON | Partial (8 YAML catalogs + parity tests; no sync/JSON) |
| 06 | [Friendly error messages](06-friendly-errors.md) | Production users see clean strings; developers still get actionable detail | Partial (exception hierarchy + ApiError present; UI mapping + Dev Mode missing) |

These complement the development rules in [`.claude/rules/`](../../.claude/rules/):
the rules are how to work in this codebase; these patterns are larger
cross-cutting designs you opt into per app.
