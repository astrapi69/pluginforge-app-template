"""${pascal_name} backend application entry point.

Slim FastAPI shell written by the bootstrap script at phase 3. Phase 4
adds the entity routers between the BOOTSTRAP-ANCHOR markers below.
"""

from __future__ import annotations

import logging
import os
import shutil
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import yaml
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pluginforge import BasePlugin, PluginManager
from pluginforge.config import load_i18n

from app import __version__
from app.database import init_db
from app.exceptions import ${pascal_name}Error
from app.hookspecs import ${pascal_name}HookSpec
from app.licensing import LicenseError, LicenseStore, LicenseValidator
from app.logging_config import setup_logging
from app.middleware.body_size_limit import (
    BodySizeLimitMiddleware,
    _resolve_max_bytes_from_config,
)
from app.routers import licenses, plugin_install, settings

setup_logging()
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "config" / "app.yaml"
CONFIG_EXAMPLE_PATH = BASE_DIR / "config" / "app.yaml.example"

if not CONFIG_PATH.exists() and CONFIG_EXAMPLE_PATH.exists():
    shutil.copy2(CONFIG_EXAMPLE_PATH, CONFIG_PATH)
    logger.info("Created config/app.yaml from app.yaml.example")

DEBUG = os.getenv("${upper_name}_DEBUG", "true").lower() in ("true", "1", "yes")
CORS_ORIGINS = os.getenv("${upper_name}_CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
SECRET_KEY = os.getenv("${upper_name}_SECRET_KEY", "")


def _get_user_override_path() -> Path:
    """Return the user-home secrets-override file path.

    Gradle-style layered config: project ``app.yaml`` provides
    defaults, this file (gitignored, outside the project tree)
    overlays user secrets, env-vars override both.

    Resolves via ``app.paths.get_config_dir()`` so the location can be
    redirected via the ``${upper_name}_CONFIG_DIR`` env var and stays in sync
    with the rest of the platformdirs-driven path helpers. Defaults to
    ``~/.config/${name}/secrets.yaml`` on Linux/macOS and
    ``%APPDATA%\\${name}\\secrets.yaml`` on Windows.
    """
    from app.paths import get_config_dir

    return get_config_dir() / "secrets.yaml"


_SECRETS_TEMPLATE_BODY = """\
# ${pascal_name} - API Keys
# Uncomment and fill in your keys below.
# These take precedence over keys configured in the Settings UI.
# Environment variables override this file.

# secret_key: "generate-with-python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"

# ai:
#   anthropic:
#     api_key: "sk-ant-..."
#   openai:
#     api_key: "sk-..."
#   gemini:
#     api_key: "AIza..."
"""


def _ensure_secrets_template(path: Path) -> None:
    """Create the parent config dir and a commented-out secrets template
    at ``path`` if neither exists yet.

    Idempotent. On Linux/macOS the file is chmod 0o600 on creation so
    only the owning user can read it. Logs at INFO level so the user
    sees the path on first startup; never logs key values.
    """
    parent = path.parent
    parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return
    path.write_text(_SECRETS_TEMPLATE_BODY, encoding="utf-8")
    try:
        os.chmod(path, 0o600)
    except OSError as exc:
        # chmod is best-effort: irrelevant on Windows, harmless when
        # the umask already restricts. A failure here is not a reason
        # to abort startup.
        logger.warning("Could not chmod 0o600 on %s: %s", path, exc)
    logger.info("Config directory: %s", parent)
    logger.info("Secrets template created at %s", path)


_perms_warned: set[Path] = set()


def _warn_if_secrets_perms_too_open(path: Path) -> None:
    """Emit a WARNING when ``path`` is readable by group or other on
    POSIX. No-op on Windows (different ACL model).

    Deduplicated per path per process: ``_load_app_config`` is called
    per-request so without the dedup the warning would spam the log.
    """
    if sys.platform == "win32":
        return
    if path in _perms_warned:
        return
    try:
        mode = path.stat().st_mode
    except OSError:
        return
    if mode & 0o077:
        logger.warning(
            "Secrets file %s has permissive mode %o; recommend chmod 600.",
            path,
            mode & 0o777,
        )
        _perms_warned.add(path)


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """Recursive dict merge with override-wins semantics.

    Lists are REPLACED, not concatenated. Non-dict values in ``override``
    replace the corresponding ``base`` value.

    Returns a new dict; ``base`` and ``override`` are not mutated.
    """
    out: dict[str, Any] = dict(base)
    for key, override_value in override.items():
        base_value = out.get(key)
        if isinstance(base_value, dict) and isinstance(override_value, dict):
            out[key] = _deep_merge(base_value, override_value)
        else:
            out[key] = override_value
    return out


# Mapping of env-var name -> dotted-path inside the merged config dict.
# Top-level ``secret_key`` plus per-provider AI keys. ``ai.api_key`` is
# retained as a legacy slot consumed by the current Settings UI and
# the AI router; the per-provider Settings UI in a follow-up will
# supersede it. Plugin yaml secrets follow in a separate refactor
# (PluginManager loader has its own config path and reload machinery).
_ENV_SECRET_OVERRIDES: dict[str, tuple[str, ...]] = {
    "${upper_name}_SECRET_KEY": ("secret_key",),
    "${upper_name}_AI_API_KEY": ("ai", "api_key"),
    "${upper_name}_ANTHROPIC_API_KEY": ("ai", "anthropic", "api_key"),
    "${upper_name}_OPENAI_API_KEY": ("ai", "openai", "api_key"),
    "${upper_name}_GEMINI_API_KEY": ("ai", "gemini", "api_key"),
}


def _apply_env_overrides(config: dict[str, Any]) -> dict[str, Any]:
    """Overlay environment-variable values onto the merged config dict.

    Env-vars sit at the top of the config chain (project < override <
    env). Used for CI/Docker/12-Factor deployment where secrets come
    from the orchestrator. Returns a new dict; ``config`` is not
    mutated.
    """
    out = dict(config)
    for env_name, path in _ENV_SECRET_OVERRIDES.items():
        env_value = os.environ.get(env_name)
        if env_value is None or env_value == "":
            continue
        # Walk into nested dicts, creating them as needed.
        cursor: dict[str, Any] = out
        for segment in path[:-1]:
            existing = cursor.get(segment)
            cursor[segment] = dict(existing) if isinstance(existing, dict) else {}
            cursor = cursor[segment]
        cursor[path[-1]] = env_value
    return out


def _load_override_file(path: Path) -> dict[str, Any]:
    """Read the user-override yaml file. Returns ``{}`` when the file
    is missing, malformed, or yields a non-dict top-level value.

    Backend MUST start successfully even with a corrupt override file:
    the goal of the override layer is to add secrets, not to gate
    startup. A WARNING log on the first call is enough to surface the
    issue without crashing.
    """
    if not path.exists():
        return {}
    _warn_if_secrets_perms_too_open(path)
    try:
        with path.open(encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as exc:
        logger.warning(
            "Invalid YAML in override file %s: %s. Continuing with project config only.",
            path,
            exc,
        )
        return {}
    except OSError as exc:
        logger.warning(
            "Could not read override file %s: %s. Continuing with project config only.",
            path,
            exc,
        )
        return {}
    if data is None:
        return {}
    if not isinstance(data, dict):
        logger.warning(
            "Override file %s top-level is %s, expected mapping. "
            "Continuing with project config only.",
            path,
            type(data).__name__,
        )
        return {}
    return data


def _load_app_config() -> dict[str, Any]:
    """Read app.yaml + user overlay + secrets override + env-vars.

    Four-layer merge:

    1. Project ``app.yaml`` (defaults shipped with the app).
    2. User-overlay ``<data_dir>/config/app.yaml`` (Settings UI writes;
       see ``app.config_overlay``).
    3. Secrets override ``~/.config/${name}/secrets.yaml`` (user-home
       secrets file). Expected shape::

           secret_key: "..."
           ai:
             api_key: "..."         # legacy single-provider slot
             anthropic:
               api_key: "..."
             openai:
               api_key: "..."
             gemini:
               api_key: "..."

    4. Environment variables (``${upper_name}_SECRET_KEY``,
       ``${upper_name}_AI_API_KEY``, ``${upper_name}_ANTHROPIC_API_KEY``,
       ``${upper_name}_OPENAI_API_KEY``, ``${upper_name}_GEMINI_API_KEY``).

    Higher layers win. Lists REPLACE; dicts deep-merge. Called
    per-request where freshness matters; cheap (small yaml files,
    no caching needed).
    """
    from app import config_overlay

    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            project = yaml.safe_load(f) or {}
    except Exception:
        project = {}
    user_overlay = config_overlay._read_yaml(config_overlay._user_app_path())
    override = _load_override_file(_get_user_override_path())
    merged = _deep_merge(project, user_overlay)
    merged = _deep_merge(merged, override)
    return _apply_env_overrides(merged)


_startup_config = _load_app_config()
_license_secret = SECRET_KEY or _startup_config.get("licensing", {}).get(
    "secret_key", "pluginforge-default-key"
)
_license_file = _startup_config.get("licensing", {}).get("store_path", "config/licenses.json")
license_validator = LicenseValidator(_license_secret)
license_store = LicenseStore(BASE_DIR / _license_file)


def _check_license(plugin: BasePlugin, _plugin_config: dict[str, Any]) -> bool:
    """Pre-activate callback: permit core plugins, validate premium keys."""
    from app.licensing import LICENSING_ENABLED

    if not LICENSING_ENABLED:
        return True

    tier = getattr(plugin, "license_tier", "core")
    if tier == "core":
        return True

    key = license_store.get(plugin.name) or license_store.get("*")
    if not key:
        logger.info("Premium plugin '%s' blocked: no license key", plugin.name)
        return False
    try:
        license_validator.validate_license(key, plugin.name)
        return True
    except LicenseError:
        logger.info("Premium plugin '%s' blocked: invalid/expired license", plugin.name)
        return False


manager = PluginManager(
    config_path=str(CONFIG_PATH),
    pre_activate=_check_license,
    api_version="1",
    app_id="${name}",
    app_version=__version__,
)
manager.register_hookspecs(${pascal_name}HookSpec)


def _sync_manager_with_overlay() -> None:
    from app import config_overlay

    config_overlay.refresh_manager_overlay(manager, notify=False)


_sync_manager_with_overlay()

licenses.configure(manager, license_validator, license_store)
settings.configure(
    BASE_DIR,
    manager,
    license_store=license_store,
    license_validator=license_validator,
)
plugin_install.configure(BASE_DIR, manager)


def _load_installed_plugins() -> None:
    """Add ZIP-installed and bundled plugin directories to sys.path."""
    installed_dir = BASE_DIR / "plugins" / "installed"
    if installed_dir.exists():
        for plugin_dir in installed_dir.iterdir():
            if plugin_dir.is_dir() and (plugin_dir / "plugin.yaml").exists():
                path_str = str(plugin_dir)
                if path_str not in sys.path:
                    sys.path.insert(0, path_str)

    bundled_dir = BASE_DIR.parent / "plugins"
    if bundled_dir.exists():
        for plugin_dir in bundled_dir.iterdir():
            if plugin_dir.is_dir() and plugin_dir.name.startswith("${name}-plugin-"):
                path_str = str(plugin_dir)
                if path_str not in sys.path:
                    sys.path.insert(0, path_str)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ${pascal_name} (debug=%s)", DEBUG)
    from app.data_dir_migration import migrate_data_dir_if_needed
    from app.paths import mark_data_dir_as_production

    migrate_data_dir_if_needed()
    mark_data_dir_as_production()
    # Auto-create ~/.config/${name}/ and a commented-out secrets.yaml
    # template on first startup. Skipped under ${upper_name}_TEST=1 so the
    # test suite never touches the user's real config dir (defense in
    # depth alongside conftest's ${upper_name}_DATA_DIR isolation).
    if os.environ.get("${upper_name}_TEST") != "1":
        _ensure_secrets_template(_get_user_override_path())
    init_db()
    _load_installed_plugins()
    manager.discover_plugins()
    manager.mount_routes(app)
    active = [p.name for p in manager.get_active_plugins()]
    logger.info("Plugins loaded (%d): %s", len(active), ", ".join(active) or "none")
    yield
    logger.info("Shutting down ${pascal_name}")
    manager.deactivate_all()


app = FastAPI(
    title="${pascal_name}",
    description="${description}",
    version=__version__,
    lifespan=lifespan,
    docs_url="/api/docs" if DEBUG else None,
    redoc_url="/api/redoc" if DEBUG else None,
)

try:
    _max_upload_bytes = _resolve_max_bytes_from_config(_load_app_config())
except Exception as cfg_exc:
    logger.warning(
        "BodySizeLimitMiddleware: config load failed (%s); using default cap.",
        cfg_exc,
    )
    _max_upload_bytes = 500 * 1024 * 1024

app.add_middleware(BodySizeLimitMiddleware, max_bytes=_max_upload_bytes)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(licenses.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(plugin_install.router, prefix="/api")

# BOOTSTRAP-ANCHOR-BEGIN: entity-routers
# Phase 4 of the bootstrap fills this block with entity router imports and
# include_router calls. The bootstrap engine replaces everything between
# BOOTSTRAP-ANCHOR-BEGIN and BOOTSTRAP-ANCHOR-END on re-runs.
# BOOTSTRAP-ANCHOR-END: entity-routers


@app.exception_handler(${pascal_name}Error)
async def ${name}_error_handler(request: Request, exc: ${pascal_name}Error):
    """Map typed domain errors to HTTP responses (per code-hygiene.md)."""
    if exc.status_code >= 500:
        logger.error("%s %s -> %s", request.method, request.url.path, exc.detail, exc_info=exc)
    else:
        logger.warning(
            "%s %s -> %s %s",
            request.method,
            request.url.path,
            exc.status_code,
            exc.detail,
        )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback

    logger.error(
        "Unhandled error: %s %s -> %s",
        request.method,
        request.url.path,
        str(exc),
        exc_info=True,
    )
    detail: dict[str, Any] = {"detail": str(exc)}
    if DEBUG:
        detail["stacktrace"] = traceback.format_exc()
        detail["endpoint"] = request.url.path
        detail["method"] = request.method
    return JSONResponse(status_code=500, content=detail)


@app.get("/api/plugins/manifests")
def get_plugin_manifests() -> dict[str, Any]:
    result: dict[str, Any] = {}
    for plugin in manager.get_active_plugins():
        manifest = plugin.get_frontend_manifest()
        if manifest:
            result[plugin.name] = manifest
    return result


@app.get("/api/plugins/health")
def get_plugin_health() -> dict[str, Any]:
    return dict(manager.health_check())


@app.get("/api/plugins/errors")
def get_plugin_errors() -> dict[str, str]:
    return dict(manager.get_load_errors())


@app.get("/api/i18n/{lang}")
def get_i18n(lang: str) -> dict[str, Any]:
    return dict(load_i18n(BASE_DIR / "config", lang))


@app.get("/api/health")
def health():
    return {"status": "ok", "version": __version__, "debug": DEBUG}


# --- Stubs required by kept universal infrastructure ---------------------
#
# The kept settings router (``app.routers.settings``) and the kept
# config-loader test (``backend/tests/test_config_loader.py``) reach into
# ``app.main`` for these symbols. They exist as real implementations in
# downstream apps that wire up plugin-status caching and a deprecation
# warning for secrets in the project config. The bootstrap shell ships
# them as no-op stubs so the kept callers import cleanly; replace the
# bodies once the corresponding feature is built out.


def invalidate_plugin_status_cache() -> None:
    """No-op stub. Downstream apps wire this up to clear an
    ``editor/plugin-status`` response cache when settings change."""
    return None


def _has_project_secret_without_override() -> bool:
    """No-op stub. Downstream apps detect the legacy pattern of an API
    key sitting in the project ``app.yaml`` without a user-override and
    log a deprecation hint. The shell returns False (no deprecation)."""
    return False
