# ${pascal_name}

> ${description}

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

${pascal_name} ist ${short_tagline_de}. Aufgebaut auf
[PluginForge](https://github.com/astrapi69/pluginforge) mit dem
[pluginforge-app-template](https://github.com/astrapi69/pluginforge-app-template)
als Grundgerüst. Läuft als Offline-first-PWA im Browser oder als
plattformübergreifende Desktop-Anwendung über den mitgelieferten
PyInstaller-Launcher.

English version: [README.md](README.md).

## Domäne

${entity_summary_block_de}

## Schnellstart

```bash
git clone ${repository_url}.git
cd ${name}
make install              # Poetry (Backend + Launcher) + npm (Frontend)
make test                 # Backend-pytest + Frontend-Vitest
make dev                  # Backend auf :8000, Frontend auf :5173
```

<http://localhost:5173> im Browser öffnen. Die API-Dokumentation
liegt unter <http://localhost:8000/api/docs>.

## Status

Bootstrap-Phase. Die Domäne ist verdrahtet (CRUD-Endpunkte, Typen,
Hooks, DB-Cache); die Frontend-Seiten sind Platzhalter. Die nächste
AI- oder Menschen-Sitzung füllt die UX.

## Konfiguration

Einstellungen liegen in `backend/config/app.yaml`. Secrets wie
`${upper_name}_SECRET_KEY` gehören in `~/.config/${name}/secrets.yaml`
oder in Umgebungsvariablen; nie eincheckbar. Siehe die
User-Home-Vorlage, die beim ersten Start automatisch erzeugt wird.

## Lizenz

MIT. Siehe [LICENSE](LICENSE).
