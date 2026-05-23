# Bootstrap script

Turns this template into a new application from a YAML manifest. The
prompt and design rationale live in `DESIGN.md`; this README is the
quick reference.

## Run

```bash
scripts/bootstrap/bootstrap-app.sh \
    --manifest scripts/bootstrap/example-manifest.yaml \
    --target-dir /tmp/topos-replay
```

Required flags:

- `--manifest <path>`: a YAML file describing the app + entities. See
  `example-manifest.yaml` for the working Topos reference.
- `--target-dir <absolute-path>`: must NOT exist, OR must be empty. The
  script will not overwrite a non-empty directory; run `rm -rf` and
  retry if you need to redo a bootstrap.

Optional flags:

- `--dry-run`: print the plan, no disk writes.
- `--skip-migration`: skip `alembic revision --autogenerate`. Writes a
  `.bootstrap-migration-pending` stamp at the target root so you know
  to run it manually after `make install`.
- `--with-example-plugin`: also writes a minimal plugin skeleton at
  `plugins/<app.name>-plugin-example/`. Default is off; most apps will
  add plugins as their domain matures.
- `--verbose`: more logging.

## What the script does

Eight phases, each one a single git commit on the bootstrapped tree:

1. **bootstrap**: copy template tree, fresh `git init`, provenance file.
2. **rename**: sed `myapp/MyApp/MYAPP -> app.name/app.pascal_name/app.upper_name`
   across the documented file extensions; rename launcher dir + icon +
   spec + `.myapp-production`; rewrite pyproject + package.json
   metadata.
3. **domain swap**: delete EXAMPLE-DOMAIN (per
   `example_domain_inventory.json`), render new models + schemas from
   the manifest, gut i18n catalogs, insert `BOOTSTRAP-ANCHOR` markers
   in `backend/app/main.py`, generate fresh Alembic migration.
4. **CRUD**: render services + routers + integration tests per entity,
   replace the `BOOTSTRAP-ANCHOR` block with router wiring.
5. **plugin skeleton** (opt-in): write a minimal
   `plugins/<app.name>-plugin-example/` package + entry point.
6. **frontend shell**: render `types/`, `db/schema.ts`,
   `api/client.ts`, `hooks/use<PascalName>.ts`, `NavBar.tsx`,
   `App.tsx`, plus stub `<Entity>List.tsx` + `<Entity>Detail.tsx`
   per entity with Vitest smoke tests.
7. **docs**: render `README.md`, `README-de.md`, `docs/CONCEPT.md`,
   `docs/ROADMAP.md`, `CUSTOMIZE.md`, `CLAUDE.md` from the manifest.
8. **sanity sweep**: 10 checks (placeholders, TEMPLATE markers, em-dashes,
   backend boots, pytest, plugin pytest, frontend build, Vitest,
   pre-commit, tsc).

## What the script does NOT do

- The first real plugin's body (importer / exporter / etc.). Only the
  skeleton, and only if `--with-example-plugin` is set.
- Frontend page UX. Pages render `<h1>EntityName</h1>` + a TODO. The
  api client, types, hooks, db schema are complete; the UI body is
  the next session's job.
- Real i18n catalog content. The script writes two keys per language;
  pages get real strings as they get real UX.
- Playwright E2E specs beyond a one-line smoke.
- Auto-detect the user's domain from natural language. The manifest is
  the contract; a human or AI writes it by interviewing the user.

## Idempotency

The script refuses to run if:

- `--target-dir` resolves to the template repo root (self-bootstrap
  guard).
- `--target-dir` already exists and is non-empty (you must
  `rm -rf` first).

There is no `--force` flag; force-overwriting a tree is a footgun
that's harder to debug than to prevent.

## Re-running CRUD wiring after manifest changes

The `BOOTSTRAP-ANCHOR-{BEGIN,END}` markers in `backend/app/main.py`
are stable insertion points. A future tool can re-render the router
wiring without disturbing surrounding code by replacing the content
between the markers. For now: hand-edit the wiring when you add an
entity.

## Status (May 2026)

Two pieces are gated on the template's parallel lineage-prune PR
landing:

- `example_domain_inventory.json` is a stub. Phase 3 logs a warning
  and skips the EXAMPLE-DOMAIN deletion until the inventory is
  finalized against the post-prune template.
- Phase 8 sanity sweep is partial. Some checks reference docs that
  may not survive the prune (`check-mkdocs-orphans`,
  `verify-mkdocs-nav`).

The integration test under `tests/test_bootstrap_integration.py`
is also gated; it needs the final template state to assert against.

The implementable surface (manifest schema, templates, phases 1, 2,
4, 6, 7, opt-in plugin skeleton, em-dash sweep) is in place and
runnable today against any template state - it just won't pass
the full sanity sweep until the gating clears.
