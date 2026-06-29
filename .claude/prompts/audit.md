# myapp — systematic audit prompt

Drop-in for any audit pass. Replace `myapp` with your app, then paste
verbatim into a fresh Claude Code session at the repo root.

---

Analyze the codebase at the working directory. Perform a systematic audit
against the project's documented standards. This is a Python 3.11+ /
FastAPI / SQLAlchemy 2.0 / Pydantic v2 backend; React / TypeScript (strict)
/ Vite frontend; PluginForge-based plugin architecture; local-first with a
layered config/secrets chain.

## Authoritative sources

Before flagging anything, consult:

- `CLAUDE.md` (project overview, plugin table, conventions)
- `.claude/rules/architecture.md` (4-layer architecture, plugin shape, UI strategy)
- `.claude/rules/coding-standards.md` (naming, function design, tests, dependencies)
- `.claude/rules/code-hygiene.md` (error-handling architecture, API conventions)
- `.claude/rules/tdd.md` (Red-Green-Refactor, tests-per-change)
- `.claude/rules/lessons-learned.md` (known pitfalls)
- `.claude/rules/quality-checks.md` (test pyramid, coverage targets, mutation testing)
- `docs/patterns/` (opt-in cross-cutting designs and their status)

If a finding contradicts a documented convention, cite the rule file. If
the convention itself is stale, flag it as Outdated under section 4.

## Audit scope

### 1. Test validity

- Cross-reference unit / integration / E2E tests with the current
  implementation. Backend: `backend/tests/` + `plugins/*/tests/` (pytest).
  Frontend: `frontend/src/**/*.test.*` (Vitest). E2E: `e2e/` (Playwright,
  data-testid only).
- Identify outdated, redundant, or unreachable tests. Distinguish
  intentional environment-gated skips from `test.skip` masking a real bug.
- Verify coverage of critical paths against the targets in
  `quality-checks.md`.
- Numeric claims: per `ai-workflow.md`, every test count / coverage % must
  be verified by running the authoritative command in the same session,
  not recalled.

### 2. Code quality and technical debt

- Detect deprecated patterns, orphaned imports, unused variables, dead code.
- Verify the error-handling architecture per `code-hygiene.md`: services
  raise typed domain errors (NotFound / Validation / Conflict /
  ExternalService), NEVER `HTTPException`. Routers catch nothing; the
  global handler maps. Frontend catches throw `ApiError` and surface
  `.detail` to a toast.
- Verify architectural compliance:
  - No `fetch()` outside the API client layer; component-side calls go
    through the storage/service abstraction.
  - No `console.log` for user feedback. Toasts via react-toastify.
  - No browser dialogs (`alert`/`confirm`/`prompt`); use the app dialog.
  - No raw HTML render of user content.
  - No hardcoded user-facing strings; all UI text via the i18n catalogs.
  - No hardcoded colours; use design tokens (`var(--*)`).
  - No `any` in TypeScript without an inline justification comment.
  - No em-dash (literal or U+2014). Hyphens or commas only.
- Plugin compliance per `architecture.md`: `BasePlugin` subclass,
  `depends_on` as a class attribute, hook specs in
  `backend/app/hookspecs.py`, `target_application` declared. Plugin
  settings either UI-visible or marked `# INTERNAL`; no dead YAML fields.
- Function design: max ~40 lines, single responsibility, consistent
  abstraction level. Route handlers thin (validate, call service, return).
  Anti-pattern: `# Step 1` / `# Step 2` comments inside one function.

### 3. Infrastructure and dependencies

- Poetry: `backend/pyproject.toml` + each `plugins/*/pyproject.toml`. Run
  `poetry show --outdated`. Distinguish patch/minor (release-prep
  candidates) from major bumps (own session).
- Frontend: `frontend/package.json`. Run `npm outdated`. Stability filter:
  no beta/RC/alpha; min 2 weeks since release for majors; LTS over Current
  for Node.js.
- Docker: `Dockerfile`(s) + `docker-compose.yml` + `docker-compose.prod.yml`.
  Verify base-image consistency, build-context paths, no dev/prod drift.
- Git: verify Conventional Commits prefixes, no force-pushes on open PRs,
  pre-commit hooks active (`.pre-commit-config.yaml`).
- `.gitignore` consistency: `.env`, `*.db`, uploads, `__pycache__/`,
  coverage artifacts, encrypted credential blobs.
- Secrets: the layered chain (project YAML < user override < env vars).
  Verify no committed YAML carries a non-empty `api_key:`.
- Env vars: confirm the documented ports and `MYAPP_*` variables match the
  Makefile `dev` target and `.env.example`.
- `pluginforge` pin: verify it matches the latest released version across
  `backend/pyproject.toml` and every `plugins/*/pyproject.toml`.

### 4. Documentation and structure

- README: version line, install one-liner, ports, plugin table.
- ROADMAP / backlog: header dates reflect shipped state; BLOCKED items
  tagged inline.
- API docs: FastAPI `/docs` + `/openapi.json` are the source of truth.
- Single source of truth: volatile numbers (test counts, model/plugin
  counts, supported languages) live in ONE canonical location;
  documentation references it instead of inlining. Flag any duplication.
- Project structure: 4-layer architecture under `backend/app/`,
  `plugins/myapp-plugin-{name}/`, `frontend/src/{pages,components,hooks,api}/`,
  `e2e/`. Flag deviation.

## Output format

- Markdown, strictly grouped by the 4 sections above.
- Each finding as a table row:
  `| [File:Line] | [Type] | [Reason] | [Recommended action] | [Priority] |`
- **Type**: `Blocker` (hard rule violation), `Outdated` (drift / EOL /
  superseded), `Improvement` (cleanup/alignment), `Info` (intentional /
  dormant / blocked-on-upstream).
- **Priority**: P0 (deadline/production bug), P1 (rule violation in active
  code), P2 (drift/cleanup), P3 (nice-to-have / intentional / upstream).
- Reference rule files when citing a violation.
- Use `[TBD]` for context that cannot be verified this session.

## After the audit

End the report with:

1. **Summary counts** by priority (P0/P1/P2/P3).
2. **Automation-ready batch**: findings safe for a single mechanical commit
   (clear scope, no judgment calls), vs. findings needing a dedicated session.
3. **Halt list**: findings the audit will not act on without approval
   (multi-site refactors, dependency major bumps, security-sensitive
   changes) — one-sentence reason each.
4. **Verification commands** the audit ran, so the report is reproducible.

Do not modify code as part of the audit unless explicitly asked. The audit
output is a triage document, not a patch.
