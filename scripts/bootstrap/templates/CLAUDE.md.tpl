# ${pascal_name}

${description}

- **Repository:** ${repository_url}
- **Concept:** [docs/CONCEPT.md](docs/CONCEPT.md)
- **Roadmap:** [docs/ROADMAP.md](docs/ROADMAP.md)
- **Configuration:** [docs/configuration.md](docs/configuration.md)
- **API reference:** FastAPI OpenAPI under `/api/docs`

## Ecosystem

${pascal_name} is part of a small family of MIT-licensed projects:

- **[pluginforge](https://github.com/astrapi69/pluginforge)** - application-agnostic plugin framework, distributed via PyPI. The runtime backbone of ${pascal_name}.
- **[pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template)** - the scaffold ${pascal_name} was bootstrapped from.
- **[adaptive-learner](https://github.com/astrapi69/adaptive-learner)** - sibling application built on the same template.
- **[bibliogon](https://github.com/astrapi69/bibliogon)** - book-authoring sibling.

## Development guidelines

Detailed rules live in `.claude/rules/`. They generalise patterns
learned in `adaptive-learner` / `bibliogon`. Prune entries that turn
out to be specific to those projects' domains.

**Always relevant** (read on every feature/fix):
- `architecture.md` - layered architecture, plugin structure, UI strategy, data flow
- `coding-standards.md` - naming, function design, tests, dependencies

**On demand** (read for specific tasks):
- `code-hygiene.md` - linting, pre-commit, error handling architecture, API conventions
- `lessons-learned.md` - known pitfalls (carried over; prune as you customize)
- `quality-checks.md` - test strategy, pre-commit checklists
- `ai-workflow.md` - order for features/plugins, prohibitions, docs protocol
- `release-workflow.md` - release process

On a conflict between CLAUDE.md and the rules, the rules win.

## Tech stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2, Poetry
- **Frontend:** React 18+, TypeScript (strict), Vite, Dexie, Radix UI, Lucide, react-toastify
- **Plugins:** pluginforge ^0.10.0 (PyPI), entry points under group `${name}.plugins`. Plugin classes declare `target_application = "${name}"`.
- **Launcher:** PyInstaller-based cross-OS desktop launcher (`launcher/`)
- **Testing:** pytest, Vitest, Playwright
- **Tooling:** Poetry, npm, Docker, Make, ruff, ESLint, Prettier, pre-commit

## Commands

```bash
make install              # Poetry + npm + plugins
make dev                  # backend (8000) + frontend (5173) in parallel
make dev-bg / dev-down    # background mode
make test                 # backend + frontend, no coverage
make test-coverage        # opt-in coverage run
make test-backend         # backend only
make test-frontend        # Vitest
make prod                 # Docker Compose
make prod-down            # stop Docker
make clean                # remove build artifacts
make help                 # all targets
```

E2E tests: `npx playwright test --project=smoke` or `--project=full`.

## Session start (Claude Code)

1. `git log --oneline -10` - recent changes
2. `make test` - green baseline
3. Read this file + relevant rules per the task

## Data model

${pascal_name} ships ${entity_count} entities:

${entity_summary_block}

See `backend/app/models/` for the SQLAlchemy declarations and
`backend/app/schemas/` for the Pydantic shapes used at the API
boundary.

## Plugins

The scaffold ships with **zero plugins**. The loader infrastructure
(`backend/app/hookspecs.py`, PluginForge bootstrap in
`backend/app/main.py`, `backend/app/import_plugins/` registry) is
in place; add plugins as your domain matures. See
`plugins/README.md` for the minimal plugin layout.

## Launcher

Cross-OS desktop launcher under `launcher/`, packaged with
PyInstaller. Produces a single-file installer-launcher binary per
OS that bootstraps the backend, opens the frontend in the user's
browser, and manages auto-update + uninstall.

## Directory structure (short)

```
${name}/
├── backend/app/           # FastAPI core
├── backend/config/        # app.yaml, i18n/
├── backend/tests/         # backend tests
├── plugins/               # empty placeholder + README
├── frontend/src/
│   ├── api/client.ts      # typed API client
│   ├── components/        # shared UI primitives
│   ├── db/schema.ts       # Dexie read-through cache
│   ├── hooks/             # stale-while-revalidate hooks
│   ├── pages/             # stub pages (TODO: fill UX)
│   └── types/             # domain types (camelCase)
├── e2e/                   # Playwright specs
├── launcher/              # cross-OS PyInstaller launcher
├── docs/                  # CONCEPT, ROADMAP, configuration
└── Makefile, docker-compose.yml, ...
```

## Core conventions

- i18n: ${supported_languages_count} languages, all UI strings in `backend/config/i18n/{lang}.yaml`
- Python: type hints, snake_case, Pydantic v2, SQLAlchemy 2.0 mapped columns
- TypeScript: strict mode, no `any`, Radix UI for primitives
- CSS: custom properties, dark mode via `[data-theme="dark"]`
- Commits: English, conventional (feat/fix/refactor/docs)
- E2E: `data-testid` selectors only
- Secrets NEVER in committed config files
