# Settings

The Settings page is where you configure MyApp.

## Sections

- **General**: language, theme, default view.
- **AI providers**: paste your API keys for any AI providers you use.
- **Plugins**: enable, disable, and configure installed plugins.

## API keys and secrets

API keys can come from any of four sources, in order of precedence:

1. Environment variables (e.g. `MYAPP_AI_API_KEY`)
2. `~/.config/myapp/secrets.yaml` (created automatically with secure permissions on first start)
3. User overlay set through the Settings UI
4. Project defaults in `backend/config/app.yaml`

When a key is owned by an env-var or the secrets file, the Settings UI disables the input and explains where the key is coming from.

> This is a placeholder page. Customize it with the settings sections your project actually ships.
