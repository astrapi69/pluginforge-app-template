# ${pascal_name}

> ${description}

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

${pascal_name} is a ${short_tagline}. Built on
[PluginForge](https://github.com/astrapi69/pluginforge) using the
[pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template)
scaffold. Runs as an offline-first PWA in the browser or as a
cross-platform desktop app via the bundled PyInstaller launcher.

Deutsche Version: [README-de.md](README-de.md).

## Domain

${entity_summary_block}

## Ecosystem

${pascal_name} is one of a family of MIT-licensed projects:

- [pluginforge](https://github.com/astrapi69/pluginforge) - the
  application-agnostic plugin framework ${pascal_name} runs on
- [pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template) -
  the scaffold ${pascal_name} was bootstrapped from
- [adaptive-learner](https://github.com/astrapi69/adaptive-learner),
  [bibliogon](https://github.com/astrapi69/bibliogon) - sibling
  applications

## Quick start

```bash
git clone ${repository_url}.git
cd ${name}
make install              # Poetry (backend + launcher) + npm (frontend)
make test                 # backend pytest + frontend Vitest
make dev                  # backend on :8000, frontend on :5173
```

Open <http://localhost:5173> in the browser. The API docs live at
<http://localhost:8000/api/docs>.

## Status

Bootstrap stage. The domain is wired (CRUD endpoints, types, hooks,
db cache) but the frontend pages are stubs. The next AI / human
session fills the UX.

## Configuration

Settings live in `backend/config/app.yaml`. Secrets such as
`${upper_name}_SECRET_KEY` belong in `~/.config/${name}/secrets.yaml`
or in environment variables; never commit them. See the user-home
template that is auto-created on first start.

## License

MIT. See [LICENSE](LICENSE).
