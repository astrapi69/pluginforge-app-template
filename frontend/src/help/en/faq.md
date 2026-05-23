# FAQ

## Where is my data stored?

By default in your platform's user data directory:

- Linux/macOS: `~/.local/share/myapp/`
- Windows: `%LOCALAPPDATA%\myapp\`

Override with the `MYAPP_DATA_DIR` environment variable.

## Does the app need an internet connection?

The core app works offline. Plugins that call external services (AI providers, online dictionaries, etc.) need network access; their READMEs document this.

## Can I sync data between machines?

Not out of the box. The data directory is a SQLite database plus filesystem assets; you can sync it manually or via your own backup tool.

> This is a placeholder page. Customize the answers your users actually ask.
