# TEMPLATE: This test is included as adaptable example.
# Replace with your domain logic when project domain is finalized.

"""Tests for the three-layer config loader.

Layer chain: project app.yaml < user override file < env-vars.
Covers XDG path, MYAPP_CONFIG_DIR redirect, deep merge precedence,
env-var overrides, deprecation warning, and graceful
corrupt-override handling.

The loader lives in :mod:`app.main`; we import the helpers
directly and monkeypatch CONFIG_PATH + override-path resolution
per test so each case is hermetic.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

import pytest
import yaml

from app import main as main_module


@pytest.fixture
def project_yaml(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Stand up a fresh project app.yaml + override path in tmp_path
    and monkeypatch the loader so it reads from there. Returns the
    project yaml path so tests can write content to it.

    Each test gets its own tmp_path so override-file presence,
    env-var state, AND the v0.32.x ``config_overlay`` user-overlay
    file are isolated from any state a previous test may have
    written into the session-scope ``MYAPP_DATA_DIR``.
    """
    project = tmp_path / "app.yaml"
    project.write_text("", encoding="utf-8")
    monkeypatch.setattr(main_module, "CONFIG_PATH", project)
    override = tmp_path / "secrets.yaml"
    monkeypatch.setattr(main_module, "_get_user_override_path", lambda: override)
    # Isolate the v0.32.x config-overlay layer too: point
    # MYAPP_DATA_DIR at a per-test tmp so leftover writes from
    # earlier tests (Settings PATCH, plugin install/uninstall) do
    # not pollute the merged view this loader returns.
    monkeypatch.setenv("MYAPP_DATA_DIR", str(tmp_path / "user-data"))
    # Always start with a clean env so env-var tests opt-in.
    monkeypatch.delenv("MYAPP_AI_API_KEY", raising=False)
    return project


def _write(path: Path, data: dict) -> None:
    path.write_text(yaml.safe_dump(data), encoding="utf-8")


def test_project_only_baseline(project_yaml: Path) -> None:
    """Without override + env-vars, merged config equals project."""
    _write(project_yaml, {"ai": {"provider": "anthropic", "api_key": ""}})
    cfg = main_module._load_app_config()
    assert cfg["ai"]["provider"] == "anthropic"
    assert cfg["ai"]["api_key"] == ""


def test_override_only_ai_key(project_yaml: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Override file supplies ai.api_key; project has empty value."""
    _write(project_yaml, {"ai": {"provider": "anthropic", "api_key": ""}})
    override = main_module._get_user_override_path()
    _write(override, {"ai": {"api_key": "sk-from-override"}})
    cfg = main_module._load_app_config()
    assert cfg["ai"]["api_key"] == "sk-from-override"
    # Project keys preserved.
    assert cfg["ai"]["provider"] == "anthropic"


def test_nested_merge_precedence(project_yaml: Path) -> None:
    """Override touches one nested key; siblings + parents preserved."""
    _write(
        project_yaml,
        {
            "ai": {
                "provider": "anthropic",
                "api_key": "",
                "model": "claude-sonnet-4-20250514",
            },
            "app": {"name": "MyApp"},
        },
    )
    override = main_module._get_user_override_path()
    _write(override, {"ai": {"api_key": "sk-override"}})
    cfg = main_module._load_app_config()
    assert cfg["ai"]["api_key"] == "sk-override"
    assert cfg["ai"]["provider"] == "anthropic"
    assert cfg["ai"]["model"] == "claude-sonnet-4-20250514"
    assert cfg["app"]["name"] == "MyApp"


def test_env_var_beats_project_and_override(
    project_yaml: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """MYAPP_AI_API_KEY wins against both project and override."""
    _write(project_yaml, {"ai": {"api_key": "from-project"}})
    override = main_module._get_user_override_path()
    _write(override, {"ai": {"api_key": "from-override"}})
    monkeypatch.setenv("MYAPP_AI_API_KEY", "from-env")
    cfg = main_module._load_app_config()
    assert cfg["ai"]["api_key"] == "from-env"


def test_deprecation_warning_when_secret_in_project_only(
    project_yaml: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """Project carries non-empty api_key + no override + no env-var
    → WARNING logged with file path + migration hint."""
    _write(project_yaml, {"ai": {"api_key": "sk-leaked-into-project"}})
    # Override file does NOT exist; env-var unset (fixture clears it).
    with caplog.at_level(logging.WARNING, logger="app.main"):
        triggered = main_module._has_project_secret_without_override()
    assert triggered is True


def test_no_deprecation_warning_when_override_exists(
    project_yaml: Path, caplog: pytest.LogCaptureFixture
) -> None:
    """Override file present silences the deprecation hint even when
    project still has the legacy key."""
    _write(project_yaml, {"ai": {"api_key": "sk-leaked"}})
    override = main_module._get_user_override_path()
    _write(override, {"ai": {"api_key": "sk-override"}})
    triggered = main_module._has_project_secret_without_override()
    assert triggered is False


def test_xdg_config_home_respected(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """XDG_CONFIG_HOME env-var redirects the override path on
    Linux/macOS."""
    monkeypatch.setattr("sys.platform", "linux")
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "xdg"))
    path = main_module._get_user_override_path()
    assert path == tmp_path / "xdg" / "myapp" / "secrets.yaml"


def test_myapp_config_dir_env_redirects(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """MYAPP_CONFIG_DIR env-var (the explicit override consumed by
    ``app.paths.get_config_dir``) redirects the secrets path.

    Replaces the prior platform-branch tests (Windows ``%APPDATA%``)
    after ``_get_user_override_path`` was refactored to delegate to
    ``app.paths.get_config_dir`` (which uses ``platformdirs``).
    Platform-specific branches now live inside platformdirs and are
    covered by its own suite; the contract we own is the
    ``MYAPP_CONFIG_DIR`` redirect.
    """
    custom = tmp_path / "custom_config"
    monkeypatch.setenv("MYAPP_CONFIG_DIR", str(custom))
    path = main_module._get_user_override_path()
    assert path == (custom / "secrets.yaml").resolve()


def test_corrupt_override_file_does_not_crash(
    project_yaml: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Malformed override yaml falls back to project config + logs
    WARNING. Backend MUST start (loader returns project dict, never
    raises).

    Three corruption shapes covered:
    - invalid YAML syntax
    - top-level non-dict (e.g. list)
    - empty file (None)

    Spies on ``logger.warning`` directly because other tests in the
    suite reconfigure the ``app.main`` logger and the standard
    ``caplog`` fixture cannot reliably intercept that logger
    cross-test (same pattern used in test_backup_articles.py for
    the forward-compat manifest warning).
    """
    _write(project_yaml, {"ai": {"provider": "anthropic", "api_key": "from-project"}})
    override = main_module._get_user_override_path()

    captured: list[str] = []
    original_warning = main_module.logger.warning

    def spy(msg: str, *args: object, **kwargs: object) -> None:
        captured.append(msg % args if args else msg)
        original_warning(msg, *args, **kwargs)

    monkeypatch.setattr(main_module.logger, "warning", spy)

    # Match production usage: a chmod 0o600 file does not trip the
    # "permissive mode" warning that _load_override_file emits
    # separately. The corruption assertions below are about YAML-parse
    # warnings, not permission warnings.
    def _write_override(content: str) -> None:
        override.write_text(content, encoding="utf-8")
        os.chmod(override, 0o600)

    # Invalid YAML syntax.
    _write_override("this is: : : not valid yaml :\n  - broken")
    cfg = main_module._load_app_config()
    assert cfg["ai"]["provider"] == "anthropic"
    assert cfg["ai"]["api_key"] == "from-project"
    assert any("Invalid YAML" in m for m in captured), captured

    # Top-level non-dict.
    captured.clear()
    _write_override("- one\n- two\n")
    cfg = main_module._load_app_config()
    assert cfg["ai"]["api_key"] == "from-project"
    assert any("expected mapping" in m for m in captured), captured

    # Empty file -> silently treated as empty override (no warning).
    captured.clear()
    _write_override("")
    cfg = main_module._load_app_config()
    assert cfg["ai"]["api_key"] == "from-project"
    assert captured == []


def test_lists_are_replaced_not_merged(project_yaml: Path) -> None:
    """Override list replaces base list verbatim. Confirms we don't
    accidentally concatenate; relevant for ``app.supported_languages``,
    ``topics``, etc."""
    _write(project_yaml, {"app": {"supported_languages": ["de", "en", "es"]}})
    override = main_module._get_user_override_path()
    _write(override, {"app": {"supported_languages": ["fr"]}})
    cfg = main_module._load_app_config()
    assert cfg["app"]["supported_languages"] == ["fr"]


def test_deep_merge_helper_pure_function() -> None:
    """``_deep_merge`` is documented as non-mutating; verify."""
    base = {"a": 1, "nested": {"x": 1, "y": 2}}
    override = {"nested": {"y": 99, "z": 3}}
    out = main_module._deep_merge(base, override)
    assert out == {"a": 1, "nested": {"x": 1, "y": 99, "z": 3}}
    # Inputs unchanged.
    assert base == {"a": 1, "nested": {"x": 1, "y": 2}}
    assert override == {"nested": {"y": 99, "z": 3}}
