# Known pitfalls and patterns

These are universal patterns and traps that bit during the
development of apps built on this template. Domain-specific
incidents (TipTap nuances, audiobook generators, KDP exports,
Medium importers, etc.) have been pruned; the universal lessons
remain. As your app accumulates its own incidents, add them
below using the format at the top.

## How to add an entry

When a non-obvious bug, edge case, or workaround is encountered:

1. Write a heading describing the symptom or misconception, not
   the fix. Future readers grep by symptom.
2. State the trap concisely (one to three paragraphs).
3. State the rule or workaround.
4. Reference concrete artifacts (commit hashes, test files, line
   numbers) when applicable.

Anti-pattern: vague "be careful with X" entries. If there is no
concrete failure mode, the entry does not belong here.

## Format

```markdown
## {Short symptom or misconception}

{1-3 paragraphs: what was tried, what failed, root cause}

### Rule

{One or more bullets stating the takeaway}

### Anti-pattern (optional)

` ` `python
# Code showing what NOT to do
` ` `

### Detection recipe (optional)

` ` `bash
# A grep or test snippet that catches the trap pre-commit
` ` `
```

---

## Library code never configures logging

Calling `logging.basicConfig()` or `logger.setLevel()` from
library code overwrites the consuming application's logging
configuration. Symptom: an app that ran fine before adding the
library suddenly prints DEBUG output everywhere, or stops
printing logs entirely.

### Rule

- Use `logging.getLogger(__name__)` and that is it.
- Never call `basicConfig`, `setLevel`, or add handlers in library code.
- Logging configuration is the application's responsibility.

---

## Custom cryptography is insecure even when it looks correct

A permutation-based encryption scheme, an XOR-with-a-rotating-key,
a "this should be hard to reverse" construction: all of these
are insecure on their own. Use established, audited primitives
from a vetted library (`cryptography`, Bouncy Castle on the
JVM). Use authenticated encryption (AEAD: AES-GCM,
ChaCha20-Poly1305) not plain ciphers. Use a proper KDF
(Argon2id, scrypt, PBKDF2 with high iteration counts) for
password-derived keys.

### Rule

- No project rolls its own crypto primitive.
- Key agreement: ECDH with ephemeral keys, not static.
- Authentication is non-negotiable; an unauthenticated
  ciphertext is malleable.

---

## Atomic commits are bounded by "green individually", not "one thing"

The "atomic commit" rule is "each commit is the smallest
reversible unit that leaves the tree green", not "each commit
does one conceptual thing". When splitting a change creates a
broken intermediate state - e.g. the source change deletes a
function the existing tests still import - the split is wrong.
Combine the pieces into one commit.

### Rule

- Conceptual split is a goal; green-individually is a hard
  constraint. When they conflict, the constraint wins.
- Concrete example: a refactor that renames an exported helper.
  The source edit and the test edit MUST land together;
  otherwise either the source commit fails because tests still
  import the old name, or the test commit fails because the new
  name does not exist yet.

---

## Commit ordering for breaking-change dependency upgrades

- Pin the version bump BEFORE migrating call sites when the new
  code uses imports that only exist in the new release.
  Backward-compatible exports in the new version keep the
  intermediate state green. Doing it the other way (migrate
  first, bump pin last) leaves the migration commit red against
  the still-installed old version and breaks the "each commit
  green individually" rule.
- Path-installed plugins do not auto-refresh when their
  `pyproject.toml` changes. After bumping a transitive
  dependency in a plugin, run `poetry lock` AND `poetry install`
  in the BACKEND directory too - the backend's `poetry.lock`
  caches the resolved deps of the plugin's old pin until you
  regenerate.

---

## CI vs local environment drift

Two patterns cause "passes locally, fails in CI" in
Poetry-managed projects:

1. `poetry install` does not remove dependencies that vanished
   from pyproject.toml. Stale `.dist-info` directories in
   long-tenured local venvs keep importing modules that the
   lockfile no longer references. CI starts fresh and
   immediately fails. Mitigation: run `poetry install --sync`
   periodically, especially before assuming "local green = CI
   green".

2. Path-dependency declarations in pyproject.toml must include
   every plugin or sub-package whose code is exercised by tests.
   Plugin discovery via `importlib.metadata.entry_points()` only
   sees what's actually installed, not what exists on disk. When
   creating a new plugin, the path-dep declaration in
   backend/pyproject.toml is mandatory, not optional.

Detection: if local tests pass but CI fails on routes returning
404, suspect missing path-deps before suspecting code bugs.

---

## Two installation paths diverge: `make test` vs per-plugin CI

Plugins are installed two different ways depending on context:

- **`make test` path:** the backend's combined `poetry.lock`
  resolves every plugin as a path-dep
  (`myapp-plugin-{name} = {path = "../plugins/...",
  develop = true}`). One `poetry install` from `backend/` brings
  every plugin's external deps in via the backend's lock.
- **CI plugin-matrix path:** `.github/workflows/ci.yml` runs
  `poetry install --no-interaction --no-ansi` **inside each
  plugin directory** against THAT plugin's own `poetry.lock`.
  The backend lock is irrelevant here.

When a shared external dep bumps in every pyproject, the
backend lock and the per-plugin locks drift independently.
If only the backend lock gets regenerated:

- `make test` is green (the backend lock satisfies all
  path-deps; the per-plugin locks are not consulted).
- CI is red (the per-plugin `poetry install --no-interaction`
  aborts with `pyproject.toml changed significantly since
  poetry.lock was last generated`).

### Rule

- After any shared-dep pin bump, run `make lock-all-plugins`
  (iterates plugins, runs `poetry lock` in each).
- The `plugin-lock-paired-with-pyproject` pre-commit hook
  catches the operational mistake at commit time.

---

## Single source of truth for version pins

Every duplicated version constant is a stale-pin bug waiting to
happen. Architecture goal (Java/Maven precedent): ONE version
per subsystem in a canonical packaging file; everything else
derives.

**Canonical sources (hand-edited at release):**
- `backend/pyproject.toml` for the Python subsystem
- `frontend/package.json` for the JS subsystem
- Each `plugins/<name>/pyproject.toml` for its own plugin
  (plugins have independent versions)

**Derivation patterns by language and runtime:**

| Subsystem | Pattern | Why |
|-----------|---------|-----|
| Python (publishable distribution) | `importlib.metadata.version("<dist-name>")` with `PackageNotFoundError` fallback | Standard. Reads packaging metadata; cannot drift. |
| Python (`package-mode = false`, e.g. backend app) | `tomllib.load(open("pyproject.toml", "rb"))["tool"]["poetry"]["version"]` | importlib.metadata is unavailable when Poetry does not register a distribution. tomllib is stdlib in 3.11+. |
| Bash installer (chicken-and-egg before clone) | Generate the script at release time from a template; substitute placeholder from canonical pyproject. Commit the generated artifact. | Runtime parse impossible because pyproject does not exist when curl-pipe runs. |
| Frozen binary (PyInstaller) | Build-time injection: spec script writes a generated `_build_info.py`, gitignored, that the binary embeds. Dev fallback reads pyproject directly. | importlib.metadata is unreliable inside PyInstaller's frozen tree. |
| Frontend (Vite) | `define` block reads package.json at build, exposes `__APP_VERSION__` literal. TypeScript declares `declare const __APP_VERSION__: string;` in `vite-env.d.ts`. | Build-time literal substitution. |

**Always include a fallback sentinel** (e.g. `"0.0.0+unknown"`
with a `logger.warning`) when the derivation can fail at runtime
(file missing, distribution not registered).

**Always include regression detectors** in
`verify_version_pins.sh`: grep patterns that fail the check if a
hardcoded literal reappears in the "DO NOT EDIT" tier.

**Never** add a hardcoded version constant "for convenience".
Always reference the derived single source.

---

## Subsystem lock-step + tooling, not checklists

Per-subsystem SSoT is the first half. The second half is
**lock-step propagation by tooling, not by human attention**.
A 7-row checklist that says "edit every file" fails every time
someone forgets a row.

- **One canonical version per language subsystem**
  (backend/pyproject.toml, frontend/package.json).
  Hand-edited at release time.
- **`make sync-versions`** propagates the canonical to every
  other version-bearing field: launcher pyproject + spec plist +
  `__init__.py` literal, all plugin pyprojects, frontend
  package.json (when needed), `install.sh` regen via the
  existing template helper. The tool is the only thing that
  touches those files.
- **`make sync-versions-check`** + `verify_version_pins.sh`
  enforce lock-step in a tight loop.
- **CI gate** (`.github/workflows/release-gate.yml` on
  tag-push). Artifact attachment is blocked on drift.

Rules:

- **Do not hand-edit any version field except
  `backend/pyproject.toml`.** Run `make sync-versions` and let
  the diff speak.
- **Each release commit's diff for non-canonical version fields
  must be reproducible by re-running `make sync-versions` from a
  clean checkout.**
- **A new subsystem with its own version field**: add it to
  `scripts/sync_versions.py`'s `collect_targets()` AND the
  regression detector in `verify_version_pins.sh` AND the CI
  gate. Three artifacts per new pin; never one or two.
- **The `--check` mode of every sync/verify script must be
  idempotent**: running it twice in a row produces the same
  answer, never writes, never depends on environment state
  beyond the repo.

---

## Filesystem isolation: production data lives outside the project tree

Production app data NEVER lives in the project tree. All paths
resolve via `app.paths` helpers (`get_data_dir`,
`get_config_dir`, `get_cache_dir`, `get_upload_dir`,
`get_db_path`) which use platformdirs (XDG-conformant) by
default and respect a `MYAPP_DATA_DIR` (etc.) env-var override.
Resolution is **always** via fresh function calls, never via
frozen module-level imports.

Default locations:

- Linux/macOS: `~/.local/share/myapp/`
- Windows: `%LOCALAPPDATA%\myapp\`
- Tests: a `tmp_path_factory`-managed dir, set by
  `backend/tests/conftest.py` before any `app.*` import
- Docker: `/app/data/` via `MYAPP_DATA_DIR=/app/data` in
  compose, mounted as the named `myapp-data` volume

Three layers of protection prevent test runs from touching
production data:

1. **Production marker file**. Production directories contain a
   `.myapp-production` marker (written by the FastAPI lifespan
   via `app.paths.mark_data_dir_as_production`). If tests ever
   see one, the entire run aborts with
   `pytest.exit(returncode=2)`.
2. **Test conftest sets `MYAPP_DATA_DIR`** to a tmp dir before
   any `app.*` import. The autouse session fixture also asserts
   the resolved path looks like a tmp location.
3. **All path access via helpers**, never via CWD-relative
   `Path("foo")` and never via frozen module-level imports.

**Forbidden patterns:**

- `UPLOAD_DIR = Path("uploads")` at module top level
- `from app.routers.assets import UPLOAD_DIR` (frozen import)
- `Path("data") / "X"` anywhere in production code

**Required pattern:**

- `upload_dir = get_upload_dir()` inside the function that uses it.

If `make test` aborts with exit code 2, check what path was
mounted via `MYAPP_DATA_DIR`. NEVER delete the marker just to
make the test pass; investigate why a test pointed at production.

Rule: when adding a new persistent path under `get_data_dir()`,
also add it to any migration helpers if a previous version of
the app could have written to a different location. Otherwise
users lose data on the next upgrade.

---

## Test-isolation discipline: never run integration smoke-tests outside pytest

The harness ships three protective layers against test runs
hitting production data:

1. `MYAPP_TEST=1` env-var, set by `backend/tests/conftest.py`
   BEFORE any `app.*` import.
2. `TEST_DATABASE_URL=sqlite:///:memory:` env-var, set in the
   same place.
3. `.myapp-production` marker file in real data dirs, plus a
   session-scoped autouse tripwire that aborts the pytest run
   with `returncode=2` if it ever sees the marker.

**All three only fire under pytest.** A free-standing
`poetry run python -c "from app.main import app; ..."` script
bypasses every one of them - conftest never executes for
direct-Python invocations, so the FastAPI app points at the
real production DB.

### Rule

For any integration smoke-test against FastAPI `TestClient`
or any code path that imports `app.main` / `app.database` /
`app.routers.*`:

- **Default**: write the smoke-test as a one-off pytest file
  under `backend/tests/`. Conftest fixtures fire automatically.
- **Acceptable shortcut for trivial probes**: prefix the
  command with the env-vars manually:
  ```bash
  MYAPP_TEST=1 TEST_DATABASE_URL=sqlite:///:memory: \
    poetry run python -c "..."
  ```
- **NEVER**: bare `poetry run python -c "from app.main
  import app; ..."`.

---

## Module-level caches survive test boundaries

Filesystem and DB test isolation is well-documented (the
`MYAPP_TEST=1` + `MYAPP_DATA_DIR` chain plus the production
marker tripwire). But **in-memory caches in service modules
have no equivalent guard**, and they survive ALL test boundaries
inside a single pytest process.

### Rule

Any service module that uses module-level mutable state visible
to multiple tests needs a teardown hook in the fixtures that
touch it. Concretely:

- `@functools.lru_cache` decorators → tests that monkeypatch the
  underlying read must `cache_clear()` in BOTH the setup AND the
  teardown of every fixture/test that touches them. The
  `yield`-based autouse fixture pattern is the simplest shape:
  ```python
  @pytest.fixture(autouse=True)
  def _clear_module_cache():
      module.cached_function.cache_clear()
      yield
      module.cached_function.cache_clear()
  ```
- Module-level globals (singletons, registries, dicts assigned
  at import time) → same shape, reset state in both directions.
- Class-level state on a service singleton → same.

### Anti-pattern

Setup-only cache clears (`return None` instead of `yield`) look
correct in isolation - the test file's own tests pass green -
but pytest runs all collected tests in one process. The cache
written by the LAST test in your file is what subsequent test
files see. The bug is invisible inside the file's own boundary,
which is exactly why CI catches it and local single-file runs
do not.

### Detection heuristic

When adding a new test file that fakes out a service module's
inputs, grep that service module for:
```
grep -E '@(lru_|.*_)cache|_cache *=|^[A-Z_]+ *= *' \
  backend/app/services/<module>.py
```

---

## Async in the FastAPI lifespan

- Inside the `async def lifespan(app)` handler the uvicorn event
  loop is already running. `asyncio.new_event_loop()` +
  `loop.run_until_complete(...)` is forbidden there and crashes
  with "Cannot run the event loop while another loop is running".
- When a helper needs to run a coroutine during startup: make
  the function `async` and `await` it in the lifespan, do NOT
  build your own loop.
- Symptoms when done wrong: `RuntimeWarning: coroutine '...' was
  never awaited` plus the loop conflict ERROR in the startup log.
- Other callers of the same function (CLI targets, sync FastAPI
  endpoints) have to follow along: `asyncio.run(...)` in the
  CLI, `async def` + `await` in endpoints.

---

## Alembic `fileConfig` silences every existing logger

`migrations/env.py` is generated from Alembic's template, which
calls `fileConfig(config.config_file_name)` unconditionally.
Two side effects burn time on the day your INFO logs stop
appearing:

1. **`disable_existing_loggers=True` is the default.** Every
   `logging.Logger` created BEFORE `init_db()` is disabled.
   Subsequent `logger.info(...)` calls drop to the floor.
2. **The root logger level is reset** to whatever
   `[logger_root] level = ...` says in `alembic.ini` (often
   `WARNING`). Fresh loggers created after the call inherit the
   lower level.

**Fix**: in `migrations/env.py`, gate the `fileConfig` call so
it only fires when the FastAPI app has not already configured
logging:

```python
import logging
from logging.config import fileConfig
...
if config.config_file_name is not None and not logging.getLogger().handlers:
    fileConfig(config.config_file_name, disable_existing_loggers=False)
```

The standalone `alembic` CLI invokes env.py before any handler
is attached (`logging.getLogger().handlers` is empty), so the
guard preserves the documented CLI behaviour. Embedded use
through `init_db()` runs under the FastAPI/uvicorn handler stack
and skips the call.

**Generalises to**: any library that ships an env.py-style hook
calling `fileConfig`/`dictConfig` at import time. Wrap the call
in a "have handlers already?" check whenever the same module is
imported in two contexts (CLI vs. embedded).

---

## Alembic migration + fresh test DB

- For every new Alembic migration that touches a core table via
  `ALTER TABLE`: the on-disk `backend/myapp.db` MUST be deleted
  before the next `make test`. Otherwise you get
  `sqlite3.OperationalError: duplicate column name: ...`.
- Reason: `backend/tests/conftest.py` calls
  `Base.metadata.create_all(engine)` before every test and
  creates the tables with the NEW schema. At the same time the
  on-disk DB still has `alembic_version` pinned to the old
  revision. `TestClient(app)` triggers the lifespan
  `init_db()`, which runs `upgrade head` when tables +
  `alembic_version` both exist - which tries to add the new
  column via ALTER TABLE a second time and crashes.

---

## Plugin settings YAML lives in `backend/config/plugins/`, not in the plugin's own directory

PluginForge reads each plugin's settings from the backend-wide
`config_dir`, configured in `app.yaml` as
`plugins.config_dir: config/plugins`. So the canonical path for
a plugin's settings file is:

```
backend/config/plugins/{plugin_slug}.yaml
```

NOT `plugins/myapp-plugin-{slug}/config/{slug}.yaml`. The latter
is fine for shipping the file inside the plugin's distributable
ZIP, but at runtime PluginForge looks ONLY in the backend's
config_dir.

**Symptom**: the plugin loads and activates, but
`self._settings = self.config.get("settings", {})` returns an
empty dict. User-visible settings silently fall back to in-code
defaults; the YAML you wrote is never read.

**Mitigation**: when scaffolding a new plugin, drop the settings
YAML directly into `backend/config/plugins/`. Mirror it inside
the plugin's own `config/` only if the plugin's ZIP target
needs it.

---

## Plugin settings: visible or INTERNAL, never hidden

Plugin settings are either UI-visible (user-relevant) or marked
`# INTERNAL` (YAML-only). Hidden active settings that influence
user behavior are a bug, because the user has no way to change
the behavior without a YAML editor and repo access.

Dead settings (in the YAML but not read by the code) are just
as bad: they are a lie to the user. When refactoring a plugin,
always check whether old YAML fields are still consumed before
leaving them in place.

Generic plugin settings panel on the frontend: renders booleans
as a checkbox, numbers as a number input, strings as a text
input, arrays as an OrderedListEditor, objects as a JSON
textarea with an "Advanced" hint. Rendering a boolean as a text
input (`value="true"`) is a UX bug because the user cannot tell
it is a switch.

Configuration values that vary between rows of a domain entity
MUST live on the model, NOT in the plugin YAML. Plugin YAML is
plugin-global and applies to all rows at once - anyone who
needs per-row granularity adds a column.

---

## End-to-end behavior tests are not "kwarg passes through" tests

When a setting is added that flows from a YAML through the
plugin into a service call, smoke tests like
`assert plugin._settings["x"] == True` confirm the dict landed
but say NOTHING about whether the setting actually propagates
through every layer to the production behaviour.

The hard rule: every settings flag MUST have at least one test
that flips the flag to a non-default value and asserts an
OBSERVABLE behavioral difference at the output, not at an
intermediate layer.

The pattern that fails silently:

```python
# WRONG: this passes whether or not the setting reaches the importer
def test_setting_propagates():
    plugin = make_plugin({"settings": {"x": True}})
    plugin.activate()
    assert plugin._settings["x"] is True
```

The pattern that works:

```python
# RIGHT: this fails if the setting does not reach the importer
def test_setting_x_propagates_to_persisted_row(client, db):
    body = _post_with_settings(client, payload, {"x": True})
    row = db.query(Row).filter(Row.id == body["id"]).one()
    assert row.affected_field == EXPECTED_VALUE_WHEN_X_IS_TRUE
```

The behavior test reaches through every layer the production
request reaches through (HTTP endpoint → plugin config
injection → service code → DB) and asserts at the OUTPUT.
Smoke tests of intermediate layers are fine to add for
diagnostic granularity, but they are NOT a substitute for at
least one end-to-end behavior test per setting.

This rule generalizes beyond settings:

- Feature flag → at least one test flips the flag and asserts
  observable change in the produced artifact.
- New endpoint kwarg → at least one test passes a non-default
  value and asserts the behavior the kwarg controls.
- Plugin config → at least one test sets the value and asserts
  the consumer of that value behaves differently.

---

## Walker iterating repeated containers: prefer `find_all` over `find`

When a parser walks a structured document (HTML, XML, JSON,
etc.) and uses a "find first matching child" call, but the
parent can have MULTIPLE matching children, the walker silently
drops everything past the first. The bug is invisible because
the test fixtures happen to put the meaningful content in the
first match.

### Rule

- Whenever a container can repeat under the same parent (CSS
  class match, attribute selector, etc.), use `find_all` and
  iterate. Use `find` only when you have a structural guarantee
  that there is ONE - element with a unique id, root element,
  etc.
- Tests for repeated-container walks must include at least one
  fixture where a non-first occurrence carries the bulk of the
  content. The "all fixtures pass overall ratio check" smoke is
  not enough; the multi-occurrence-with-content-distributed-late
  shape is its own structural class.
- When patching a `find` to `find_all`, immediately check the
  broader corpus (ideally a real production sample) for cases
  where the old code silently lost data.

This generalizes beyond CSS-class lookups. The same shape -
"we got the first match and assumed there was one" - appears
in: regex `re.search` vs `re.findall`, SQLAlchemy
`query.first()` vs `query.all()`, dict-from-list-of-pairs
comprehensions that silently dedup keys.

---

## User impression of scope is anchored on what they noticed, not what's broken

When a user reports a bug with quantitative scope ("a few",
"most", "sometimes"), treat the count as a starting hint, not
authority. Run a systematic survey (DB query, corpus sample,
log scrape) BEFORE scoping the fix. The actual scope can easily
be 10x what the user noticed.

When a user reports MECHANISM ("X is detected as Y"), trust the
SYMPTOM but verify the mechanism in code. Users are reliable
observers of "it does not work as I expected"; their inferences
about WHY are often shaped by hopeful priors ("surely there's
some detection somewhere"). Read the code path before acting on
the inference.

The pre-inspection report must include the survey results when
the user's report was quantitative. "User said few; survey
shows N=X" is a separate bullet, not a parenthetical. The
discrepancy itself is information.

---

## Real-world data audit BEFORE implementation prevents spec-vs-reality drift

When a feature ships with a heuristic, a detection rule, a
threshold, or any other prediction about data shape, run the
prediction against real data in pre-inspection. Report counts +
sample cases. Treat the spec as the starting hypothesis, not
the final design.

- **Specs that predict a data shape are predictions, not
  contracts.** A heuristic that looks principled on paper can
  silently miss the cases that matter once you point it at real
  data.
- **Run the audit against actual data BEFORE writing code,
  not after.** "After" means the code is committed, possibly
  shipped, and the regression is harder to undo than to prevent.
- **The audit input doesn't have to be production data.** Raw
  source bytes (the exported file, the upstream API response,
  the corpus sample) are often cleaner than parsed-and-imported
  rows - the audit isolates the heuristic from importer drift.
- **Surfacing the audit in the pre-inspection report** is what
  makes the decision visible. Without the report saying "X
  cases under the spec, Y cases with criterion Z dropped", the
  spec would be confirmed unchanged.

---

## Schema "preserved" / "always set" claims must survive real-data audit before becoming spec

When a schema field's actual production value is always-NULL /
always-empty / always-zero for the only use case that exists,
the docstring must say so explicitly. Pretending the field is
populated leaks the schema's forward-compatibility ambition
into the user's expectations.

### Rule

- When a schema field exists in the model but no current
  importer / writer populates it, the docstring must say
  "reserved for future importers; currently always NULL" - not
  "preserved for X" which implies data is there.
- Help-doc prose that names a field MUST be cross-checked
  against the importer / writer code that populates it. A
  30-second grep for the field name catches the drift.
- When a pre-inspection audit produces a "source doesn't carry
  X" finding, every doc surface that mentions X in the resulting
  code should explicitly reference the audit finding. The audit
  is the spec.

---

## Operational gaps masquerade as wired infrastructure

A workflow / hook / cron / scheduled job that was committed
without being executed end-to-end is a hypothesis, not a
feature. Audits should validate that wired infrastructure
actually runs to completion, not just that the YAML / config
exists.

### Rule

- **"Wired" ≠ "working".** When wiring a new CI workflow,
  schedule it, or otherwise add infrastructure that runs on a
  delayed trigger (nightly cron, on-tag, on-paths-only, gated
  by repo variable), trigger it manually at least once in the
  same session, download the artifact, and confirm the result
  is what you intended.
- Document the first run's outcome in the PR description or the
  related audit doc.
- A workflow that ships without a known-good first run is
  technical debt masquerading as feature delivery.

---

## Audit findings need production-vs-dev environment classification before urgency-tier

When a finding is "X crashes with PermissionError in Docker",
the audit MUST distinguish which Docker setup (dev with bind
mount vs prod with named volume) before assigning urgency. The
same code path can be fatal in one and harmless in the other.
Audit reports that omit the environment distinction will lead
to either over- or under-urgent triage.

Verification command for any future audit that suspects a
Docker write-path failure:

```bash
docker exec <prod-container> sh -c \
    "ls -la /app/<the-path-under-suspicion> && \
     touch /app/<dir>/probe-write && rm /app/<dir>/probe-write && \
     echo WRITABLE || echo READONLY"
```

This separates "broken in dev only" from "broken in prod also"
before scope-setting any fix.

---

## User-perceived bug ≠ code bug: the perception-lag class

A user reports "feature X doesn't work" or "X is broken" plus
cites a console message or symptom as evidence. The diagnostic
chain that follows often surfaces multiple non-bugs before
reaching the real cause:

1. **Surface symptom** the user actually noticed (visual lag,
   missing feedback, console warning).
2. **Diagnostic gut-read** (often workbox messages, network
   404s, etc.) that look causal but are not.
3. **Actual cause** which is usually a UX-quality issue, not a
   functional break.

### Rule

**Before patching a code bug, verify the bug is in the code
layer the user thinks it is.** Specifically:

1. **Check the Network tab + backend state FIRST.** If the
   action's backend artifact exists (row updated, file created,
   etc.), the user's symptom is at a different layer.
2. **Console messages are diagnostic clues, not bug citations.**
   Workbox passthrough logs, React StrictMode warnings, and
   browser violation reports often accompany correct behavior.
   Verify the cited message is causal, not coincidental.
3. **Re-frame "doesn't work" as "what did the user actually
   observe?"** vs "what diagnostic message did the user
   notice?". The two often diverge.

Perception-lag bugs ARE real UX bugs - they degrade users'
trust even when the code is correct. But they belong in a
different backlog tier than functional regressions: IMPROVEMENT
(UX performance), not BLOCKER.

---

## Multi-tool collaboration tracking: re-sync before accepting new orders

When an external agent (e.g. a separate planning session) loses
sight of git state, the executor agent (Claude Code working in
the repo) MUST explicitly re-sync before accepting new orders.
Status corrections mid-session prevent compound stale-state
from creating phantom work.

### Rule

Before starting any non-trivial session (especially one whose
plan was written by a different agent / a different session):

1. **`git log --oneline -<N>`** where N covers the time gap
   since the plan was written. Look for commit messages that
   match the planned work items.
2. **`grep -rln '<feature name>'`** for each pending item. A
   recent match in production code (not just tests/docs)
   suggests the work shipped.
3. **Reconcile**: if items appear shipped, report back to the
   planner with the commit hash + verification artifact (test
   pass count, audit-doc reference, etc.) BEFORE starting any
   re-implementation work.

### How to surface a status correction

Do not quietly skip items the planner thought were pending -
explicit "STOP - status correction" with a table of:
- What the plan called pending
- Commit hash where it actually shipped
- Verification artifact (test count, audit-doc reference)

---

## Workbox "No route found" is benign info, not a bug indicator

Service-worker (Workbox) runtime-cache configurations register
URL patterns for specific HTTP methods. Requests that fall
outside those patterns (e.g. non-GET API calls when the rule is
GET-only) trigger a console message like
`No route found for: <url>`. **This is informational** - it
means "no runtime-cache rule applied, falling through to
default fetch", which is the intended pass-through behavior.

### What an actual SW block looks like

If Workbox were genuinely blocking a request, you'd see:

- The request NEVER appearing in the Network tab.
- A console error like `Failed to fetch` from the application
  code that initiated the request.
- The application code's `.catch()` branch firing.

You would NOT see a successful 2xx response in the Network tab
AND a "No route found" workbox info line - those two together
prove the request DID reach the network and DID succeed.

### Rule

When triaging a "feature broken" report that includes a workbox
console message:

- Don't accept the workbox log as bug-causal evidence without
  the corroborating Network-tab + backend-state check.
- Re-frame the symptom: ask "what did the user actually
  observe?" vs "what diagnostic message did the user notice?".

---

## React useEffect deps + i18n test mocks: the `t` function isn't stable

Symptom: a component's fetch-on-open effect kept failing in
tests because the `setError` call in the rejection branch never
landed. Looked like a race condition but wasn't. The effect's
dep array included the i18n `t` helper:

```typescript
useEffect(() => {
    let cancelled = false
    api.something.fetch(...)
        .then(...)
        .catch((err) => {
            if (cancelled) return
            setError(...)
        })
    return () => { cancelled = true }
}, [open, kind, ids, t])  // <-- t here
```

In production the i18n provider memoises `t` so the dep is
stable. In the test setup, the i18n mock returns a fresh `t`
function on every render:

```typescript
vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k, fallback) => fallback, ...}),
}))
```

Result: every parent re-render produces a new `t`, so the
effect cancels its prior run and refetches. The rejection from
the previous run lands while the new run's `cancelled` closure
is still false, BUT the previous run set `cancelled=true` in
its own closure. The catch sees `if (cancelled) return` and
bails out before `setError` fires.

### Rule

Fix: omit `t` from the dep array when the request shape does
not actually depend on it. The right fix is NOT to memoise the
mock's `t` per-render (that defeats the point of mocks). The
right fix is to scope the effect's deps to what genuinely
affects the request.

Generalises to any hook function the i18n mock returns fresh
per render (`useDialog`, `useNavigate` with state-capturing
callbacks, etc.).

---

## React 18 dev-mode double-effect-mount strands `mockImplementationOnce`

React 18 in development mode (Strict Mode or its testing-library
equivalent) deliberately mounts components twice and runs
effects twice to surface non-idempotent setup. Combined with
happy-dom + Vitest, the result is that a `useEffect` calling
an API mock fires twice on the first render.

If the test sets `mockImplementationOnce(returnValue)` per
test, the FIRST useEffect call consumes the implementation and
the SECOND call falls through to the default `vi.fn()` (which
returns `undefined`) - the component then sees the default
empty state and the test fails on a stale assertion.

### Rule

- **Use `mockImplementation(...)` (no `Once`).** The
  implementation persists across both effect mounts. Per-test
  `afterEach { mock.mockClear() }` (NOT `mockReset`) keeps the
  implementation alive across test boundaries while still
  resetting call history.
- **Set a default implementation in the `vi.mock` factory
  itself**, e.g.
  `getThing: vi.fn(async () => ({ settings: {} }))`. Tests that
  do not care about the response can rely on the default; tests
  that do override per-test via `mockImplementation`.

The `mockClear` vs `mockReset` distinction matters specifically
because of the factory-default pattern: `mockReset` strips the
factory's implementation and the next test starts with a
vanilla `vi.fn()` returning undefined, which crashes the next
render's `useEffect` chain.

---

## XHR mocks need a function constructor, not an arrow

`vi.stubGlobal("XMLHttpRequest", vi.fn(() => fakeXhr))` fails
at runtime with `TypeError: () => fakeXhr is not a
constructor`. Arrow functions cannot be invoked with `new`.

The simple fix: stub with a regular function expression, which
JS allows as a constructor:

```typescript
vi.stubGlobal("XMLHttpRequest", function () { return fakeXhr; })
```

The `return` of an explicit object from a constructor-called
function replaces the implicit `this` instance, which is
exactly what we want here - the test's pre-built `fakeXhr`
object becomes the result of `new XMLHttpRequest()`.

Generalizes to any global that callers invoke with `new`
(`WebSocket`, `Worker`, etc.). Stubbing such globals with arrow
functions silently breaks; stubbing with a regular function or
a class works.

---

## Prefix testid selectors match every nested testid that shares the prefix

A selector like `[data-testid^='entity-card-']` cleanly matches
each card root AND every nested child testid that shares the
prefix (`entity-card-menu-{id}`, `entity-card-menu-delete-{id}`).
`toHaveCount(N)` returns `2N` or more per visible card.

### Rule

- Fix: `[data-testid^='entity-card-']:not([data-testid*='-menu-'])`,
  or give the root a distinct testid like
  `entity-card-root-{id}`.
- Same shape as the `[class^=""]` overmatch antipattern.
- Always test a prefix selector against the full rendered
  surface before shipping.

---

## Testid namespace pinning prevents silent E2E skips

When the same conceptual element has different testids in
different view modes (e.g. `entity-card-{id}` in grid view vs
`entity-list-row-{id}` in list view), an E2E spec written for
one view-mode resolves all its testids cleanly when the fixture
happens to persist the same view-mode, and silently finds
nothing - passing on a no-op - when a different view-mode
persists.

### Rule

For any non-trivial UI component that an E2E spec will drive
(wizards, multi-step forms, dialogs with multiple slots, bulk-
action bars, settings tabs):

1. **Choose a single namespace string at component creation
   time.** A 2-3 dot-prefix or hyphen-prefix that uniquely
   identifies the component family is enough.
2. **Every interactive surface gets a testid in that
   namespace.** No exceptions for "the button is obvious".
3. **List every testid in the component's header comment**
   or in a sibling `*.testids.md` file. The list is the
   contract.
4. **The E2E spec exercises every testid in the namespace at
   least once positively.** "Positively" means
   `await expect(page.getByTestId(...)).toBeVisible()` - not a
   negative assertion like `not.toBeNull()`.
5. **When the namespace evolves, the spec's positive coverage
   walk is the safety net.**

### Anti-patterns

- **No namespace at all** - ad-hoc testids like `submit-btn`,
  `confirm`, `ok`. Two sibling components collide.
- **Namespace drifts across view-modes / branches** - same
  visual concept, different testid in card vs list view, in
  draft vs published state, in mobile vs desktop layout.
- **Specs that only assert negatively** -
  `await page.getByTestId(...).not.toBeNull()` passes when the
  element does not exist at all. Use `toBeVisible` instead.

---

## Menu-Dialog Lifecycle: do not `preventDefault` inside `onSelect`

Radix `DropdownMenu.Item` auto-closes the surrounding menu on
item-select by default - that's the desired UX. Calling
`e.preventDefault()` inside the `onSelect` handler suppresses
the close. If the handler then opens a dialog, the dialog
floats above a still-visible menu - overlapping UI, confused
focus management, and a violation of the "one modal surface at
a time" UX contract.

### Rule

A `DropdownMenu.Item`'s `onSelect` MUST NOT call
`e.preventDefault()` when the handler triggers a dialog. The
default close-on-select is what you want. Let Radix close the
menu; THEN the dialog mounts against a clean stage.

```tsx
// RIGHT
<DropdownMenu.Item onSelect={() => onDeletePermanent()}>
    Delete permanently
</DropdownMenu.Item>

// WRONG - menu lingers around the dialog
<DropdownMenu.Item onSelect={(e) => {
    e.preventDefault();
    onDeletePermanent();
}}>
    Delete permanently
</DropdownMenu.Item>
```

### Detection recipe

```bash
grep -rnE 'onSelect.*e\.preventDefault|onSelect=\{?\(e\)' \
  frontend/src/components/ frontend/src/pages/ \
  --include='*.tsx' --include='*.ts'
```

---

## Radix DropdownMenu + happy-dom is brittle for Vitest

Radix DropdownMenu (`@radix-ui/react-dropdown-menu`) renders
its menu content through a portal and uses pointer events plus
focus-scope state for the open transition. happy-dom's portal +
focus-scope simulation is incomplete, so a Vitest that mounts a
component using DropdownMenu can:

- Render the trigger button correctly (works).
- Open the menu on `fireEvent.click(trigger)` - intermittent.
  Sometimes the menu content never lands in the DOM; sometimes
  it lands but `findByTestId` for an item inside
  `<DropdownMenu.Portal>` returns nothing.
- Throw `setState during render` from
  `@radix-ui/react-focus-scope` when both `fireEvent.pointerDown`
  + `fireEvent.click` fire in rapid succession.

### Rule

1. **Test the trigger button's existence** via `findByTestId`
   on the trigger. Reliable.
2. **Do NOT attempt to assert on the menu content** via
   `findByTestId` inside `<DropdownMenu.Portal>`. Defer that
   assertion to an E2E spec in a real browser.
3. **Test the action handler in isolation** when the handler is
   non-trivial - pass the handler in by prop or extract it from
   the component so the unit test can invoke it directly.

---

## Split-button (default + chevron disclosure) for primary + alternative outputs

When a feature has two outputs where one is the obvious
90%-case default and the other is a discrete alternative, use a
split-button: a primary action button glued to a chevron
disclosure that exposes the alternative.

Anti-patterns this avoids:

- **Two equal-weight buttons**: forces the user to make a
  format decision in technical jargon every time, even when
  they know they want the default. Doubles the toolbar
  footprint.
- **A modal "options" dialog**: extra round-trip for the
  90%-case; users have to read + click to confirm what they
  already wanted.
- **Right-click context menu only**: invisible to anyone who
  does not know to right-click.

Implementation pattern:

- Primary button + chevron use the same Radix DropdownMenu
  trigger.
- The dropdown menu has the primary action first (so a user who
  opens the menu by mistake does not have to re-orient) plus
  the alternative below it.
- The primary button's default click bypasses the menu entirely
  - one click, no flicker.
- Tooltip on the chevron explains it expands the action set.

When NOT to use a split-button:

- Three or more alternatives at roughly equal weight: use a
  full menu, not a split.
- The alternatives have no clear primary: use a regular
  dropdown.
- The action is destructive: a split-button can fire the
  primary by accident. Use a confirm dialog instead.

---

## Destructive row-actions must reconcile collection state

When a row-action (delete, archive, move-to-trash) modifies an
item that may be a member of a multi-select collection state,
the post-action handler MUST reconcile the collection so its
consumers (bulk-action bar, counters, batch-operation forms)
never reference an orphan id that no longer corresponds to a
visible row.

### Rule

Every single-item destructive handler that fires from a list
view backed by a selection hook MUST call the hook's
`remove(id)` (or equivalent idempotent delete) after the API
call succeeds, BEFORE the success notification. The order
matters: reconcile state first, notify second.

```typescript
async function handleDelete(item: Item) {
  try {
    await api.items.delete(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    selection.remove(item.id);  // <-- reconcile BEFORE notify
    notify.success(...);
  } catch (err) { ... }
}
```

### Hook contract

Selection hooks should expose a dedicated `remove(id)` method
that is idempotent (no-op when the id is absent), not just
`toggle(id)` with a guard at the callsite. `toggle` flips state
- calling it on an unselected id ADDS the id, which is the
opposite of what destructive handlers want.

### Other affected operations

Same shape applies to:

- Bulk operations on the SAME page that internally use
  single-item APIs in a loop (each successful delete must
  remove that id from selection so a partial failure leaves a
  clean post-state).
- Cross-tab updates received via WebSocket / SSE / polling.
- Filter changes that hide rows.

---

## Every bug-fix commit ships its regression-pin test

For every bug fixed, the following test coverage is MANDATORY,
not optional:

1. **Regression-pin unit test** at the layer the bug lived in
   (Vitest for frontend, pytest for backend). Asserts the bug's
   specific behaviour is correct. Named to reference the bug. A
   one-line comment in the test references the discovery
   context.
2. **Integration test if the fix crosses layers.** Frontend
   handler + API client + backend endpoint all exercised; state
   changes verified end-to-end.
3. **E2E Playwright test if the bug was user-facing
   smoke-discovered.** Replicates the exact user flow that
   surfaced the bug.
4. **Cross-surface tests if the bug-class might exist
   elsewhere.** For a bug on one surface, verify the parallel
   surface doesn't have the same shape.

### Stop-condition

If a fix is shipped without the corresponding tests, that is a
**stop condition**: add the tests before closing the commit
(or in an immediately-following commit if the original is
already pushed). Tests do not ride in a follow-up "later"
backlog item - they ride with the fix.

---

## New-hook + new-mock-key contract drift in EXISTING test files

When a feature introduces a new hook (or new API client method,
or new behavior that depends on a mocked API), the new hook's
data contract is fresh - but the EXISTING test files that mock
that API are not automatically aware of it. If the existing
mocks return a response shape that does not include the new
key/field the new hook reads, the hook silently falls back to
its hardcoded default and consumer tests in those existing
files assert against the wrong state.

### Rule

When introducing a new hook or new API consumer that reads from
a key of an already-mocked API response, do BOTH of these in
the same commit:

1. **Grep every test file that mocks the same API** and verify
   the mock's return value includes the new key. Recipe:
   ```bash
   grep -rn 'vi\.mock.*api/client\|getApp:\s*vi\.fn' \
     frontend/src --include='*.test.ts*' \
     --include='*.test.tsx'
   ```
2. **Run the FULL `make test` before commit-time green-claim**,
   not just the targeted file you just wrote. A new hook
   transitively touches every file whose consumers render it;
   targeted-only verification misses cross-file failures.

---

## Three-workflows-share-one-format pattern

When a feature has multiple "modes" that share an underlying
data contract, ship ONE UI component and let the backend /
config / file-format layer pick the mode. Branching the UI by
workflow ("if workflow A then show button X else button Y")
produces:

- N x the surface area to test
- N x the i18n strings
- N x the chance for the UI and the backend to drift

A feature whose semantics travel WITH the data artifact can run
anywhere - paid cloud APIs, free-tier playgrounds, local
laptops, chat sessions, even hand-edits by a human author. A
feature that depends on runtime-injected system prompts can
only run inside the application's call path.

Generalises to: file formats that consumers might want to
process outside the originating app. If the file carries its
own "what this is + how to fill it" preamble, downstream tools
(AI assistants, scripts, manual editors) work without
out-of-band documentation. Pure data with no embedded
instructions forces every consumer to know the schema, which
is a coordination cost the schema-owner pays forever in
documentation churn.

---

## SSE-in-context-not-in-modal

When a long-running async job streams progress events via SSE
to the UI, the EventSource lifecycle (open / onmessage / close)
must live in a Context provider, NOT inside the modal that
shows the progress. Otherwise:

- Minimising the modal kills the listener.
- Re-renders rebuild the listener and drop events.
- The user loses the job state when they navigate away.

### Rule

Pattern:

- Context provider holds the `EventSource` ref in `useRef`.
- `start(jobId)` opens the stream + persists `{jobId, ...}`
  to localStorage.
- `useEffect` on mount checks localStorage and reconnects if a
  job is mid-flight (F5 recovery).
- Stream-end clears persistence.
- Dock badge + expanded modal are pure consumers; minimising
  the modal doesn't disturb the SSE listener.

The cost is one global Context per long-running job type. The
benefit is that the user can navigate freely while the job
runs, the badge persists across route changes, and reloading
the browser doesn't drop the connection.

---

## Half-wired lifecycle: shipping half a feature is purgatory, not a feature

When a feature ships the "do" half (move-to-trash, save-draft,
schedule, archive) but NOT the "see + reverse + finalize" half
(/trash/list + restore + permanent-delete; /drafts list;
/scheduled list; /archive list), the user experiences silent
purgatory: their data still exists but they cannot find it,
restore it, or finally finish acting on it. The feature was
**half-shipped**; the partial implementation actively destroys
trust because the verb implies the full lifecycle.

### Rule

When a feature ships any half of a lifecycle (soft-delete
without restore-surface, "save draft" without "see drafts",
"schedule" without "see scheduled", "archive" without "see
archive"), the deferred half MUST be filed as a load-bearing
backlog item with an explicit blocker relationship to the
shipping half:

1. Open a P-tier backlog entry (NOT just a docstring TODO) with
   ID + scope + trigger.
2. Cross-reference in the docstring of the shipping half - so
   anyone reading the code sees the backlog reference, not just
   the prose "v2 will do it".
3. Set the trigger to be **observable from real use** (user
   reports the gap, monitor alert, follow-up audit), not a
   silent "we'll get to it".

### Detection grep

```bash
grep -rnE 'out of scope|v2 ships|deferred to v2|filed for v2|TODO.*v2' \
  backend/app/ frontend/src/ plugins/ \
  --include='*.py' --include='*.tsx' --include='*.ts'
```

---

## Inline-component duplication is the upstream cause of parallel-surface asymmetry

Inline component definitions inside large monolithic page files
amplify parallel-surface asymmetry (e.g. List A vs List B for
two related entity types). They have a cause-effect relationship:

```
[Monolithic component file]
        ↓ blocks
[Component extraction discipline]
        ↓ absence creates
[Duplication across parallel surfaces]
        ↓ amplifies
[A-vs-B asymmetry when updates touch one surface only]
```

### Rule

**Extract inline component functions to their own files when
they exceed 50 LOC OR span a logical sub-feature** (a panel, a
tab content, a filter bar, etc.). The extraction enables:

1. **Per-component testid additions** as small, scoped PRs.
2. **Cross-surface reuse** (the extracted A-side component
   becomes a candidate for the B side to import or model).
3. **Independent test files** (Vitest unit tests per component
   vs monolithic page tests).

---

## Parallel-surface asymmetry: every feature gets a parity audit

When a feature ships on one of two parallel surfaces (e.g.
EntityA list/editor vs EntityB list/editor) and the mirror
surface lags behind, gets a different shape, or gets no update
at all, the user-visible result is "feature X works in A but
not in B" - filed as a bug, reproduced as a regression, and
typically masking the actual cause (which is "we forgot to
update B").

### Rule

**Every parallel-surface feature gets an explicit parity
verification step in its development workflow.** Before merging
a PR that touches one of the parallel surfaces:

1. **List the parallel features the change affects** (e.g.
   "this is a delete-confirm dialog change → applies to both
   A and B").
2. **Verify the mirror surface received the equivalent
   treatment** (or explicitly document why it's intentionally
   asymmetric).
3. **Add cross-surface E2E coverage** if the bug class is
   user-visible.

### Intentional asymmetry must be documented

Some asymmetries are DELIBERATE - the two surfaces have
genuinely different conceptual shapes, and forcing parity would
degrade the product. When the asymmetry is intentional,
document it explicitly so a future audit doesn't flag it as a
regression and the next contributor doesn't "fix" it by accident:

1. **Commit message must call it out.** A sentence like
   "B-only by design - A uses Topic (single enum), B uses
   Categories (free-text JSON list); the two domains have
   different metadata shapes" is enough.
2. **Add a one-line note to the file's intentional-asymmetry
   catalogue.**

---

## Periodic theme-token completeness audit

CSS custom properties (`var(--token, #hex-fallback)`) for
color, spacing, and shadow tokens must be defined in every
palette x mode combination. When a token is undefined in one
palette, the hex fallback leaks through, producing visually
wrong rendering that's invisible to all UI tests because the
fallback IS a valid color.

### Rule

**Theme-token completeness audit MUST be part of every
release-cycle pre-release sweep.**

### Audit recipe

```bash
# 1. Inventory every var(--token, #fallback) callsite.
grep -rhE 'var\(--[a-z-]+, *#' frontend/src/ \
  --include='*.tsx' --include='*.ts' --include='*.css'

# 2. Extract the unique --token names referenced.
grep -rhoE 'var\(--[a-z-]+' frontend/src/ \
  --include='*.tsx' --include='*.ts' --include='*.css' \
  | sort -u

# 3. For each --token, check it's defined in all palette
#    × mode combinations in frontend/src/styles/global.css.
#    Missing definitions = the fall-through bug.

# 4. Optionally: add an ESLint rule that flags
#    var(--token, #fallback) usage and require either
#    var(--token) (no fallback - forces existence) OR a
#    documented exception comment.
```

---

## Global CSS rules: distinguish viewport containers from app container

Setting `overflow: hidden` on `html, body, #root` as a single
rule blocks document scroll but also blocks every full-page
component that relied on scroll.

Correct pattern when preventing document-level scroll for
editor zoom behavior:

```css
html, body { height: 100%; overflow: hidden; }  /* viewport lock */
#root { height: 100%; overflow-y: auto; }       /* app scroll */
```

html and body control the browser viewport. `#root` is the
React application root and must remain scrollable for pages
that do not implement their own scroll container.

When a layout fix requires setting `overflow: hidden` on one
of the three, think explicitly about whether full-page
components inside the app need internal scroll, and expose it
via `#root`.

---

## Vite + Node version requirements

- Vite 7+ uses Node's `crypto.hash` top-level API which landed
  in Node 20.12+ / 21.7+ (backported to 22 LTS). On Node 18,
  `vite build` fails with `[postcss] crypto.hash is not a
  function`. The error is misleading: it is not a PWA/postcss
  bug, it is a Node version issue.
- Vitest does NOT exercise the same code path, so `npm run
  test` can still pass on Node 18 even though `npm run build`
  fails. Do not rely on tests alone to validate a Vite major
  bump; always build too.
- For Vite 8+ (Rolldown), `manualChunks` must be a function,
  not an object. Vite 7 (Rollup) accepted both forms. Symptom:
  `Invalid output options ... Expected Function but received
  Object`.

---

## TypeScript 6 no longer auto-includes all `@types/*`

- TS 5 silently included every `@types/*` package from
  `node_modules` when the `types` compilerOption was absent.
  TS 6 stopped doing this: if `@types/node` is installed
  transitively but not named in `types`, `import fs from
  "node:fs"` fails with `TS2591: Cannot find name 'node:fs'`.
- Fix: add an explicit `@types/node` devDependency AND list it
  in `tsconfig.json` under `"types": ["node", "vite/client"]`.
  Both halves are needed - installing the package alone does
  not bring it in on TS 6.

---

## `@types/node` major bumps cascade into tsconfig `lib`

- `@types/node@22` shipped polyfilled lib augmentations (e.g.
  typing `Array.prototype.at()` even under `lib: ES2020`).
  `@types/node@24` dropped them, deferring entirely to whatever
  lib the project declares. Symptom on a 22 → 24 bump:
  `TS2550: Property 'at' does not exist`. This is NOT a
  breakage in `@types/node`; it is correct behavior. The
  earlier convenience was the anomaly.
- Fix: bump `tsconfig.json` `target` and `lib` together with
  the `@types/node` major bump, not after. `Array.prototype.at`
  is ES2022 standard library. Do NOT carry per-call workarounds
  (`as any[]`, casts).

---

## External GitHub Action major-version drift

Standard GitHub Actions (`actions/checkout`, `actions/setup-*`,
`actions/upload-artifact`, `actions/cache`, the pages trio,
plus common third-parties like `softprops/action-gh-release`)
release new majors periodically. An audit finding "all standard
actions are at their current majors" is correct AT THE TIME
but stales within weeks-to-months after a deprecation
announcement.

### Periodic CI-hygiene check

Run every quarter, or after any GitHub runtime/platform
deprecation announcement:

1. List every pinned action:
   ```
   grep -rE 'uses: [a-zA-Z][a-zA-Z0-9-]+/[a-zA-Z][a-zA-Z0-9-]+@v[0-9]+' \
     .github/workflows/ | sort -u
   ```
2. For each, check the latest released major via
   `gh release list --repo <owner>/<repo> --limit 5`.
3. **For each candidate version, read the action.yml runtime
   declaration directly** (not the release-note prose):
   ```
   gh api "repos/<owner>/<repo>/contents/action.yml?ref=<tag>" \
     --jq '.content' | base64 -d | grep '^[[:space:]]*using:'
   ```
4. Pin to the **lowest** new major that satisfies the
   deprecation target AND declares the target Node version in
   its action.yml.

### Release-notes-vs-action.yml trap

Release notes describe **intent and feature changes**.
action.yml declares the **actual runtime**. The two can diverge
across a major version when an action adds preliminary Node N
support without flipping the default. Always trust action.yml
for audit purposes.

---

## Numeric claims arithmetic drift before it ships

When a quantitative finding lands in multiple places
(docstring, audit doc, CHANGELOG entry, commit message),
compute the number ONCE from the authoritative source and
propagate. Do not recompute "from a number that should be
related" - off-by-one errors leak.

### Rule

- **Always run a verification pass against the COMMITTED code**
  before propagating numbers into docs, docstrings, and
  CHANGELOG entries. A `verify_committed.py` that asserts on
  the expected counts is the right shape - if the assertion
  fails, the wrong numbers cannot land.
- **Match every quantitative claim against an authoritative
  source** (the audit script, the test output, a `git ls-files
  | wc -l` count).
- **Treat docstrings + docs as ONE artifact.** Two copies of
  the same drafted number are not two independent witnesses -
  they are two copies of the same draft.

---

## User-facing time estimates must scale with input size or be omitted

A user-facing string with a hard time bound is a promise. A
500MB upload takes longer than a 50MB upload on the same
hardware; "up to 1 minute" creates a false-crash impression for
any input that breaks the promise.

### Rule

Wrong:

- "X seconds" / "X minutes" / "up to N minutes" claims in
  user-facing strings for any operation whose cost scales with
  input size: uploads, imports, exports, bulk operations, AI
  batch calls.

Right:

- Omit the time bound, OR
- Frame the dependency: "Larger archives may take longer."
- For operations with truly bounded cost (sub-second SQL bulk
  DELETE, single-record fetch), no time language is needed.

### Audit checkpoint

At release time, grep i18n catalogs for hard time bounds:

```bash
grep -rniE "minute|sekund|second" \
  backend/config/i18n/*.yaml | grep -iE "dauer|takes|tardar"
```

---

## Bulk-operation limits should be per-operation cost-profile

Every new bulk-operation must justify its limit against its
own cost profile, not copy the neighbour's. Concretely:

- **Compute-heavy operations** (subprocess invocations, TTS
  synth, image processing, AI calls): cap stays. Picked from
  "what completes in 60-180s server-side per batch."
- **DB-bound operations** (soft-delete, hard-delete, status
  toggle, tag attach): **uncapped** by default. SQL bulk
  operations scale to thousands of rows trivially; an
  artificial cap creates the worst-of-both UX where "select
  all" tells the user they cannot do what they obviously want
  to.
- **Network-bound external operations** (publish-to-platform,
  sync-to-git): cap reflects the slowest external call's
  timeout, not the local processing.

Anti-pattern: "uniform cap across all bulk operations so the
UX is consistent". The cost profile is what dominates the UX;
pretending all operations have the same profile **is** the
inconsistency.

---

## Bulk-action UX: action-bar + selection-hook decoupling

The selection hook holds `Set<string>` of selected IDs plus a
filter-aware `selectAll(ids)` that takes an explicit list. The
bar is pure-presentational, taking the count + handlers. The
page wires whatever operation it wants.

Adding a new bulk operation means adding one optional prop on
the bar and the corresponding handler in the page. No
restructuring; no risk to the existing flow; no changes to the
selection hook.

### Rule for future bulk operations

- Add optional handler props on the bar. Do not push
  operation-specific UI into the hook.
- Selection state stays orthogonal to the operations that
  consume it.
- Filter-aware `selectAll` callers
  (`filters.filteredRows.map(r => r.id)`) are the canonical
  "operate on the visible-after-filter set" pattern.

What NOT to do:

- Do not add per-operation state to the selection hook.
- Do not fork the bar into per-operation components.
- Do not centralize bulk-operation logic into a higher-order
  component.

### Bar-visibility convention at count===0

Bulk-action bars are rendered conditionally on
`selection.count > 0` from the surrounding page. When the
count drops to zero, the bar UNMOUNTS - no disabled-state, no
placeholder. This matches the convention in Gmail, Linear,
Notion, etc.

---

## Bulk operations earn page-route UX even when single-item siblings use modals

Existing single-item surfaces may be modals. Bulk operations
that take multi-second-to-minute processing time PLUS produce
structured results worth reviewing deserve their own top-level
route, not a modal.

Deciding factors:

1. **Bulk operations have multi-minute processing time.** A
   modal that locks the screen for that long is hostile.
2. **Structured results need review surface.** Bulk imports
   produce a 3-section table (imported / skipped / errored)
   the user genuinely reads, sometimes for several minutes.
3. **Stable URL matters for help-doc deep links.** "Open app →
   list → click button → select feature" is multi-step verbal
   instruction; a direct URL is one click.
4. **Pattern-adherence is not an end in itself.** Diverging
   knowingly for a use-case-specific reason is fine; diverging
   by accident is not.

When choosing route vs modal for a new import / batch surface:

- Sub-second processing + single-result outcome → modal, match
  the existing pattern.
- Multi-second-to-minute processing + structured table outcome
  + worthwhile help-doc surface → page route, document the
  divergence in the commit + an archive entry.

---

## German content uses real umlauts

Production German content uses proper UTF-8 umlauts (ä, ö, ü, ß),
NOT ASCII transliterations (ae, oe, ue, ss).

### Where this applies (real umlauts required)

- i18n catalogs (`backend/config/i18n/de.yaml`).
- User documentation (`docs/help/de/**/*.md` if you ship help docs).
- Plugin German content (under any `*/content/de/`).
- README German sections.
- CHANGELOG German entries (rare; quoted UI strings only).
- Journal entries written in German prose.
- Any other user-facing German text.

### Where ASCII stays

- Source code (`*.py`, `*.ts`, `*.tsx`, `*.js`, `*.jsx`).
- Code comments, docstrings (English convention).
- Variable / function / class / identifier names.
- File names, directory names.
- Git branch names, commit messages.
- Chat with the user (per the maintainer's style preference,
  ASCII-only in chat communication).

The chat-style rule and the production-content rule are
deliberately different. Production text is authored for end
readers; the chat is a working channel.

### Why this matters

ASCII transliteration looks unprofessional to German readers
and can break Pandoc / EPUB export rendering when the
surrounding text uses proper umlauts (the mixed-encoding
pattern is the worst case - same file, two styles, output
renders as garbage).

---

## Doc files: existence is not discoverability

When you add a new help page under `docs/help/{lang}/`, verify
it appears in whatever nav index the help system uses
(typically `docs/help/_meta.yaml` for MkDocs-driven nav). The
nav generator reads that file as the single source of truth;
pages not listed there are unreachable from the side nav even
though direct URLs and in-text links still work.

### Rule

File existence is not user discoverability. After creating a
new help page, the same commit (or a paired one) must add the
entry to the nav index with a sensible icon and the appropriate
placement among siblings.

---

## Doc values: read from code, not from memory

Any specific number, threshold, default value, dropdown range,
or feature flag mentioned in the docs MUST come from the code
or config that defines it
(`backend/config/app.yaml`, `backend/config/i18n/*.yaml`, the
schema, the source of the relevant function), not from memory
or approximation.

If a value isn't easily findable in code, that is a signal to
flag the question, not to guess. Wrong defaults in user docs
erode trust faster than missing docs do.

---

## Diagnostic features must fail open

Diagnostic and convenience features should fail open. A feature
that prevents bad behavior (double-launch, stale cache, etc.)
must not block the application's primary function when it
fails. Crashing the app because a convenience check crashed is
always worse than silently skipping the convenience check.

Concrete example: a launcher's lockfile check
(`another_instance_alive`) crashed with `TypeError: argument of
type 'NoneType' is not iterable` because `tasklist` returned
`stdout=None` on a Windows locale edge case. This prevented
every user from starting the launcher at all. The fix: wrap in
try/except that fails open (log warning, proceed).

This applies beyond lockfiles. Any startup check, guard, or
health probe that gates the main application flow should be
wrapped so that a failure in the check degrades gracefully
rather than killing the app.

---

## Content-hash sidecar files as a "was this already processed?" pattern

Any long-running deterministic process where re-running on
unchanged input is wasteful can use sidecar fingerprint files.
The sidecar stays next to the output artifact, travels with it
through copy/persist operations, and is authoritative for "is
this output still current?" decisions.

Key design decision: the sidecar includes ALL parameters that
affect the output (content + engine + voice + speed, or
whatever the equivalent parameters are), not just the content
hash. Changing one parameter with the same input invalidates
the artifact. Always fingerprint the full parameter set.

Before designing new infrastructure for "is this current",
check whether existing persistence artifacts already carry the
information you need.

---

## Dependency currency in active development

In active development projects, dependency versions should be
kept current from day one. Shipping with end-of-life or
deprecation-imminent versions creates technical debt
immediately.

Rules:

- Only stable releases, no beta/RC/alpha versions ever in
  production code
- "Latest stable" means most recent version that has proven
  stable (minimum 2 weeks since release)
- For LTS products (Node.js), prefer Active LTS over Current
- Review dependencies at each release cycle: run `poetry show
  --outdated` and `npm outdated` before cutting any release
- Major version bumps get their own commit with migration notes
- Routine minor/patch bumps can be batched by category

Red flags for outdated dependencies:

- Deprecation warnings in build output
- End-of-life announcements in package READMEs
- Security advisories against installed versions
- Upstream pins blocking other upgrades

Upstream blockers: when an external dependency pins a
transitive dep, the bump is deferred until the upstream
releases a compatible version. Document the blocker in the
commit that updates what it can, so the next sweep picks it up.

---

## `poetry update` vs `poetry lock` semantics

- **`poetry lock`** = "re-resolve from pyproject specs." Only
  meaningful after a pyproject pin changed. No-op when nothing
  in pyproject changed (the existing lock is still a valid
  resolution).
- **`poetry update <pkg>`** = "move this package (and its
  transitives) to the latest within range." Touches the lock;
  pyproject is unchanged unless the new version exceeds the
  caret.
- **`poetry update` (bare)** = "move EVERY package within every
  range." Maximally aggressive; pulls every patch + every minor
  + every transitive-of-transitive. Risky: one low-risk direct
  bump can pull a high-risk transitive via the upstream's
  relaxed bounds.

The `make lock-all-plugins` target serves the "pyproject
changed" case (e.g. after a shared-dep pin bump propagated to
every plugin). It is NOT a "pull patch transitives" tool. Use
`poetry update <allowlist>` per plugin for that purpose.

---

## Transitive deps can surface high-risk packages from low-risk direct bumps

Bare `poetry update` can pull packages the audit had
specifically deferred as high-risk via transitive relaxation
of an upper bound by a direct dep. Even an audit that correctly
categorised packages by direct risk can miss this if the audit
did not model transitive cascades.

### Concrete rule for any bulk-bump pass

1. **Pre-flight a single instance before bulk-applying.** One
   test plugin / one test environment, never blind bulk.
2. **Prefer `poetry update <allowlist>` over bare `poetry
   update`.** The allowlist constrains which packages can move;
   transitives only move if their own version constraint
   demands it.
3. **If the audit deferred a package as high-risk, add a
   regression check.** Grep for the package name in the
   resulting lock-diff before committing; if it appears in the
   diff despite not being in your allowlist, surface and revert.
4. **The "two installation paths" rule still applies.** A
   backend-only lock-resolution test is not enough; a
   transitive surfacing in a plugin lock would only appear when
   you actually run that plugin's `poetry install`.

---

## Hotfix cluster tag policy

When a release tag fails CI for a mechanical reason (chmod bit
missing, formatter nit, type-check escape, build-time spec
error) and a fix lands quickly via point-release bumps, the
failed tag stays in the repository as historical record - it
does not get deleted. Reasons:

- The failed gate run, even though it failed, is part of the
  release audit trail.
- Deleting a published tag is a force-push class operation per
  CLAUDE.md security rules; allowed only when nobody pulled the
  tag and no GitHub Release was published.
- Each tag's commit reflects the state at the moment of the
  bump. Future bisects can use them.
- The shipped tag's `changelog/releases/v0.X.Y.md` file
  documents the hotfix history.

Do delete a tag only when it was pushed in the last few minutes
and the user explicitly confirms no one could have pulled. The
default is keep + document.

---

## install.sh / generated artifact drift

- Install scripts (`install.sh`) are a special class of code
  where the test must simulate the actual distribution path.
  CI that tests scripts should run them the way users run them,
  not the way developers run them. `docker build -f Dockerfile
  .` from a working tree is not the same test as `curl ... |
  bash` which downloads, checks out a tag, and then builds.
- `install.sh` is a generated artifact built from
  `install.sh.template` + `backend/pyproject.toml` via
  `scripts/generate_install_sh.sh`. The committed `install.sh`
  stays in git because users curl-pipe it directly from the
  raw GitHub URL; it cannot be a build-time artifact hidden
  behind .gitignore. Treat it like generated docs: edit the
  template, regenerate at release time, commit both.
  `verify_version_pins.sh` runs `--check` to catch drift
  between template and committed output.
- Corollary: when fixing an install/deployment script, always
  test THE SCRIPT, not just the artifacts it references.

---

## Shallow clone update trap

`git clone --depth 1 --branch v0.7.0` creates a repo where
`origin/main` does not exist as a remote ref. A later `git
fetch origin` does not fix this because the fetch refspec was
configured for the tag, not for branch tracking. `git checkout
-B main origin/main` then fails with "pathspec 'main' did not
match". The fix is to not try to update shallow clones in place
at all. Delete and re-clone (backing up `.env` first) is the
only reliable cross-platform approach. Surgical git state
repair across shallow clone versions, platforms, and git
implementations is a losing battle.

---

## Backup import must check soft-delete state before dedup

Idempotent-by-id import paths added before a soft-delete
feature exists become silently buggy when the soft-delete ships.

Symptom: a backup made before trashing silently cannot be
restored once the records have been moved to trash - the
importer sees them in the DB (with `deleted_at` set) and
refuses to rebuild.

### Rule

When the pre-existing row is soft-deleted, HARD-delete it along
with its children + assets, then fall through to the
fresh-insert path. Do NOT try to revive via per-attribute
setattr: the backup JSON does not carry every NOT NULL column,
so SQLAlchemy emits an UPDATE that sets those to NULL and the
integrity constraint trips. Hard-delete + fresh-insert
sidesteps the whole partial-update dance and matches the
backup's snapshot semantics.

Generalises: any "idempotent by id" import path added before a
soft-delete feature becomes silently buggy. Always branch on
`deleted_at IS NULL` when deduping.

---

## CSS specificity trap: `h2 + p` loses to `p:not(:first-child)`

- Specificity for
  `[data-app-theme="classic"] .ProseMirror h2 + p`:
  (0, 1, 1, 2) - 1 attr, 1 class, 2 elements.
- For
  `[data-app-theme="classic"] .ProseMirror p:not(:first-child)`:
  (0, 1, 2, 1) - 1 attr, 1 class + 1 pseudo-class = 2
  "classes", 1 element. The pseudo-class pushes the base rule
  ahead of the adjacent-sibling override.
- When both rules match, the higher-specificity
  `:not(:first-child)` wins and the heading override never
  applies.
- Fix: append `:not(:first-child)` to each `h* + p` override.
  Combined (0, 1, 2, 2) beats the base (0, 1, 2, 1).

Generalizes: any CSS override against a `:not(:first-child)`
base rule needs at least the same pseudo-class weight.

---

## Export semantics audit: "comprehensive export" usually means "your data only"

The canonical pattern across consumer platforms:

- Your data, your account, things you actively did/sent. ALL
  exported.
- Other people's interactions with you. NOT exported (unless
  you screenshotted them or saved them out-of-band).

The user's mental model - "give me everything connected to my
account, including how others interacted with me" - is a
reasonable expectation but rarely how data export features
work. Platforms ship "your data" exports for GDPR /
data-portability reasons; "everyone else's data on your
content" is someone else's data, not yours, so it stays.

### Concrete rules for any importer surface

- **Help-doc expectations management.** When a platform's
  export is "your data only", the help doc's "What is NOT
  imported" section must explicitly say so. The
  "comments-other-people-wrote" gap is exactly the kind of
  thing users discover by smoke-test and report as a bug; a
  one-paragraph disclaimer in the help doc pre-empts that.
- **The schema can still support the missing data type for
  forward compatibility.** A nullable column for "manual entry"
  prepares for a future user-entry workflow without waiting on
  the source platform.
- **The "no app bug" distinction matters.** When a user
  reports "X is missing", the diagnosis should separate "app
  failed to import X" from "the source export never contained
  X." The second is a platform limitation, not an app
  limitation; the fix is documentation + maybe a follow-up
  manual-entry workflow, NOT an importer change.

---

## Config migration (bool -> enum)

- When a boolean setting is extended to an enum with more
  options (e.g. `merge: true|false` -> `merge: separate|merged|both`):
  ALWAYS introduce a `normalize_*` function that silently
  translates old bool values (True -> "merged", False ->
  "separate") and maps unknown/None values to the default.
- Reason: user configs in YAML, backups and DB columns still
  contain old bool values. A hard schema validation would
  break existing installations. The default in the Pydantic
  schema is not checked for migration by the type system.
- In practice: the normalization MUST happen on both the
  backend (generator/service layer) AND the frontend (state
  init from settings), so both sides share the same migration
  rules. Otherwise old configs show the wrong default in the UI.
- Tests: one explicit migration test per bool value, plus
  pass-through for all enum values, plus default for
  None/unknown.

---

## IndexedDB recovery draft `contentHash` is a MATCH check, not a MISMATCH

Drafts-recovery patterns typically store a server-content hash
alongside the local draft so the UI can decide "the local
draft is newer than what we last saw on the server, surface a
recovery banner". The contract is:

```
recover iff draft.contentHash == hashContent(serverContent)
       AND  draft.content     != serverContent
```

"this draft was written against THIS server state, local
content is newer."

Seeding a test draft with `contentHash: '_mismatch_'` will NOT
trigger the recovery banner - the hash check needs to MATCH
the server, not differ from it.

### Rule

When writing tests that seed IndexedDB, compute the hash of
the real server content inside the seed script rather than
using a sentinel value. A misleading test comment saying "must
differ from server hash" burns multiple sessions before someone
re-reads the recovery source.

---

## Pandoc raw-HTML pass-through is format-specific

Pandoc's HTML and EPUB writers preserve raw HTML blocks
verbatim. The LaTeX (PDF) and DOCX writers SILENTLY DROP raw
HTML - including `<figure>`, `<img>`, `<figcaption>`. The
verbose log records `Not rendering RawBlock (Format "html")
"<figure>"` per dropped element.

Practical consequence: any Markdown that contains raw HTML
images will produce an EPUB with images and a PDF without
them. Same input, different output, no error message.

Fix: when converting to Markdown for export, always emit
native Pandoc syntax for content that must survive PDF/DOCX.
For figures, that is `![caption](src "alt")` - Pandoc's
`implicit_figures` extension (default in `gfm`/`markdown`)
promotes a single-image paragraph back into a real
`\begin{figure}` / `<figure>` block in every output format.
The raw-HTML form is acceptable ONLY for HTML/EPUB-only
content.

Generalises: any "convert to format X, then output through
format Y" pipeline needs to verify the format-bridging behavior
of every node type in real exports, not just rely on the
in-memory representation matching.

---

## Review architectural decisions before implementing

Before implementing a larger architectural decision, check:

1. ROADMAP entries in the area
2. todo-prompts.md for already-planned changes
3. docs/journal/ for earlier discussed decisions

On a conflict between a user instruction and documented
planning: STOP and explicitly ask the user which version
applies. Never build parallel systems that are already slated
for deletion.

---

## Boy Scout: detection recipes belong with their rules

When adding a new lesson, add a grep that catches the trap if
possible. Future contributors run the grep in CI or pre-commit
and catch the regression before it ships.

```bash
# Example: catch print() in library code (excluding tests and CLI)
grep -rn "^\s*print(" backend/app/ --include="*.py" | grep -v cli.py
```

---

*Add new lessons below. Keep entries short. Concrete >
comprehensive.*
