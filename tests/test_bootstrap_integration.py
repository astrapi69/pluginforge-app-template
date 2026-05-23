"""Integration tests for ``scripts/bootstrap/bootstrap.py``.

Two layers:

- **Fast (always-on)**: a ``--dry-run`` snapshot test that exercises
  manifest validation + template loading + the renderers + the
  inventory parser, without touching disk outside ``/tmp``. Catches
  regressions in the engine surface without paying the
  ``make install`` cost.
- **Slow (opt-in)**: runs the full bootstrap end to end against the
  example manifest, verifies every Phase 8 check passes, runs
  ``make install`` + ``make test`` from the resulting tree, and
  asserts the git commit chain matches the documented phase
  sequence. Tagged ``slow``; skipped unless
  ``RUN_BOOTSTRAP_INTEGRATION=1``.

The slow path runs ``poetry install`` + ``npm install`` inside the
bootstrapped tree and therefore takes ~10 minutes on a warm machine
and burns disk. Do not run in CI by default; trigger explicitly.
"""

from __future__ import annotations

import ast
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
BOOTSTRAP_DIR = REPO_ROOT / "scripts" / "bootstrap"
EXAMPLE_MANIFEST = BOOTSTRAP_DIR / "example-manifest.yaml"


# Make bootstrap.py importable without poetry shell games.
sys.path.insert(0, str(BOOTSTRAP_DIR))
import bootstrap  # noqa: E402  (sys.path manipulation must come first)


# --- fast: always-on snapshot test --------------------------------------


def test_manifest_loads_with_expected_topos_shape() -> None:
    """The example manifest must parse cleanly and produce the Topos
    entity set. Catches manifest-schema regressions early."""
    manifest = bootstrap.load_manifest(EXAMPLE_MANIFEST)
    assert manifest.app.name == "topos"
    assert manifest.app.pascal_name == "Topos"
    assert manifest.app.upper_name == "TOPOS"
    assert [e.name for e in manifest.entities] == ["Container", "Item", "Category", "Action"]
    assert any(e.behaviour == "tree" for e in manifest.entities)


def test_inventory_is_ready_and_paths_resolve() -> None:
    """The EXAMPLE-DOMAIN inventory must be in ``ready`` state and every
    path it lists must exist in the template tree at the time the test
    runs (the inventory is built against ``main``; drift would invalidate
    it)."""
    inventory = bootstrap._load_inventory()
    assert inventory["status"] == "ready", inventory
    assert inventory["delete_count"] == len(inventory["delete"])
    missing = [p for p in inventory["delete"] if not (REPO_ROOT / p).exists()]
    assert not missing, (
        f"{len(missing)} inventory paths missing from template tree. "
        f"First 5: {missing[:5]}. Rebuild the inventory against the current main."
    )


def test_all_backend_renderers_produce_valid_python() -> None:
    """Every per-entity backend file (model, schema, service, router,
    test) must parse with ``ast.parse``. Re-renderable across the Topos
    example manifest catches engine regressions early."""
    manifest = bootstrap.load_manifest(EXAMPLE_MANIFEST)
    renderers = [
        ("model", bootstrap.render_model),
        ("schema", bootstrap.render_schema),
        ("service", bootstrap.render_service),
        ("router", bootstrap.render_router),
        ("router_test", bootstrap.render_router_test),
    ]
    failures: list[str] = []
    for entity in manifest.entities:
        for kind, renderer in renderers:
            rendered = renderer(entity, manifest)
            try:
                ast.parse(rendered)
            except SyntaxError as exc:
                failures.append(f"{entity.name}.{kind}: {exc.msg} at line {exc.lineno}")
    assert not failures, "Renderer output failed AST parse:\n" + "\n".join(failures)


def test_init_files_render_clean() -> None:
    manifest = bootstrap.load_manifest(EXAMPLE_MANIFEST)
    for fn in (bootstrap.render_models_init, bootstrap.render_schemas_init):
        ast.parse(fn(manifest))


def test_shell_templates_render_with_topos_values() -> None:
    """The three shell templates (main.py, exceptions.py, hookspecs.py)
    must render as valid Python when substituted with manifest values."""
    manifest = bootstrap.load_manifest(EXAMPLE_MANIFEST)
    app = manifest.app
    shells = [
        ("main.py.shell.tpl", {
            "name": app.name, "pascal_name": app.pascal_name,
            "upper_name": app.upper_name, "description": app.description,
        }),
        ("exceptions.py.shell.tpl", {"pascal_name": app.pascal_name}),
        ("hookspecs.py.shell.tpl", {"name": app.name, "pascal_name": app.pascal_name}),
    ]
    for tpl, mapping in shells:
        rendered = bootstrap._render(tpl, **mapping)
        ast.parse(rendered)


def test_dry_run_does_not_touch_target_dir(tmp_path: Path) -> None:
    """`--dry-run` against the example manifest must complete without
    creating any files in the target dir."""
    target = tmp_path / "topos-replay"
    assert not target.exists()
    ctx = bootstrap.BootstrapContext(
        template_root=REPO_ROOT,
        target_dir=target,
        manifest=bootstrap.load_manifest(EXAMPLE_MANIFEST),
        dry_run=True,
    )
    bootstrap.phase1_bootstrap(ctx)
    bootstrap.phase2_rename(ctx)
    bootstrap.phase3_domain_swap(ctx)
    bootstrap.phase4_crud(ctx)
    bootstrap.phase6_frontend_shell(ctx)
    bootstrap.phase7_docs(ctx)
    bootstrap.phase8_sanity_sweep(ctx)
    assert not target.exists(), f"dry-run leaked files into {target}"


def test_self_bootstrap_refused(tmp_path: Path) -> None:
    """The CLI must refuse to bootstrap the template into itself."""
    with pytest.raises(SystemExit):
        bootstrap._refuse_self_bootstrap(REPO_ROOT, REPO_ROOT)


def test_manifest_validation_rejects_unsupported_field_type() -> None:
    """The manifest validator must reject field types outside the
    closed set (int, str, datetime, bool, float, enum, fk)."""
    raw = {
        "app": {"name": "x", "pascal_name": "X", "upper_name": "X"},
        "entities": [{
            "name": "Y", "plural": "ys",
            "fields": [{"name": "blob", "type": "json"}],
        }],
    }
    import tempfile
    import yaml
    with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False) as fh:
        yaml.safe_dump(raw, fh)
        path = Path(fh.name)
    try:
        with pytest.raises(bootstrap.ManifestError) as exc_info:
            bootstrap.load_manifest(path)
        assert "unsupported type" in str(exc_info.value)
    finally:
        path.unlink()


# --- slow: full end-to-end run ------------------------------------------


@pytest.mark.skipif(
    os.environ.get("RUN_BOOTSTRAP_INTEGRATION") != "1",
    reason="slow: set RUN_BOOTSTRAP_INTEGRATION=1 to run (~10 min)",
)
def test_full_bootstrap_end_to_end(tmp_path: Path) -> None:
    """Run the full bootstrap against the example manifest.

    Checks:
    - Bootstrap completes without raising.
    - Every Phase 8 check passes (the engine raises SystemExit otherwise).
    - ``.bootstrap-complete`` stamp exists.
    - git log shows the expected commit chain (one commit per phase).
    - ``make test`` is green from a fresh ``make install``.
    """
    target = tmp_path / "topos-replay"

    bootstrap_app = BOOTSTRAP_DIR / "bootstrap-app.sh"
    result = subprocess.run(
        [str(bootstrap_app),
         "--manifest", str(EXAMPLE_MANIFEST),
         "--target-dir", str(target)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"bootstrap-app.sh exited {result.returncode}.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )

    assert (target / ".bootstrap-complete").exists(), \
        ".bootstrap-complete stamp missing; phase 8 did not pass"

    # Provenance file should record what we bootstrapped against.
    provenance = json.loads((target / ".bootstrap-provenance.json").read_text())
    assert provenance["manifest_app_name"] == "topos"

    # git log: one commit per phase. Phase 5 (plugin skeleton) is skipped
    # without --with-example-plugin, so the chain is phases 1, 2, 3, 4, 6, 7, 8.
    log = subprocess.run(
        ["git", "log", "--oneline"],
        cwd=target, capture_output=True, text=True, check=True,
    )
    commit_lines = log.stdout.strip().splitlines()
    assert len(commit_lines) == 7, f"expected 7 commits, got {len(commit_lines)}:\n{log.stdout}"

    # The first commit's message should reference the template.
    first_commit = subprocess.run(
        ["git", "log", "--reverse", "--format=%s", "-1"],
        cwd=target, capture_output=True, text=True, check=True,
    )
    assert "pluginforge-app-template" in first_commit.stdout

    # Sanity check the post-bootstrap tree: no placeholders, the new
    # entity files exist.
    for entity in ("containers", "items", "categories", "actions"):
        assert (target / "backend" / "app" / "models" / f"{entity}.py").exists()
        assert (target / "backend" / "app" / "routers" / f"{entity}.py").exists()
        assert (target / "backend" / "tests" / "routers" / f"test_{entity}.py").exists()

    # Run make install + make test from inside the bootstrapped tree.
    install = subprocess.run(
        ["make", "install"], cwd=target, capture_output=True, text=True,
        timeout=900,  # 15-minute cap on the install step
    )
    assert install.returncode == 0, (
        f"make install failed:\n{install.stdout}\n{install.stderr}"
    )

    test = subprocess.run(
        ["make", "test"], cwd=target, capture_output=True, text=True,
        timeout=900,
    )
    assert test.returncode == 0, (
        f"make test failed:\n{test.stdout}\n{test.stderr}"
    )


@pytest.mark.skipif(
    os.environ.get("RUN_BOOTSTRAP_INTEGRATION") != "1",
    reason="slow: set RUN_BOOTSTRAP_INTEGRATION=1 to run",
)
def test_bootstrap_refuses_non_empty_target_dir(tmp_path: Path) -> None:
    """Non-empty target dir must abort cleanly (no --force flag)."""
    target = tmp_path / "occupied"
    target.mkdir()
    (target / "existing-file").write_text("hi")
    result = subprocess.run(
        [str(BOOTSTRAP_DIR / "bootstrap-app.sh"),
         "--manifest", str(EXAMPLE_MANIFEST),
         "--target-dir", str(target)],
        cwd=REPO_ROOT,
        capture_output=True, text=True,
    )
    assert result.returncode != 0, "non-empty target should abort"
    assert "non-empty" in (result.stdout + result.stderr).lower()
    # The existing file should be untouched.
    assert (target / "existing-file").read_text() == "hi"
