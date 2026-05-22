# Architecture rules

## Layered architecture (4 layers, ALWAYS respected)

```
1. Frontend        React + TypeScript + Vite
2. Backend         FastAPI + SQLAlchemy + SQLite + Pydantic v2
3. PluginForge     External PyPI package (pluginforge ^0.10.0), based on pluggy
4. Plugins         Standalone packages, registered via entry points
```

New features ALWAYS belong in a plugin, unless they touch the
core (the domain entities the template's CRUD wraps, the UI
shell, settings, backup/restore).

## Two repositories

| Repo | Purpose | License |
|------|---------|---------|
| `pluginforge` | Application-agnostic plugin framework (PyPI) | MIT |
| `myapp` | The application built on this template | MIT |

PluginForge is EXTERNAL. Changes to PluginForge are a separate repo and a separate release cycle. This app pins `pluginforge ^0.10.0`.

## Backend (Python/FastAPI)

### Structure per plugin

```
plugins/myapp-plugin-{name}/
  myapp_{name}/
    plugin.py          # {Name}Plugin(BasePlugin), hook implementations
    routes.py          # FastAPI router (delegates to service functions)
    {module}.py        # business logic (no FastAPI code here)
  tests/
    test_{name}.py     # pytest tests
  pyproject.toml       # entry point: [project.entry-points."myapp.plugins"]
```

### Rules

- Plugin class inherits from BasePlugin (pluginforge).
- Plugin class declares `target_application = "myapp"` so the host's hard-filter accepts it (see CLAUDE.md).
- Business logic in its own modules, NOT in routes.py.
- routes.py contains only FastAPI endpoints that delegate to service functions.
- Hook specs live in backend/app/hookspecs.py. Define new hooks there, with api_version.
- Pydantic v2 for all request/response schemas.
- SQLAlchemy models in backend/app/models/.
- Configuration via YAML (backend/config/plugins/{name}.yaml), NOT hardcoded.
- Extend i18n strings in backend/config/i18n/{lang}.yaml (the directory listing is the canonical language list).
- Plugin dependencies as a class attribute: `depends_on = ["other-plugin"]`.
- All plugins ship MIT by default. Licensing infrastructure exists but is dormant (`LICENSING_ENABLED = False`); set `license_tier = "core"` on every plugin class until you wire a paid tier.

### Plugin installation (ZIP)

Third-party plugins are installed as a ZIP through Settings > Plugins:
1. The ZIP must contain: plugin.yaml, a Python package with plugin.py
2. Extraction to plugins/installed/{name}/
3. Config to config/plugins/{name}.yaml
4. Dynamic registration via sys.path + PluginManager
5. Plugin names: lowercase letters, digits, hyphens only
6. Path traversal check on ZIP paths

### Licensing

- App-specific, NOT part of PluginForge.
- Code in backend/app/licensing.py.
- HMAC-SHA256 signed license keys, offline-validatable.
- Licenses in config/licenses.json, managed through the Settings UI.
- Format: MYAPP-{PLUGIN}-v{N}-{base64 payload}.{base64 signature}

## Frontend (React/TypeScript)

### UI component strategy

| Library | Purpose |
|---------|---------|
| Radix UI | Unstyled accessible primitives (Dialog, Tabs, Dropdown, Select, Tooltip) |
| @dnd-kit | Drag-and-drop (list reordering, sortable surfaces) |
| Lucide React | Icons |
| react-toastify | Toast notifications |

Rejected: shadcn/ui (requires Tailwind), MUI (too opinionated), Ant Design (too heavy).

If the app needs a rich-text editor, pick one explicitly (TipTap,
Lexical, ProseMirror) and document the choice in CLAUDE.md plus
a `.claude/rules/lessons-learned.md` entry for its specific
quirks. The template ships no editor by default.

### Theming

- CSS custom properties drive all colors, spacing, and tokens.
- New UI elements MUST use CSS variables, not hex literals.
- No Tailwind. Custom properties live in `frontend/src/styles/global.css`.
- Audit recipe to enumerate current themes: `grep -oE 'data-app-theme="[a-z-]+"' frontend/src/styles/global.css | sort -u`.

### Plugin UI (manifest-driven)

Plugins declare UI extensions via `get_frontend_manifest()`. The frontend queries `/api/plugins/manifests`.

Define the slot vocabulary in `CLAUDE.md` once your UI shell is
in place. Typical slot kinds: action buttons in a sidebar /
toolbar, panels next to a primary edit surface, settings
sections, and per-feature extension points. Keep the vocabulary
small; one slot per visually distinct mounting point.

For complex plugin UIs: Web Components as custom elements (compiled JS bundle in the plugin ZIP).

### Component structure

- Pages in `frontend/src/pages/`.
- Shared components in `frontend/src/components/`.
- API calls ONLY through `frontend/src/api/client.ts`, never `fetch()` directly in components.

### UX patterns for forms

- **Stepped modal** for creation dialogs: step 1 shows only required fields, step 2 is collapsible (Radix Collapsible, "More details") for optional fields.
- **Reason:** modals stay compact for quick creation, optional fields don't clutter it.
- **Collapsible:** Radix Collapsible (@radix-ui/react-collapsible) for expandable sections in modals. Collapsed when opened.
- **Input fields with suggestions:** `<input>` + `<datalist>` for free text with dropdown suggestions. No hard select when custom values should be possible.
- **Conditional fields:** checkbox toggle for optional groups. Values are reset when deactivated.
- **No dedicated page** for simple creation workflows. A modal is enough up to ~8 fields.

### State management

- Default: React state + props. No global state management.
- If global state becomes necessary: introduce Zustand, NOT Redux.
- Stores communicate through events or callbacks, not through direct imports.

## Internal storage format

Pick the canonical in-DB shape for each non-trivial content type
deliberately (JSON, HTML, Markdown, or a domain-specific schema)
and document it in CLAUDE.md. Conversions (e.g. JSON ↔
Markdown, HTML ↔ Markdown) are plugin responsibilities, not
core, so the core schema stays one shape per field.

## Persistence

- Backend: SQLAlchemy + SQLite.
- Frontend: no local storage for primary data. Everything via the API.
- Assets: local on the filesystem, served through `/api/assets/`.
- Backup / restore: the template ships scaffolding (`backend/app/backup_history.py`); pick a serialized format that round-trips your domain.

## Data flow

```
UI (React) -> API client -> FastAPI router -> service/plugin -> SQLAlchemy -> SQLite
```

Unidirectional. No direct DB access from routers. No frontend code in the backend.

## Error handling

```
Frontend       ApiError (status + detail) -> toast for the user
API client     HTTP error -> converted to ApiError
Router         Thin, catches nothing. Global exception handler maps.
Service        Throws MyAppError subclasses (NotFoundError, ValidationError, ...)
Plugin         Throws PluginError(plugin_name, message)
External       ExternalServiceError(service, message) for wrapped subprocess / HTTP failures
```

Services NEVER throw HTTPException, routers catch NOTHING. The global exception handler in main.py maps MyAppError subclasses to HTTP status codes. See code-hygiene.md "Error handling architecture" for details.

## Plugin package versions

Plugin versions are independent of the app version. A plugin is bumped only when the plugin itself changed, not on every app release. Concretely:

- No forced bump of every `plugins/myapp-plugin-*/pyproject.toml` on an app release
- Plugin versions stay at `1.0.0` until there is a real reason to raise them (new hook version, breaking change in the plugin API, ...)
- The app version bump only touches `backend/pyproject.toml`, `frontend/package.json`, and the derived locations the version-sync tool propagates to
- Plugin changes are recorded in the app CHANGELOG, but the plugin version string stays unchanged

Reason: plugins have their own lifecycles, and trial keys / license keys are bound to the plugin name, not to the version. A bump without a change would only create noise.

## Plugin settings visibility

Every plugin setting in `config/plugins/*.yaml` MUST either:

1. Be editable in the plugin UI (Settings > Plugins > {plugin name}), OR
2. Be marked with a `# INTERNAL` comment to signal that it can only be edited via YAML.

Hidden settings that influence user behavior without a UI are forbidden. A setting that has a default value and changes how the app behaves MUST be visible and editable by the user.

Exceptions are allowed only for:
- Debug and development settings (marked `# INTERNAL`)
- Performance-tuning parameters that only power users should touch (marked `# INTERNAL` + comment)
- Initialization values or pipeline mappings that are not a user configuration target

Dead settings (fields in the YAML that the code never reads) are forbidden. When adding a new setting, ALWAYS verify that the code reads it; when removing a feature, ALWAYS remove the corresponding YAML field with it.

Per-entity vs per-app: settings that should vary between rows
of a given entity do NOT belong in `config/plugins/*.yaml` but
as a column on the model. Plugin-global YAML settings are only
for values that must be the same for every row.

## Offline/local-first

- SQLite as the default (no external DB required).
- Assets local on the filesystem.
- Frontend deliverable as static files.
- License validation offline (signed keys, no license server).
- Exception: plugins with external APIs (TTS, AI, third-party services) need network access; document the dependency on the plugin's README.
