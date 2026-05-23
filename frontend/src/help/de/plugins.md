# Plugins

MyApp nutzt PluginForge, um optionale Funktionen als eigenständige Pakete zu laden.

## Was ist ein Plugin?

Ein Plugin ist ein Python-Paket, das unter der Entry-Point-Gruppe `myapp.plugins` registriert ist. Der Host lädt es beim Start, ruft seine Hooks auf und kann UI-Erweiterungen aus dem Frontend-Manifest des Plugins einblenden.

## Plugin installieren

Öffne **Einstellungen > Plugins**, klicke auf **Plugin installieren** und wähle das Plugin-ZIP. Der Plugin-Name darf nur aus Kleinbuchstaben, Ziffern und Bindestrichen bestehen.

## Plugin konfigurieren

Plugin-Einstellungen liegen in `backend/config/plugins/{name}.yaml`. Einstellungen, die für Nutzer editierbar sein sollen, werden in **Einstellungen > Plugins > {Plugin-Name}** angezeigt. Einstellungen mit `# INTERNAL` sind nur per YAML editierbar.

## Plugin deaktivieren

Schalte das Plugin in **Einstellungen > Plugins** aus. Es bleibt installiert, aber es laufen keine Hooks mehr und keine UI-Slots werden gemountet.

> Dies ist eine Platzhalter-Seite. Passe sie an die Plugins deines Projekts an.
