# Troubleshooting

## The app does not start

Check the launcher's log file in the data directory. Common causes:

- Port 8000 already in use by another process.
- Backend dependencies missing, reinstall with `make install`.

## The frontend shows "Network error" toasts

The backend may not be reachable. Check that the backend process is running on port 8000.

## A plugin does not load

Check **Settings > Plugins** for an error message next to the plugin name. The plugin's log entries appear in the backend log.

## How do I report a bug?

5xx error toasts include a **Report issue** link that opens a pre-filled GitHub issue with the error detail, stack trace, browser, and app version.

> This is a placeholder page. Add the issues your users actually hit.
