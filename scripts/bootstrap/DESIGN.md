# Bootstrap automation - design

Status: **signed off (overrides recorded below). Implementation in progress, gated on the lineage-prune PR landing on the template before the EXAMPLE-DOMAIN inventory + phase 8 + integration test get finalized.**

## Sign-off decisions

- **Deviation 2 overridden**: docs-tree deletions ARE replicated. The template's parallel lineage-prune PR removes `docs/help/`, `docs/journal/`, `docs/testing/`, `docs/explorations/`, `docs/architecture/`, `mkdocs.yml`, and ~84 stale files. The bootstrap script must reflect the post-prune template state; inventory work is gated on that PR merging.
- **Deviations 1 and 3 approved as drafted**: stub frontend pages, keep a rewritten `CUSTOMIZE.md`.
- **Q1**: plugin skeleton is opt-in via `--with-example-plugin`.
- **Q2**: manifest grows `app.version` (default `"0.1.0"` if omitted).
- **Q3**: EXAMPLE-DOMAIN inventory is a static `scripts/bootstrap/example_domain_inventory.json`, updated when the template's example domain changes. **Built after the prune PR merges.**
- **Q4**: phase 2 sed sweep rewrites `pluginforge-app-template` literals to the new app name (GitHub URLs, package references, all prose mentions). The template is meant to disappear completely after bootstrap.
- **Q5**: pruned `lessons-learned.md` is kept verbatim by the script. No auto-prune logic.
- **Q6**: no `--force` flag. Non-empty target dir aborts with a clear error; user runs `rm -rf` and retries.

The two `# behaviour: tree auto-adds` comment blocks in the example manifest are documentation, not part of the parser contract; the parser treats them as YAML comments.

## Goal

Automate the mechanical parts of customising `pluginforge-app-template` into a new application. Reproduce phases 1, 2, 3, 4, 7, 8 of the Topos bootstrap (commits `57d8f6f`, `1e50ef0`, `3c01a29`, `03d4f3b`, `348b10d`, `df61224`) from a single command + a manifest. Stub phase 6 (frontend shell). Leave phase 5 (first plugin) and phase 6's UX content to the human / AI session that follows.

Success criterion: running `bootstrap-app.sh --manifest example-manifest.yaml --target-dir /tmp/topos-replay` against a clean template clone produces a tree that passes Topos's 10-check phase-8 sweep AND `make install && make test` from scratch.

## Topos commit map (the proven reference)

| Phase | SHA | What the script reproduces |
|---|---|---|
| 1 | `57d8f6f` | clean clone -> `rm -rf .git && git init -b main` + provenance commit |
| 2 | `1e50ef0` | sed sweep on 23 extensions + 23 launcher renames + 3 metadata file rewrites |
| 3 | `3c01a29` | delete EXAMPLE-DOMAIN (~200 files), generate N model+schema files, gut i18n, wipe migrations |
| 4 | `03d4f3b` | per-entity service + router + integration test, wire main.py at TEMPLATE anchor |
| 5 | `ab9d70c` | **NOT automated** - script stubs plugin skeleton only |
| 6 | `262cb64` | **partially automated** - shell only (types, db, hooks, api client, stub pages); UX deferred |
| 7 | `348b10d` | README, README-de, CONCEPT, ROADMAP, configuration.md rendered from manifest |
| 8 | `df61224` | 10-check sanity sweep + em-dash sweep + commit |

The Topos commits live at `/home/astrapi69/dev/git/hub/astrapi69/topos/.git/`. Each phase is one atomic commit; the script mirrors that 1:1.

## Hard deviations from Topos

Three places where the script intentionally does NOT match Topos verbatim. Each is a deliberate trade-off; flag if you disagree.

1. **Frontend pages are stubs, not real CRUD.** Topos shipped CRUD-complete pages in phase 6 (tree widget, optimistic mark-done, drag-drop import, full-text search). The prompt's NO list explicitly defers this. The script generates a stub page per entity (renders the entity name + a "TODO: implement <EntityName> UI" panel) plus a one-line Vitest "renders without crash" test. The api client, types, db schema, and hooks ARE generated complete — only the page bodies are stubs.

2. **Documentation deletions in Topos's phase 8 are NOT replicated.** Topos commit `df61224` deleted `docs/help/`, `docs/journal/`, `docs/architecture/`, `docs/testing/`, `docs/explorations/`, `docs/backlog.md`, `docs/API.md`, `docs/smoke-tests-catalog.md`, `docs/ux-conventions.md`, `mkdocs.yml`, `docs/pyproject.toml`, plus the docs-discipline Makefile targets and pre-commit hook. Those choices fit Topos's "single-user, offline, no published docs site" target. A new app might want the docs scaffold. The bootstrap script leaves them in place. The README it renders mentions the docs site as optional infrastructure the user can prune themselves.

3. **`CUSTOMIZE.md` is kept** for the same reason: the bootstrap script replaces it with a fresh `CUSTOMIZE.md` that documents what the script did and what's left for the human. Topos deleted it outright; we keep a useful version.

## CLI

```bash
scripts/bootstrap/bootstrap-app.sh \
    --manifest path/to/entities.yaml \
    --target-dir /absolute/path/to/new/app \
    [--dry-run] \
    [--skip-migration]
```

- `--manifest` (required): YAML path. Schema below.
- `--target-dir` (required): absolute path. Must NOT resolve to the template repo root (idempotency + self-bootstrap guard).
- `--dry-run`: print the plan (files to write, files to delete, commits to make) and exit 0 without touching disk.
- `--skip-migration`: skip `alembic revision --autogenerate` in phase 3; drop a `.bootstrap-migration-pending` stamp file at the target root so the user knows to run it.

`bootstrap-app.sh` is a thin wrapper. `bootstrap.py` does the work. Bash + Python stdlib only.

## Self-bootstrap and idempotency guards

The script refuses to run when:

- `--target-dir` resolves (via `realpath`) to the template repo root (this repo). Detection: presence of `scripts/bootstrap/` + `.git/config` whose `[remote "origin"]` url matches `astrapi69/pluginforge-app-template`.
- The target tree shows evidence of already being bootstrapped: `.bootstrap-complete` stamp file OR `backend/app/main.py` no longer contains `app_id="myapp"`. Re-running is a clean exit-1 with "already bootstrapped"; not corruption.
- The target tree has uncommitted changes (after the initial clone step). Stops cold; tells the user to commit/stash first.

The script copies the template tree to `--target-dir` first (a `cp -r --no-target-directory` excluding `.git/`, `node_modules/`, `__pycache__/`, `.coverage`, `dist/`, `build/`, `*.egg-info/`, `frontend/dist/`, `backend/uploads/`, `backend/myapp.db*`). Then `git init -b main` in the target. The template repo is not modified.

## Manifest schema

YAML, parsed with `yaml.safe_load`. The example manifest at `scripts/bootstrap/example-manifest.yaml` reproduces Topos exactly.

```yaml
app:
  name: topos                       # lowercase, replaces "myapp"
  pascal_name: Topos                # replaces "MyApp"
  upper_name: TOPOS                 # replaces "MYAPP"
  version: "0.1.0"                  # optional; defaults to "0.1.0" if omitted
  description: "Personal inventory tracker for folders, boxes, and what's inside."
  short_tagline: "Personal inventory tracker"
  default_language: de              # one of supported_languages
  supported_languages: [de, en, es, fr, el, pt, tr, ja]
  author_name: "Asterios Raptis"
  author_email: "aster.raptis@gmail.com"
  repository_url: "https://github.com/astrapi69/topos"

entities:
  - name: Container                 # PascalCase; the SQLAlchemy class name
    plural: containers              # lowercase plural; URL path + tablename + router file stem
    table_name: containers          # optional; defaults to plural
    behaviour: standard             # one of: standard | tree   (tree adds CategoryNode + GET /tree + GET /children)
    timestamps: true                # adds created_at, updated_at (default-NOW, on-update-NOW)
    fields:
      - {name: external_id, type: int, unique: true, indexed: true}
      - {name: type, type: enum, enum_name: ContainerType,
         enum_values: [folder, box], indexed: true}
      - {name: owner, type: enum, enum_name: Owner,
         enum_values: [self, parents, shared], indexed: true}
      - {name: label, type: str, max_length: 500}
      - {name: description, type: str, max_length: 2000, nullable: true}
      - {name: location, type: str, max_length: 500, nullable: true, indexed: true}
      - {name: size_group, type: str, max_length: 50, nullable: true}
    relationships:
      - {kind: has_many, target: Item, back_populates: container,
         cascade: "all, delete-orphan"}
    list_filters:                   # query params on GET /api/containers
      - {name: owner, kind: equals, field: owner}
      - {name: type, kind: equals, field: type}
    extra_endpoints:
      - id: get_by_external_id
        method: GET
        path: /by-external-id/{external_id}
        service_fn: get_container_by_external_id
        returns: ContainerRead
        path_params: [{name: external_id, type: int}]
        not_found_message: "Container with external_id={external_id} not found"

  - name: Item
    plural: items
    timestamps: true
    fields:
      - {name: container_id, type: fk, target: Container,
         column: containers.id, indexed: true}
      - {name: content, type: str, max_length: 1000}
      - {name: priority, type: enum, enum_name: Priority,
         enum_values: [none, low, medium, high, very_high],
         default: none, indexed: true}
      - {name: category_path, type: str, max_length: 500,
         nullable: true, indexed: true}
      - {name: notes, type: str, max_length: 2000, nullable: true}
    relationships:
      - {kind: belongs_to, target: Container, back_populates: items}
      - {kind: has_many, target: Action, back_populates: item,
         cascade: "all, delete-orphan"}
    list_filters:
      - {name: container_id, kind: equals, field: container_id}
    extra_endpoints:
      - id: search
        method: GET
        path: /search
        service_fn: search_items
        returns: list[ItemRead]
        query_params: [{name: q, type: str, required: true}]

  - name: Category
    plural: categories
    behaviour: tree
    fields:
      - {name: path, type: str, max_length: 500, unique: true, indexed: true}
      - {name: parent_path, type: str, max_length: 500,
         nullable: true, indexed: true}
      - {name: name, type: str, max_length: 200}
      - {name: display_name, type: str, max_length: 200}
      - {name: level, type: int, default: 0}
    # behaviour: tree auto-adds:
    #   GET /tree              -> build_tree() returning CategoryNode forest
    #   GET /children          -> list_children(parent_path)
    #   GET /by-path/{path}    -> get_category_by_path(path)

  - name: Action
    plural: actions
    timestamps: false               # Action uses created_at + completed_at only
    fields:
      - {name: item_id, type: fk, target: Item, column: items.id, indexed: true}
      - {name: text, type: str, max_length: 1000}
      - {name: status, type: enum, enum_name: ActionStatus,
         enum_values: [open, done, archived], default: open, indexed: true}
      - {name: due_date, type: datetime, nullable: true}
      - {name: created_at, type: datetime, default_now: true}
      - {name: completed_at, type: datetime, nullable: true}
    relationships:
      - {kind: belongs_to, target: Item, back_populates: actions}
    list_filters:
      - {name: status, kind: equals, field: status}
    extra_endpoints:
      - id: complete
        method: POST
        path: /{action_id}/complete
        service_fn: complete_action
        returns: ActionRead
        path_params: [{name: action_id, type: int}]
        side_effects: "set status=done, completed_at=utcnow"
      - id: reopen
        method: POST
        path: /{action_id}/reopen
        service_fn: reopen_action
        returns: ActionRead
        path_params: [{name: action_id, type: int}]
        side_effects: "set status=open, completed_at=None"
```

Field types supported: `int`, `str` (requires `max_length`), `datetime`, `bool`, `float`, `enum` (requires `enum_name` + `enum_values`), `fk` (requires `target` + `column`). Anything outside this set is rejected with a manifest-validation error pointing at the offending field. JSON / array / decimal columns are out of scope for v1; the manifest validator surfaces them as "unsupported type, file a follow-up" rather than guessing.

`behaviour: tree` flags an entity for the Category-shaped extras: extra schema class `EntityNameNode` (the recursive node type), extra service functions `list_children` + `get_by_path` + `build_tree`, extra routes `/tree` + `/children` + `/by-path/{path}`. No manifest plumbing needed beyond `behaviour: tree`; the templates handle it.

Manifest validation runs first, before any disk write. Errors collected into a single report; no partial bootstrap.

## File generation map

`scripts/bootstrap/templates/` holds `string.Template` files. One template per generated artifact. Templates use `${variable}` substitution; control flow (per-field, per-entity) lives in `bootstrap.py`, NOT in templates. Templates stay readable.

| Template file | Renders to (per entity unless noted) | Phase |
|---|---|---|
| `models/entity.py.tpl` | `backend/app/models/<plural>.py` | 3 |
| `models/__init__.py.tpl` | `backend/app/models/__init__.py` (single re-export file) | 3 |
| `schemas/entity.py.tpl` | `backend/app/schemas/<plural>.py` | 3 |
| `schemas/__init__.py.tpl` | `backend/app/schemas/__init__.py` (single re-export file) | 3 |
| `services/entity.py.tpl` | `backend/app/services/<plural>.py` | 4 |
| `routers/entity.py.tpl` | `backend/app/routers/<plural>.py` | 4 |
| `tests/router_test.py.tpl` | `backend/tests/routers/test_<plural>.py` | 4 |
| `main.py.routers.tpl` | patch block written into `backend/app/main.py` between TEMPLATE anchors | 4 |
| `frontend/types.ts.tpl` | `frontend/src/types/<app.name>.ts` (single file) | 6 |
| `frontend/db_schema.ts.tpl` | `frontend/src/db/schema.ts` (single file) | 6 |
| `frontend/api_client.ts.tpl` | `frontend/src/api/client.ts` (single file) | 6 |
| `frontend/hooks.ts.tpl` | `frontend/src/hooks/use<PascalName>.ts` (single file) | 6 |
| `frontend/page_stub.tsx.tpl` | `frontend/src/pages/<Entity>List.tsx` + `<Entity>Detail.tsx` | 6 |
| `frontend/page_stub.test.tsx.tpl` | smoke test alongside each stub page | 6 |
| `README.md.tpl` | `README.md` | 7 |
| `README-de.md.tpl` | `README-de.md` | 7 |
| `CONCEPT.md.tpl` | `docs/CONCEPT.md` | 7 |
| `ROADMAP.md.tpl` | `docs/ROADMAP.md` | 7 |
| `CUSTOMIZE.md.tpl` | `CUSTOMIZE.md` (replaces the template version) | 7 |
| `CLAUDE.md.tpl` | `CLAUDE.md` (header + data-model section only; rules block intact) | 7 |
| `plugin_skeleton/pyproject.toml.tpl` | `plugins/<app.name>-plugin-example/pyproject.toml` (offered, opt-in) | optional |

Templates derive from the Topos versions at HEAD (`aabf2b2`). Topos-specific narrative ("folders, archive boxes") gets stripped; the manifest-fillable shell stays. Per phase 8 hard rule: NO em-dashes (U+2014) in any generated file; hyphens or commas only.

## Phase-by-phase plan

Each phase is one git commit on the bootstrapped tree. Pre-commit hooks must pass on each (mandates ruff-format + ruff-check + ESLint + Prettier + pytest smoke). Conventional-commit messages match Topos's per-phase format.

### Phase 1: bootstrap

- Validate `--target-dir` (absolute path, not the template root, parent dir exists).
- Copy template tree into `--target-dir` (excludes listed above).
- `rm -rf <target>/.git && git init -b main` inside the target.
- Write `.bootstrap-provenance.json` with `{template_repo, template_commit, bootstrap_version, manifest_path, timestamp}`.
- Commit: `chore: bootstrap from pluginforge-app-template <template-sha>`.

### Phase 2: rename

- sed sweep across the file extensions Topos commit `1e50ef0` touched: `.py .ts .tsx .yaml .yml .json .toml .md .sh .cmd .ps1 .html .css .spec .template .example .txt`, plus the literal filenames `Makefile`, `Dockerfile`, `LICENSE`, `.gitignore`, `.dockerignore`, `.pre-commit-config.yaml`, and `pre-push` (git hook). Excludes: `.git/`, `node_modules/`, `__pycache__/`. Order matters: `MYAPP -> ${upper_name}` first, then `MyApp -> ${pascal_name}`, then `myapp -> ${name}` (longest match first; case-sensitive sed).
- Rename `launcher/myapp_launcher` -> `launcher/<name>_launcher` via `git mv` (the bootstrap repo's git, not the template's).
- Rename `launcher/myapp-launcher.spec` -> `launcher/<name>-launcher.spec`.
- Rename `launcher/myapp.ico` -> `launcher/<name>.ico` (binary preserved).
- Rename `backend/.myapp-production` -> `backend/.<name>-production`.
- Rewrite `backend/pyproject.toml` top-level fields (`name`, `description`, `authors`, `keywords`) from manifest.
- Rewrite `frontend/package.json` top-level fields (`name`, `description`, `author`).
- Rewrite `launcher/pyproject.toml` top-level fields + `packages` include.
- Rewrite `launcher/version_info.txt` Windows-metadata StringStruct fields (`FileDescription`, `InternalName`, `OriginalFilename`, `ProductName`).
- Commit: `chore: rename myapp -> ${name}`.

### Phase 3: domain swap

- Delete the EXAMPLE-DOMAIN file inventory verbatim from Topos commit `3c01a29` (extracted into `scripts/bootstrap/example_domain_inventory.json`, a static file; if the template ever evolves, this file is updated in lockstep). Covers: routers/, services/ except `__init__.py`, ai/, data/, import_plugins/, voice_store.py, backup_history.py, migrations/versions/*, the test files, the legacy entity model files. Keeps: licensing.py, plugin_install.py, settings.py, hookspecs.py shell, database.py, paths.py, main.py shell.
- Render new model files from `models/entity.py.tpl`.
- Render new schema files from `schemas/entity.py.tpl`.
- Render `models/__init__.py` re-export.
- Render `schemas/__init__.py` re-export.
- Render minimal i18n stubs in all 8 catalogs: keep `ui.app.name`, `ui.app.description`, `<name>.app.name`, `<name>.app.description`; drop everything else.
- Reduce `hookspecs.py` to the `app_ready` shell (Topos kept this single hookspec; everything else gets deleted).
- Rewrite `backend/app/main.py` to the phase-3 shell shape: app_id from manifest, FastAPI title from manifest, TEMPLATE-marker comment block at the router-wiring site (phase 4 fills this).
- Replace `MyAppError` exception class with `<PascalName>Error` + update the exception handler. (Already done by phase 2's sed if the class is named consistently; phase 3 just ensures the exception module's structure stays.)
- If not `--skip-migration`: `cd backend && MYAPP_TEST=1 TEST_DATABASE_URL=sqlite:///:memory: poetry run alembic revision --autogenerate -m "initial ${name} schema"`. Falls back to `sqlite:///bootstrap-tmp.db` if `--skip-migration` is not passed but env-var DB url is unset.
- If `--skip-migration`: write `.bootstrap-migration-pending` stamp file at target root.
- Commit: `feat: replace EXAMPLE-DOMAIN with ${name} domain (Container, Item, Category, Action)` (entity list pulled from manifest).

### Phase 4: CRUD

For each entity in manifest order:

- Render service file from `services/entity.py.tpl`. Functions: `list_<plural>(db, **filters)`, `get_<entity>(db, id)`, `create_<entity>(db, payload)`, `update_<entity>(db, id, payload)`, `delete_<entity>(db, id)`. Plus any `extra_endpoints` service functions. Plus tree extras if `behaviour: tree`.
- Render router from `routers/entity.py.tpl`. Standard CRUD + extras + tree extras. Thin handlers; services raise typed errors; the global handler maps to HTTP. OpenAPI tag = entity name.
- Render integration tests from `tests/router_test.py.tpl`. Coverage: round-trip CRUD, 404 on missing id, 422 on invalid payload, plus one test per extra_endpoint (happy path + 404 / 409 where applicable).

After per-entity work:

- Patch `backend/app/main.py`: replace the TEMPLATE-marker comment block with the rendered `main.py.routers.tpl` block (imports + `app.include_router(<plural>.router, prefix="/api")` lines).
- Run `pytest backend/tests/routers/ -x` inside the target as a smoke check; abort the phase if red, surface failures.
- Commit: `feat: CRUD services + routers + integration tests for ${entity-list}`.

### Phase 6: frontend shell

- Render `frontend/src/types/<name>.ts` (TypeScript interfaces matching `EntityRead` schemas).
- Render `frontend/src/db/schema.ts` (Dexie tables, one per entity, indexed-fields mirror SQLAlchemy indexes).
- Render `frontend/src/api/client.ts` (per-entity namespace: `list, get, create, update, delete` + extras + tree extras). camelCase boundary normalization as in Topos.
- Render `frontend/src/hooks/use<PascalName>.ts` (stale-while-revalidate hook per entity + `refreshAll`).
- Render stub pages: `<Entity>List.tsx` and `<Entity>Detail.tsx` per entity. Each renders the entity name + a single `<p>TODO: implement {EntityName} UI</p>`. NavBar wired but pages are intentionally bare.
- Render `NavBar.tsx` + `App.tsx` with one route per entity (`/<plural>` and `/<plural>/:id`).
- Render Vitest smoke test per stub page: `it('renders without crashing', ...)`. One assertion: heading visible.
- Commit: `feat: frontend shell (types, db, hooks, api client, stub pages)`.

This is the documented deviation from Topos. Stubs only; UX lands separately.

### Phase 7: docs

- Render `README.md`, `README-de.md`, `docs/CONCEPT.md`, `docs/ROADMAP.md`, `docs/configuration.md`, `CUSTOMIZE.md`, `CLAUDE.md` from manifest.
- `CLAUDE.md`: replace the header section (project description, version, data-model summary, directory tree) but preserve the .claude/rules/ reference block and the session-start checklist verbatim.
- `docs/configuration.md`: replace `MYAPP_*` env-var prefixes with `${upper_name}_*`. Phase 2 already did this in sed; the docs template re-renders to capture any prose changes.
- Em-dash sweep on every file the script generated or touched (skip `.claude/rules/*` per the template-lineage rule).
- Commit: `docs: rewrite README, CONCEPT, ROADMAP, CLAUDE.md for ${name}`.

### Phase 8: sanity sweep

10 checks (exit-1 with a report on any failure):

1. **Placeholders clean**: `grep -rE 'myapp|MyApp|MYAPP|EXAMPLE-DOMAIN' --include='*.py' --include='*.ts' --include='*.tsx' --include='*.yaml' --include='*.yml' --include='*.json' --include='*.toml' --include='*.md' --include='*.sh' --include='*.cmd' --include='*.ps1' --include='*.html' --include='*.css' --include='*.txt'` returns nothing in the target tree (excluding `.git/`, `node_modules/`, `__pycache__/`).
2. **`# TEMPLATE:` / `// TEMPLATE:` markers clean** in all generated files (matchers: those file paths the script wrote).
3. **No em-dashes (U+2014)** in script-generated/sed-touched files. `.claude/rules/*.md` is exempt.
4. **Backend boots**: `python -c "from app.main import app; assert app.title == '<pascal_name>'; assert app.version == '<version-from-pyproject>'"` (with `MYAPP_TEST=1` + memory DB to avoid touching real data, per the test-isolation rule). Note: the env-var name shifts to `${UPPER_NAME}_TEST` after phase 2 rename — the check uses the post-rename name.
5. **Backend pytest green**: `cd backend && poetry run pytest`.
6. **Plugin pytest green**: iterate `plugins/<name>-plugin-*/` and run pytest in each. Skip cleanly if `plugins/` is empty.
7. **Frontend build green**: `cd frontend && npm run build`.
8. **Frontend Vitest green**: `cd frontend && npm run test`.
9. **Pre-commit green**: `pre-commit run --all-files`.
10. **Frontend type-check green**: `cd frontend && npx tsc --noEmit`.

Each check captures stdout/stderr to `<target>/.bootstrap-phase8-<check-num>.log` for diagnostics on failure.

If everything is green: write `.bootstrap-complete` stamp + commit: `chore: bootstrap phase 8 sanity sweep`. If anything is red: leave the tree on the phase-7 commit, print the failing-check log path, exit 1.

## Idempotency strategy

- Self-bootstrap guard (see above) blocks running on the template root.
- `.bootstrap-complete` stamp at the target root blocks re-runs cleanly.
- Phase 1 detects an already-initialised git tree at `--target-dir` and refuses. Phase 1's `cp -r` does NOT overwrite an existing target directory; the script exits 1 if `--target-dir` exists and is non-empty.
- `--dry-run` exercises every guard without writing.

## What we deliberately do NOT cover

(Matches the prompt's NO list.)

1. **The first plugin (phase 5).** Manifest doesn't have a `plugins:` section. The script can render a minimal `plugins/<name>-plugin-example/` skeleton on opt-in (`--with-example-plugin`), but doesn't fill the importer logic.
2. **Frontend per-page UX.** Stubs only; tree widgets, optimistic updates, drag-drop, search bars belong to the next session.
3. **i18n catalog content beyond placeholders.** Two keys per language. Real strings ship with real pages.
4. **The Playwright e2e journey spec.** A one-line smoke spec is generated; the journey is written when the journey exists.
5. **Auto-detecting domain from natural language.** Manifest is the contract; the human or an AI writes it.
6. **Windows support.** Linux + macOS only.
7. **Generating new template dependencies.** Bash + Python stdlib only.

## Verification (integration test)

Tag: `slow`. Skipped in CI unless `RUN_BOOTSTRAP_TEST=1` is set.

Location: `tests/test_bootstrap_integration.py` (at repo root, NOT under `backend/tests/`, since it exercises the full repo).

Test body:

1. `tmp = mkdtemp()`.
2. `bootstrap-app.sh --manifest scripts/bootstrap/example-manifest.yaml --target-dir $tmp/topos-replay`.
3. Assert phase-8 checks pass (re-implemented in Python; the test does not shell out to a Topos checker).
4. `cd $tmp/topos-replay && make install && make test` (this is the slow bit; ~10 minutes locally).
5. `git log --oneline | wc -l` returns exactly 7 commits (phases 1, 2, 3, 4, 6, 7, 8).
6. `grep -rE 'myapp|MyApp|MYAPP' $tmp/topos-replay --exclude-dir=.git --exclude-dir=node_modules` returns empty.

Plus a fast smoke test (always-on in CI): runs `bootstrap-app.sh --dry-run` against the example manifest and asserts the planned file list matches a snapshot. Catches manifest-schema regressions without paying the install/test cost.

## Open questions (resolved)

All six resolved at sign-off; recorded at the top of this doc. Kept here as historical pointer only.

## Implementation order

If signed off:

1. `scripts/bootstrap/example-manifest.yaml` (already shipped with this PR as the working reference).
2. `scripts/bootstrap/example_domain_inventory.json` (derived from current template by inspection).
3. `scripts/bootstrap/templates/*.tpl` (all of them, derived from Topos commits).
4. `scripts/bootstrap/bootstrap.py` (the engine).
5. `scripts/bootstrap/bootstrap-app.sh` (the wrapper).
6. `tests/test_bootstrap_integration.py` (fast smoke + slow full).
7. `scripts/bootstrap/README.md` (user-facing one-pager).
8. Verify against the example manifest end-to-end; iterate.

Estimated work: a focused day for templates + engine + tests if no surprises in the existing template structure surface during template extraction. Two days realistic with verification iterations.
