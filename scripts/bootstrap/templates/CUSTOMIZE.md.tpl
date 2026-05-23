# What the bootstrap did, and what is still on you

The `scripts/bootstrap/bootstrap-app.sh` script (from the
`pluginforge-app-template`) generated this repository for the
`${pascal_name}` application. This file records what landed
automatically and what the next session (human or AI) needs to do
by hand.

## What the script did

- **Phase 1 (bootstrap)**: copied the template tree, severed the
  template `.git`, initialised a fresh `${name}` repo on `main`.
- **Phase 2 (rename)**: sed-swept the template's placeholder
  strings to `${name}` / `${pascal_name}` / `${upper_name}` across
  every text file, plus the launcher dir/icon/spec renames + the
  pyproject/package metadata rewrites.
- **Phase 3 (domain)**: deleted the template's example domain
  (Book/Chapter/Article/...) and generated ${entity_count} new
  entities (${entity_names}) with models + schemas + migration.
- **Phase 4 (CRUD)**: generated services + routers + integration
  tests per entity. Wired the routers into `backend/app/main.py`
  between the `BOOTSTRAP-ANCHOR-{BEGIN,END}` markers.
- **Phase 6 (frontend shell)**: generated `src/types/`,
  `src/db/schema.ts`, `src/api/client.ts`,
  `src/hooks/use${pascal_name}.ts`, NavBar + App.tsx, plus
  stub pages per entity. Page bodies are intentionally
  minimal so the build stays green.
- **Phase 7 (docs)**: rendered this file, `README.md`,
  `README-de.md`, `docs/CONCEPT.md`, `docs/ROADMAP.md`,
  `docs/configuration.md`, and the `CLAUDE.md` header.
- **Phase 8 (sweep)**: ran the 10-check sanity sweep before
  committing.

## What is still on you

1. **Frontend UX.** Every stub page renders one heading + a TODO
   note. Real CRUD UI lives in `frontend/src/pages/<Entity>List.tsx`
   and `<Entity>Detail.tsx`. The api client + hooks are already
   wired, so the implementation is straightforward.

2. **First plugin.** The plugin loader is wired and `plugins/` is
   empty. Start with `plugins/${name}-plugin-<name>/` following
   the pattern in `plugins/README.md`. Every plugin class must
   declare `target_application = "${name}"`.

3. **Full i18n catalogs.** The script wrote two keys per language
   (`ui.app.name`, `ui.app.description`); the rest of the catalogs
   are bare. Populate them as pages get real strings.

4. **Domain-specific narrative.** `docs/CONCEPT.md` has TODO
   markers for the longer-form vision section, the deliberate
   non-features list, and the out-of-scope list. `docs/ROADMAP.md`
   has a TODO marker for the deferred-items list.

5. **`.claude/rules/lessons-learned.md`.** This file is inherited
   from the template lineage. Some entries are universal; some are
   sibling-app-specific. Prune entries that do not apply to
   ${pascal_name}.

6. **Branding.** Replace `frontend/public/favicon.ico` and
   `frontend/public/icon-*.png` with your icons. Update the
   PyInstaller plist fields in `launcher/${name}-launcher.spec`.

7. **Migrations.** ${migration_state}

## Verifying

```bash
make install
make test
make dev
```

The sanity sweep already passed on commit; if `make test` regresses,
the most likely culprit is a forgotten manual change in a
generated file. The `BOOTSTRAP-ANCHOR-{BEGIN,END}` markers in
`backend/app/main.py` are stable insertion points if a future
re-run of the script needs to re-wire routers; everything else is
generated once and yours to edit.
