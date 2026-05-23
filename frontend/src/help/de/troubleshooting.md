# Fehlerbehebung

## Die App startet nicht

Sieh dir die Launcher-Logdatei im Datenverzeichnis an. Häufige Ursachen:

- Port 8000 ist bereits von einem anderen Prozess belegt.
- Backend-Abhängigkeiten fehlen, mit `make install` neu installieren.

## Das Frontend zeigt "Network error"-Toasts

Das Backend ist eventuell nicht erreichbar. Prüfe, ob der Backend-Prozess auf Port 8000 läuft.

## Ein Plugin lädt nicht

In **Einstellungen > Plugins** erscheint neben dem Plugin-Namen eine Fehlermeldung. Die Log-Einträge des Plugins finden sich im Backend-Log.

## Wie melde ich einen Fehler?

Toasts zu 5xx-Fehlern enthalten einen **Issue melden**-Link. Er öffnet ein vorbefülltes GitHub-Issue mit Fehlerdetails, Stacktrace, Browser und App-Version.

> Dies ist eine Platzhalter-Seite. Ergänze die Probleme, die deine Nutzer wirklich melden.
