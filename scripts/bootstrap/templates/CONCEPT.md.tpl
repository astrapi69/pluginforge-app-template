# ${pascal_name} - concept

**Repository:** [${repository_short}](${repository_url})
**Built on:** [PluginForge](https://github.com/astrapi69/pluginforge) (PyPI: pluginforge ^0.10.0)
**Sibling projects:**
[pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template) (the scaffold ${pascal_name} was bootstrapped from),
[adaptive-learner](https://github.com/astrapi69/adaptive-learner),
[bibliogon](https://github.com/astrapi69/bibliogon)

This document describes the architecture and the concept. For
runtime configuration see [configuration.md](configuration.md); for
the current backlog see [ROADMAP.md](ROADMAP.md).

---

## 1. Goal

${description}

> TODO: replace this section with the longer-form narrative for
> ${pascal_name}: who it serves, what the user does with it, the
> shape of the seed data, any deliberate non-features. The
> bootstrap script can only template the one-liner; the full vision
> belongs to the human / AI session that follows.

---

## 2. Domain model

${pascal_name} ships ${entity_count} entities:

${entity_summary_block}

The wiring shape (model -> schema -> router -> service -> tests)
mirrors the convention used by sibling PluginForge applications.

---

## 3. Architecture

Standard four-layer split inherited from the template:

1. **Frontend**: React 18 + TypeScript + Vite. Dexie used as a
   read-through cache; backend is the source of truth.
2. **Backend**: FastAPI + SQLAlchemy 2.0 + SQLite + Pydantic v2.
3. **PluginForge**: external PyPI package (pluginforge ^0.10.0).
4. **Plugins**: standalone packages registered via entry points
   under group `${name}.plugins`. Plugin classes declare
   `target_application = "${name}"`.

See `.claude/rules/architecture.md` for the full rules.

---

## 4. Tech stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite,
  Pydantic v2, Poetry
- **Frontend:** React 18+, TypeScript (strict), Vite, Dexie,
  Radix UI, Lucide, react-toastify
- **Plugins:** pluginforge ^0.10.0
- **Launcher:** PyInstaller-based cross-OS desktop launcher
- **Testing:** pytest, Vitest, Playwright
- **Tooling:** Poetry, npm, Docker, Make, ruff, ESLint, Prettier,
  pre-commit

---

## 5. Out of scope

> TODO: list the things ${pascal_name} deliberately does NOT do.
> Cloud-SaaS, native mobile, multi-user auth, WYSIWYG editing, AI
> features are typical candidates depending on the project.

---

## 6. Extension points

New features go in plugins. The plugin scaffold lives under
`plugins/`; entry-point group is `${name}.plugins`. Plugin classes
inherit from PluginForge's `BasePlugin` and set
`target_application = "${name}"`.
