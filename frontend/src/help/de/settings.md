# Einstellungen

Die Einstellungs-Seite ist der Ort, an dem du MyApp konfigurierst.

## Bereiche

- **Allgemein**: Sprache, Theme, Standardansicht.
- **KI-Anbieter**: Trage hier deine API-Schlüssel für KI-Anbieter ein.
- **Plugins**: Installierte Plugins aktivieren, deaktivieren und konfigurieren.

## API-Schlüssel und Geheimnisse

API-Schlüssel können aus vier Quellen stammen, in dieser Reihenfolge:

1. Umgebungsvariablen (z. B. `MYAPP_AI_API_KEY`)
2. `~/.config/myapp/secrets.yaml` (wird beim ersten Start mit sicheren Rechten angelegt)
3. Benutzer-Overlay über die Einstellungs-Oberfläche
4. Projekt-Standardwerte in `backend/config/app.yaml`

Wenn ein Schlüssel über eine Umgebungsvariable oder die secrets-Datei kommt, sperrt die Einstellungs-Oberfläche das Eingabefeld und zeigt die Quelle an.

> Dies ist eine Platzhalter-Seite. Passe sie an die Bereiche deines Projekts an.
