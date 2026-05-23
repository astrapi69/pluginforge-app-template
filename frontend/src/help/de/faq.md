# FAQ

## Wo werden meine Daten gespeichert?

Standardmäßig im Nutzer-Datenverzeichnis deiner Plattform:

- Linux/macOS: `~/.local/share/myapp/`
- Windows: `%LOCALAPPDATA%\myapp\`

Über die Umgebungsvariable `MYAPP_DATA_DIR` lässt sich der Pfad überschreiben.

## Braucht die App eine Internet-Verbindung?

Die Kern-App läuft offline. Plugins, die externe Dienste nutzen (KI-Anbieter, Online-Wörterbücher usw.), benötigen Netzwerk-Zugriff; das steht in der jeweiligen Plugin-README.

## Kann ich Daten zwischen Geräten synchronisieren?

Nicht von Haus aus. Das Datenverzeichnis ist eine SQLite-Datenbank plus Datei-Assets; du kannst es manuell oder mit eigenem Backup-Tool synchronisieren.

> Dies ist eine Platzhalter-Seite. Passe die Antworten an die Fragen deiner Nutzer an.
