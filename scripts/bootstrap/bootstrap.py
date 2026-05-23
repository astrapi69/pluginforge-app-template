#!/usr/bin/env python3
"""pluginforge-app-template bootstrap engine.

Turns the template into a new application from a YAML manifest. See
``scripts/bootstrap/DESIGN.md`` for the design + the Topos reference
chain that drove it. The shell at ``bootstrap-app.sh`` is the only
sanctioned entrypoint; this module is callable directly for tests
and dry-runs.

Phases:

1. bootstrap - copy template tree, fresh git init
2. rename - sed sweep + launcher renames + metadata
3. domain swap - delete EXAMPLE-DOMAIN, render models + schemas, gut i18n
4. CRUD - render services + routers + tests, wire into main.py
5. plugin skeleton - SKIPPED unless --with-example-plugin
6. frontend shell - render types, db, hooks, api client, stub pages
7. docs - render README, CONCEPT, ROADMAP, CUSTOMIZE, CLAUDE
8. sanity sweep - 10 checks (see DESIGN.md)

Each phase is one commit. Pre-commit hooks must pass on each.

Phases 3 (EXAMPLE-DOMAIN deletion list) and 8 (some checks reference
docs that may not survive the parallel lineage-prune PR) are gated
on the prune merging; placeholders below carry GATED-ON-PRUNE markers.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import os
import re
import shutil
import string
import subprocess
import sys
import textwrap
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as exc:
    sys.stderr.write(
        "bootstrap.py needs PyYAML. Install via `pip install pyyaml` or\n"
        "run from the template's Poetry env: `cd backend && poetry run\n"
        "python ../scripts/bootstrap/bootstrap.py ...`.\n",
    )
    raise SystemExit(2) from exc


logger = logging.getLogger("bootstrap")

HERE = Path(__file__).resolve().parent
TEMPLATES_DIR = HERE / "templates"
INVENTORY_PATH = HERE / "example_domain_inventory.json"

# --- types ---------------------------------------------------------------

SUPPORTED_LANGS_DEFAULT = ["de", "en", "es", "fr", "el", "pt", "tr", "ja"]
SUPPORTED_FIELD_TYPES = {"int", "str", "datetime", "bool", "float", "enum", "fk"}
SUPPORTED_BEHAVIOURS = {"standard", "tree"}

SED_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".yaml", ".yml", ".json", ".toml", ".md",
    ".sh", ".cmd", ".ps1", ".html", ".css", ".spec", ".template",
    ".example", ".txt",
}
SED_FILENAMES = {
    "Makefile", "Dockerfile", "LICENSE", ".gitignore", ".dockerignore",
    ".pre-commit-config.yaml", "pre-push",
}

COPY_EXCLUDE_DIRS = {
    ".git", "node_modules", "__pycache__", ".mypy_cache",
    ".pytest_cache", ".ruff_cache", "dist", "build", "uploads",
}
COPY_EXCLUDE_GLOBS = {"*.egg-info", "*.pyc", "*.pyo"}
COPY_EXCLUDE_FILES = {
    ".coverage", "myapp.db", "myapp.db-shm", "myapp.db-wal",
}


@dataclass
class FieldDef:
    name: str
    type: str
    nullable: bool = False
    unique: bool = False
    indexed: bool = False
    max_length: int | None = None
    default: Any = None
    default_now: bool = False
    enum_name: str | None = None
    enum_values: list[str] = field(default_factory=list)
    target: str | None = None
    column: str | None = None


@dataclass
class RelationshipDef:
    kind: str
    target: str
    back_populates: str | None = None
    cascade: str | None = None


@dataclass
class ListFilterDef:
    name: str
    kind: str
    field_name: str


@dataclass
class PathParamDef:
    name: str
    type: str


@dataclass
class QueryParamDef:
    name: str
    type: str
    required: bool = False


@dataclass
class ExtraEndpointDef:
    id: str
    method: str
    path: str
    service_fn: str
    returns: str
    path_params: list[PathParamDef] = field(default_factory=list)
    query_params: list[QueryParamDef] = field(default_factory=list)
    not_found_message: str | None = None
    side_effects: str | None = None
    description: str | None = None


@dataclass
class EntityDef:
    name: str
    plural: str
    table_name: str = ""
    behaviour: str = "standard"
    timestamps: bool = True
    docstring: str = ""
    fields: list[FieldDef] = field(default_factory=list)
    relationships: list[RelationshipDef] = field(default_factory=list)
    list_filters: list[ListFilterDef] = field(default_factory=list)
    extra_endpoints: list[ExtraEndpointDef] = field(default_factory=list)

    @property
    def lower(self) -> str:
        return self.name.lower()


@dataclass
class AppDef:
    name: str
    pascal_name: str
    upper_name: str
    version: str = "0.1.0"
    description: str = ""
    short_tagline: str = ""
    default_language: str = "en"
    supported_languages: list[str] = field(default_factory=lambda: list(SUPPORTED_LANGS_DEFAULT))
    author_name: str = ""
    author_email: str = ""
    repository_url: str = ""


@dataclass
class Manifest:
    app: AppDef
    entities: list[EntityDef]

    @property
    def entity_by_name(self) -> dict[str, EntityDef]:
        return {e.name: e for e in self.entities}


# --- manifest validation -------------------------------------------------


class ManifestError(Exception):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("\n".join(errors))


def load_manifest(path: Path) -> Manifest:
    if not path.exists():
        raise ManifestError([f"manifest not found: {path}"])
    with path.open("r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh)
    if not isinstance(raw, dict):
        raise ManifestError(["manifest must be a YAML mapping at the top level"])

    errors: list[str] = []
    app_raw = raw.get("app")
    entities_raw = raw.get("entities")
    if not isinstance(app_raw, dict):
        errors.append("manifest.app must be a mapping with name/pascal_name/...")
    if not isinstance(entities_raw, list) or not entities_raw:
        errors.append("manifest.entities must be a non-empty list")
    if errors:
        raise ManifestError(errors)

    app = _build_app(app_raw, errors)
    entities: list[EntityDef] = []
    seen_names: set[str] = set()
    for idx, ent_raw in enumerate(entities_raw):
        if not isinstance(ent_raw, dict):
            errors.append(f"entities[{idx}] must be a mapping")
            continue
        ent = _build_entity(ent_raw, idx, errors)
        if ent is None:
            continue
        if ent.name in seen_names:
            errors.append(f"entities[{idx}].name {ent.name!r} duplicates an earlier entity")
            continue
        seen_names.add(ent.name)
        entities.append(ent)

    for ent in entities:
        for f_ in ent.fields:
            if f_.type == "fk" and f_.target not in seen_names:
                errors.append(
                    f"entities[{ent.name}].fields[{f_.name}]: fk target "
                    f"{f_.target!r} not defined as another entity",
                )
        for rel in ent.relationships:
            if rel.target not in seen_names:
                errors.append(
                    f"entities[{ent.name}].relationships: target {rel.target!r} "
                    "not defined as another entity",
                )

    if errors:
        raise ManifestError(errors)
    return Manifest(app=app, entities=entities)


def _build_app(raw: dict, errors: list[str]) -> AppDef:
    name = raw.get("name", "")
    pascal_name = raw.get("pascal_name", "")
    upper_name = raw.get("upper_name", "")
    if not isinstance(name, str) or not re.fullmatch(r"[a-z][a-z0-9_]*", name):
        errors.append(f"app.name must be snake_case lowercase: got {name!r}")
    if not isinstance(pascal_name, str) or not re.fullmatch(r"[A-Z][A-Za-z0-9]*", pascal_name):
        errors.append(f"app.pascal_name must be PascalCase: got {pascal_name!r}")
    if not isinstance(upper_name, str) or not re.fullmatch(r"[A-Z][A-Z0-9_]*", upper_name):
        errors.append(f"app.upper_name must be UPPER_CASE: got {upper_name!r}")

    languages = raw.get("supported_languages", SUPPORTED_LANGS_DEFAULT)
    if not isinstance(languages, list) or not all(isinstance(lang, str) for lang in languages):
        errors.append("app.supported_languages must be a list of strings")
        languages = list(SUPPORTED_LANGS_DEFAULT)

    default_language = raw.get("default_language", languages[0] if languages else "en")
    if default_language not in languages:
        errors.append(
            f"app.default_language {default_language!r} not in supported_languages {languages}",
        )

    return AppDef(
        name=name or "",
        pascal_name=pascal_name or "",
        upper_name=upper_name or "",
        version=str(raw.get("version", "0.1.0")),
        description=raw.get("description", "") or "",
        short_tagline=raw.get("short_tagline", "") or "",
        default_language=default_language,
        supported_languages=list(languages),
        author_name=raw.get("author_name", "") or "",
        author_email=raw.get("author_email", "") or "",
        repository_url=raw.get("repository_url", "") or "",
    )


def _build_entity(raw: dict, idx: int, errors: list[str]) -> EntityDef | None:
    name = raw.get("name", "")
    plural = raw.get("plural", "")
    if not isinstance(name, str) or not re.fullmatch(r"[A-Z][A-Za-z0-9]*", name):
        errors.append(f"entities[{idx}].name must be PascalCase: got {name!r}")
        return None
    if not isinstance(plural, str) or not re.fullmatch(r"[a-z][a-z0-9_]*", plural):
        errors.append(f"entities[{idx}].plural must be snake_case lowercase: got {plural!r}")
        return None

    behaviour = raw.get("behaviour", "standard")
    if behaviour not in SUPPORTED_BEHAVIOURS:
        errors.append(
            f"entities[{name}].behaviour must be one of {sorted(SUPPORTED_BEHAVIOURS)}; "
            f"got {behaviour!r}",
        )
        behaviour = "standard"

    fields_raw = raw.get("fields", [])
    if not isinstance(fields_raw, list) or not fields_raw:
        errors.append(f"entities[{name}].fields must be a non-empty list")
        return None
    fields_list: list[FieldDef] = []
    seen_fields: set[str] = set()
    for fidx, fraw in enumerate(fields_raw):
        if not isinstance(fraw, dict):
            errors.append(f"entities[{name}].fields[{fidx}] must be a mapping")
            continue
        fd = _build_field(name, fraw, fidx, errors)
        if fd is None:
            continue
        if fd.name in seen_fields:
            errors.append(f"entities[{name}].fields: field {fd.name!r} duplicated")
            continue
        seen_fields.add(fd.name)
        fields_list.append(fd)

    relationships_list = []
    for rraw in raw.get("relationships", []) or []:
        if not isinstance(rraw, dict):
            errors.append(f"entities[{name}].relationships: not a mapping: {rraw!r}")
            continue
        kind = rraw.get("kind")
        target = rraw.get("target")
        if kind not in ("has_many", "belongs_to"):
            errors.append(
                f"entities[{name}].relationships.kind must be has_many | belongs_to; "
                f"got {kind!r}",
            )
            continue
        if not isinstance(target, str) or not target:
            errors.append(f"entities[{name}].relationships.target required")
            continue
        relationships_list.append(
            RelationshipDef(
                kind=kind,
                target=target,
                back_populates=rraw.get("back_populates"),
                cascade=rraw.get("cascade"),
            ),
        )

    list_filters: list[ListFilterDef] = []
    for lraw in raw.get("list_filters", []) or []:
        if not isinstance(lraw, dict):
            errors.append(f"entities[{name}].list_filters: not a mapping: {lraw!r}")
            continue
        list_filters.append(
            ListFilterDef(
                name=lraw.get("name", ""),
                kind=lraw.get("kind", "equals"),
                field_name=lraw.get("field", lraw.get("name", "")),
            ),
        )

    extra_endpoints: list[ExtraEndpointDef] = []
    for eidx, eraw in enumerate(raw.get("extra_endpoints", []) or []):
        if not isinstance(eraw, dict):
            errors.append(f"entities[{name}].extra_endpoints[{eidx}] must be a mapping")
            continue
        extra_endpoints.append(
            ExtraEndpointDef(
                id=eraw.get("id", ""),
                method=eraw.get("method", "GET"),
                path=eraw.get("path", ""),
                service_fn=eraw.get("service_fn", ""),
                returns=eraw.get("returns", ""),
                path_params=[
                    PathParamDef(name=p.get("name", ""), type=p.get("type", "str"))
                    for p in eraw.get("path_params", []) or []
                    if isinstance(p, dict)
                ],
                query_params=[
                    QueryParamDef(
                        name=p.get("name", ""),
                        type=p.get("type", "str"),
                        required=bool(p.get("required", False)),
                    )
                    for p in eraw.get("query_params", []) or []
                    if isinstance(p, dict)
                ],
                not_found_message=eraw.get("not_found_message"),
                side_effects=eraw.get("side_effects"),
                description=eraw.get("description"),
            ),
        )

    return EntityDef(
        name=name,
        plural=plural,
        table_name=raw.get("table_name") or plural,
        behaviour=behaviour,
        timestamps=bool(raw.get("timestamps", True)),
        docstring=raw.get("docstring", "") or "",
        fields=fields_list,
        relationships=relationships_list,
        list_filters=list_filters,
        extra_endpoints=extra_endpoints,
    )


def _build_field(entity_name: str, raw: dict, idx: int, errors: list[str]) -> FieldDef | None:
    name = raw.get("name", "")
    type_ = raw.get("type", "")
    if not isinstance(name, str) or not re.fullmatch(r"[a-z][a-z0-9_]*", name):
        errors.append(
            f"entities[{entity_name}].fields[{idx}].name must be snake_case: got {name!r}",
        )
        return None
    if type_ not in SUPPORTED_FIELD_TYPES:
        errors.append(
            f"entities[{entity_name}].fields[{name}]: unsupported type {type_!r}. "
            f"Supported: {sorted(SUPPORTED_FIELD_TYPES)}",
        )
        return None
    fd = FieldDef(
        name=name,
        type=type_,
        nullable=bool(raw.get("nullable", False)),
        unique=bool(raw.get("unique", False)),
        indexed=bool(raw.get("indexed", False)),
        max_length=raw.get("max_length"),
        default=raw.get("default"),
        default_now=bool(raw.get("default_now", False)),
        enum_name=raw.get("enum_name"),
        enum_values=list(raw.get("enum_values") or []),
        target=raw.get("target"),
        column=raw.get("column"),
    )
    if type_ == "str" and fd.max_length is None:
        errors.append(
            f"entities[{entity_name}].fields[{name}]: type 'str' requires max_length",
        )
    if type_ == "enum":
        if not fd.enum_name or not fd.enum_values:
            errors.append(
                f"entities[{entity_name}].fields[{name}]: enum requires enum_name + enum_values",
            )
    if type_ == "fk":
        if not fd.target or not fd.column:
            errors.append(
                f"entities[{entity_name}].fields[{name}]: fk requires target + column",
            )
    return fd


# --- template loading ----------------------------------------------------


def _load_template(rel_path: str) -> string.Template:
    path = TEMPLATES_DIR / rel_path
    if not path.exists():
        raise FileNotFoundError(f"template not found: {rel_path} (looked under {TEMPLATES_DIR})")
    return string.Template(path.read_text(encoding="utf-8"))


def _render(rel_path: str, **mapping: str) -> str:
    return _load_template(rel_path).substitute(mapping)


# --- camel/snake helpers -------------------------------------------------


def to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


def py_type_for(field: FieldDef) -> str:
    if field.type == "int":
        base = "int"
    elif field.type == "str":
        base = "str"
    elif field.type == "datetime":
        base = "datetime"
    elif field.type == "bool":
        base = "bool"
    elif field.type == "float":
        base = "float"
    elif field.type == "enum":
        base = field.enum_name or "str"
    elif field.type == "fk":
        base = "int"
    else:
        raise AssertionError(f"unsupported field type {field.type!r}")
    if field.nullable:
        return f"{base} | None"
    return base


def ts_type_for(field: FieldDef) -> str:
    if field.type == "int":
        base = "number"
    elif field.type == "str":
        base = "string"
    elif field.type == "datetime":
        base = "string"  # ISO-8601 string at the boundary
    elif field.type == "bool":
        base = "boolean"
    elif field.type == "float":
        base = "number"
    elif field.type == "enum":
        base = field.enum_name or "string"
    elif field.type == "fk":
        base = "number"
    else:
        raise AssertionError(f"unsupported field type {field.type!r}")
    if field.nullable:
        return f"{base} | null"
    return base


# --- model rendering -----------------------------------------------------


def render_model(entity: EntityDef, manifest: Manifest) -> str:
    """Render one ``backend/app/models/<plural>.py`` file."""
    stdlib_imports: list[str] = []
    has_datetime = any(f.type == "datetime" for f in entity.fields) or entity.timestamps
    has_enum = any(f.type == "enum" for f in entity.fields)
    if has_datetime:
        stdlib_imports.append("from datetime import datetime")
    if has_enum:
        stdlib_imports.append("from enum import Enum")

    sa_imports: list[str] = []
    if has_datetime:
        sa_imports.append("DateTime")
    if any(f.type == "fk" for f in entity.fields):
        sa_imports.append("ForeignKey")
    if any(f.type == "int" and (f.unique or f.indexed) for f in entity.fields):
        sa_imports.append("Integer")
    if any(f.type == "str" for f in entity.fields):
        sa_imports.append("String")
    if any(f.type == "int" and f.default is not None for f in entity.fields):
        if "Integer" not in sa_imports:
            sa_imports.append("Integer")
    sa_imports_sorted = sorted(set(sa_imports))

    referenced_entities = sorted({rel.target for rel in entity.relationships})
    typing_imports: list[str] = []
    if referenced_entities:
        typing_imports.append("from typing import TYPE_CHECKING")
    has_relationships = bool(entity.relationships)

    imports_lines = ["from __future__ import annotations"]
    if stdlib_imports:
        imports_lines.append("")
        imports_lines.extend(stdlib_imports)
    if typing_imports:
        imports_lines.append("")
        imports_lines.extend(typing_imports)
    imports_lines.append("")
    if sa_imports_sorted:
        imports_lines.append(f"from sqlalchemy import {', '.join(sa_imports_sorted)}")
    if has_enum:
        imports_lines.append("from sqlalchemy import Enum as SAEnum")
    relationship_import = ", relationship" if has_relationships else ""
    imports_lines.append(f"from sqlalchemy.orm import Mapped, mapped_column{relationship_import}")
    imports_lines.append("")
    imports_lines.append("from app.database import Base")
    imports_block = "\n".join(imports_lines)

    if referenced_entities:
        tc_lines = ["", "if TYPE_CHECKING:"]
        for target in referenced_entities:
            target_plural = manifest.entity_by_name[target].plural
            tc_lines.append(f"    from app.models.{target_plural} import {target}")
        type_checking_block = "\n".join(tc_lines) + "\n\n"
    else:
        type_checking_block = ""

    enum_blocks: list[str] = []
    seen_enums: set[str] = set()
    for fd in entity.fields:
        if fd.type == "enum" and fd.enum_name and fd.enum_name not in seen_enums:
            seen_enums.add(fd.enum_name)
            members = "\n".join(
                f"    {value.upper()} = \"{value}\"" for value in fd.enum_values
            )
            enum_blocks.append(f"\nclass {fd.enum_name}(str, Enum):\n{members}\n")
    enum_classes_block = "\n".join(enum_blocks) + ("\n" if enum_blocks else "")

    field_lines = ["    id: Mapped[int] = mapped_column(primary_key=True)"]
    for fd in entity.fields:
        field_lines.append("    " + _render_model_field(fd))
    if entity.timestamps:
        field_lines.append(
            "    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)",
        )
        field_lines.append(
            "    updated_at: Mapped[datetime] = mapped_column(\n"
            "        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow\n"
            "    )",
        )
    field_block = "\n".join(field_lines) + "\n"

    rel_lines: list[str] = []
    for rel in entity.relationships:
        if rel.kind == "has_many":
            cascade = f", cascade=\"{rel.cascade}\"" if rel.cascade else ""
            back = f", back_populates=\"{rel.back_populates}\"" if rel.back_populates else ""
            rel_lines.append(
                f"\n    {rel.target.lower()}s: Mapped[list[{rel.target}]] = relationship(\n"
                f"        {back.lstrip(', ')}{cascade}\n    )",
            )
        else:  # belongs_to
            back = f"back_populates=\"{rel.back_populates}\"" if rel.back_populates else ""
            rel_lines.append(
                f"\n    {rel.target.lower()}: Mapped[{rel.target}] = relationship({back})",
            )
    relationship_lines = "\n".join(rel_lines) + ("\n" if rel_lines else "")

    return _render(
        "models/entity.py.tpl",
        imports_block=imports_block,
        type_checking_block=type_checking_block,
        enum_classes_block=enum_classes_block,
        class_name=entity.name,
        docstring=entity.docstring or f"{entity.name} entity.",
        table_name=entity.table_name,
        field_lines=field_block,
        relationship_lines=relationship_lines,
    )


def _render_model_field(fd: FieldDef) -> str:
    """One ``name: Mapped[...] = mapped_column(...)`` line."""
    py_t = py_type_for(fd)
    column_args: list[str] = []

    if fd.type == "str":
        column_args.append(f"String({fd.max_length})")
    elif fd.type == "int":
        if fd.unique or fd.indexed or fd.default is not None:
            column_args.append("Integer")
    elif fd.type == "datetime":
        column_args.append("DateTime")
    elif fd.type == "enum":
        column_args.append(f"SAEnum({fd.enum_name})")
    elif fd.type == "fk":
        column_args.append(f"ForeignKey(\"{fd.column}\")")

    if fd.unique:
        column_args.append("unique=True")
    if fd.indexed:
        column_args.append("index=True")
    if fd.default_now:
        column_args.append("default=datetime.utcnow")
    elif fd.default is not None:
        if fd.type == "enum" and fd.enum_name:
            const = str(fd.default).upper()
            column_args.append(f"default={fd.enum_name}.{const}")
        elif isinstance(fd.default, str):
            column_args.append(f"default=\"{fd.default}\"")
        else:
            column_args.append(f"default={fd.default!r}")
    elif fd.nullable:
        column_args.append("default=None")

    args = ", ".join(column_args)
    return f"{fd.name}: Mapped[{py_t}] = mapped_column({args})"


def render_models_init(manifest: Manifest) -> str:
    """Render ``backend/app/models/__init__.py``."""
    import_lines: list[str] = []
    all_names: list[str] = []
    summary_lines: list[str] = []
    for ent in manifest.entities:
        symbols: list[str] = [ent.name]
        for fd in ent.fields:
            if fd.type == "enum" and fd.enum_name and fd.enum_name not in symbols:
                symbols.append(fd.enum_name)
        import_lines.append(
            f"from app.models.{ent.plural} import {', '.join(symbols)}",
        )
        all_names.extend(symbols)
        summary_lines.append(f"- ``{ent.name}``: {ent.docstring or 'see module docstring.'}")
    all_block = "\n".join(f"    \"{n}\"," for n in sorted(set(all_names)))
    return _render(
        "models/__init__.py.tpl",
        pascal_name=manifest.app.pascal_name,
        entity_summary="\n".join(summary_lines),
        entity_imports="\n".join(import_lines),
        all_names=all_block,
    )


# --- schema rendering ----------------------------------------------------


def render_schema(entity: EntityDef, manifest: Manifest) -> str:
    """Render one ``backend/app/schemas/<plural>.py`` file."""
    has_datetime = (
        entity.timestamps
        or any(f.type == "datetime" for f in entity.fields)
    )
    has_enum = any(f.type == "enum" for f in entity.fields)

    imports_lines = ["from __future__ import annotations"]
    if has_datetime:
        imports_lines.append("")
        imports_lines.append("from datetime import datetime")
    imports_lines.append("")
    imports_lines.append("from pydantic import BaseModel, ConfigDict")
    if has_enum:
        enum_names = [f.enum_name for f in entity.fields if f.type == "enum" and f.enum_name]
        imports_lines.append(
            f"\nfrom app.models.{entity.plural} import {', '.join(sorted(set(enum_names)))}",
        )
    imports_block = "\n".join(imports_lines)

    create_lines: list[str] = []
    update_lines: list[str] = []
    read_lines = ["    id: int"]

    for fd in entity.fields:
        py_t = py_type_for(fd)
        # Create: required if no nullable + no default; otherwise optional with default.
        if fd.default_now or (fd.type == "datetime" and fd.nullable):
            create_lines.append(f"    {fd.name}: {py_t} | None = None" if fd.nullable
                                else f"    {fd.name}: {py_t} = None")
        elif fd.nullable:
            create_lines.append(f"    {fd.name}: {py_t} = None")
        elif fd.default is not None:
            if fd.type == "enum" and fd.enum_name:
                const = str(fd.default).upper()
                create_lines.append(f"    {fd.name}: {fd.enum_name} = {fd.enum_name}.{const}")
            elif isinstance(fd.default, str):
                create_lines.append(f"    {fd.name}: {py_t} = \"{fd.default}\"")
            else:
                create_lines.append(f"    {fd.name}: {py_t} = {fd.default!r}")
        else:
            create_lines.append(f"    {fd.name}: {py_t}")

        # Update: every field optional.
        update_t = py_t if "| None" in py_t else f"{py_t} | None"
        update_lines.append(f"    {fd.name}: {update_t} = None")

        read_lines.append(f"    {fd.name}: {py_t}")

    if entity.timestamps:
        read_lines.append("    created_at: datetime")
        read_lines.append("    updated_at: datetime")

    tree_node_class = ""
    if entity.behaviour == "tree":
        tree_node_class = (
            f"\n\nclass {entity.name}Node(BaseModel):\n"
            f"    \"\"\"A node in the nested {entity.lower} tree returned by "
            f"``GET /{entity.plural}/tree``.\"\"\"\n\n"
            f"    model_config = ConfigDict(from_attributes=True)\n\n"
            f"    path: str\n"
            f"    name: str\n"
            f"    display_name: str\n"
            f"    level: int\n"
            f"    children: list[{entity.name}Node] = []\n"
        )

    return _render(
        "schemas/entity.py.tpl",
        imports_block=imports_block,
        class_name=entity.name,
        create_fields="\n".join(create_lines),
        update_fields="\n".join(update_lines),
        read_fields="\n".join(read_lines),
        tree_node_class=tree_node_class,
    )


def render_schemas_init(manifest: Manifest) -> str:
    import_lines: list[str] = []
    all_names: list[str] = []
    for ent in manifest.entities:
        symbols = [f"{ent.name}Create", f"{ent.name}Update", f"{ent.name}Read"]
        if ent.behaviour == "tree":
            symbols.append(f"{ent.name}Node")
        import_lines.append(
            f"from app.schemas.{ent.plural} import (\n"
            + "\n".join(f"    {s}," for s in symbols)
            + "\n)",
        )
        all_names.extend(symbols)
    all_block = "\n".join(f"    \"{n}\"," for n in sorted(set(all_names)))
    return _render(
        "schemas/__init__.py.tpl",
        pascal_name=manifest.app.pascal_name,
        entity_imports="\n".join(import_lines),
        all_names=all_block,
    )


# --- service rendering ---------------------------------------------------


def render_service(entity: EntityDef, manifest: Manifest) -> str:
    """Render one ``backend/app/services/<plural>.py`` file."""
    imports_lines = []
    if any(ep.id == "complete" for ep in entity.extra_endpoints):
        imports_lines.append("from datetime import datetime")
        imports_lines.append("")
    if any(ep.id == "search" for ep in entity.extra_endpoints):
        imports_lines.append("from sqlalchemy import or_")
    imports_lines.append("from sqlalchemy.orm import Session")
    imports_lines.append("")
    exception_names = ["NotFoundError"]
    if any(fd.unique for fd in entity.fields) or any(
        ep.id == "create_with_conflict" for ep in entity.extra_endpoints
    ):
        exception_names.append("ConflictError")
    imports_lines.append(f"from app.exceptions import {', '.join(sorted(set(exception_names)))}")
    model_names = [entity.name]
    for fd in entity.fields:
        if fd.type == "enum" and fd.enum_name:
            model_names.append(fd.enum_name)
        if fd.type == "fk" and fd.target:
            model_names.append(fd.target)
    imports_lines.append(
        f"from app.models import {', '.join(sorted(set(model_names)))}",
    )
    imports_lines.append(
        f"from app.schemas.{entity.plural} import "
        f"{entity.name}Create, {entity.name}Update"
        + (f", {entity.name}Node" if entity.behaviour == "tree" else ""),
    )
    imports_block = "\n".join(imports_lines)

    functions_lines: list[str] = []
    functions_lines.append(_render_service_list(entity))
    functions_lines.append(_render_service_get(entity))
    functions_lines.append(_render_service_create(entity, manifest))
    functions_lines.append(_render_service_update(entity, manifest))
    functions_lines.append(_render_service_delete(entity))

    if entity.behaviour == "tree":
        functions_lines.append(_render_service_get_by_path(entity))
        functions_lines.append(_render_service_list_children(entity))
        functions_lines.append(_render_service_build_tree(entity))

    for ep in entity.extra_endpoints:
        functions_lines.append(_render_service_extra(entity, ep))

    return _render(
        "services/entity.py.tpl",
        class_name=entity.name,
        pascal_name=manifest.app.pascal_name,
        imports_block=imports_block,
        functions_block="\n\n\n".join(b for b in functions_lines if b),
    )


def _render_service_list(entity: EntityDef) -> str:
    enum_param_imports = [
        f.enum_name for f in entity.fields if f.type == "enum" and f.enum_name
    ]
    filter_params: list[str] = []
    filter_body: list[str] = []
    for lf in entity.list_filters:
        fd = next((f for f in entity.fields if f.name == lf.field_name), None)
        if fd is None:
            continue
        if fd.type == "enum" and fd.enum_name:
            filter_params.append(f"    {lf.name}: {fd.enum_name} | None = None,")
            filter_body.append(
                f"    if {lf.name} is not None:\n"
                f"        query = query.filter({entity.name}.{lf.field_name} == {lf.name})",
            )
        else:
            py_t = py_type_for(fd)
            base_t = py_t.split(" | ")[0]
            filter_params.append(f"    {lf.name}: {base_t} | None = None,")
            filter_body.append(
                f"    if {lf.name} is not None:\n"
                f"        query = query.filter({entity.name}.{lf.field_name} == {lf.name})",
            )
    if filter_params:
        params_block = "\n" + "\n".join(filter_params) + "\n"
    else:
        params_block = ""
    body_lines = [f"    query = db.query({entity.name})"]
    body_lines.extend(filter_body)
    order_field = "external_id" if any(f.name == "external_id" for f in entity.fields) else (
        "path" if entity.behaviour == "tree" else "id"
    )
    body_lines.append(
        f"    return query.order_by({entity.name}.{order_field}).all()",
    )
    body = "\n".join(body_lines)
    return (
        f"def list_{entity.plural}(db: Session,{params_block}) -> list[{entity.name}]:\n{body}"
    )


def _render_service_get(entity: EntityDef) -> str:
    lower = entity.lower
    return (
        f"def get_{lower}(db: Session, {lower}_id: int) -> {entity.name}:\n"
        f"    row = db.get({entity.name}, {lower}_id)\n"
        f"    if row is None:\n"
        f"        raise NotFoundError(f\"{entity.name} {{{lower}_id}} not found\")\n"
        f"    return row"
    )


def _render_service_create(entity: EntityDef, manifest: Manifest) -> str:
    lower = entity.lower
    body_lines = []
    # Unique-field collision check.
    unique_fd = next((f for f in entity.fields if f.unique), None)
    if unique_fd:
        body_lines.append(
            f"    existing = (\n"
            f"        db.query({entity.name})\n"
            f"        .filter({entity.name}.{unique_fd.name} == payload.{unique_fd.name})\n"
            f"        .one_or_none()\n"
            f"    )\n"
            f"    if existing is not None:\n"
            f"        raise ConflictError(\n"
            f"            f\"{entity.name} with {unique_fd.name}={{payload.{unique_fd.name}}} \"\n"
            f"            \"already exists\"\n"
            f"        )",
        )
    # FK existence check.
    for fd in entity.fields:
        if fd.type == "fk" and fd.target:
            target_lower = fd.target.lower()
            body_lines.append(
                f"    {target_lower} = db.get({fd.target}, payload.{fd.name})\n"
                f"    if {target_lower} is None:\n"
                f"        raise NotFoundError(f\"{fd.target} {{payload.{fd.name}}} not found\")",
            )
    body_lines.append(f"    row = {entity.name}(**payload.model_dump())")
    body_lines.append("    db.add(row)")
    body_lines.append("    db.commit()")
    body_lines.append("    db.refresh(row)")
    body_lines.append("    return row")
    body = "\n".join(body_lines)
    return (
        f"def create_{lower}(db: Session, payload: {entity.name}Create) -> {entity.name}:\n{body}"
    )


def _render_service_update(entity: EntityDef, manifest: Manifest) -> str:
    lower = entity.lower
    fk_checks: list[str] = []
    for fd in entity.fields:
        if fd.type == "fk" and fd.target:
            target_lower = fd.target.lower()
            fk_checks.append(
                f"    if \"{fd.name}\" in data:\n"
                f"        {target_lower} = db.get({fd.target}, data[\"{fd.name}\"])\n"
                f"        if {target_lower} is None:\n"
                f"            raise NotFoundError(\n"
                f"                f\"{fd.target} {{data['{fd.name}']}} not found\"\n"
                f"            )",
            )
    fk_block = "\n".join(fk_checks)
    return (
        f"def update_{lower}(\n"
        f"    db: Session, {lower}_id: int, payload: {entity.name}Update\n"
        f") -> {entity.name}:\n"
        f"    row = get_{lower}(db, {lower}_id)\n"
        f"    data = payload.model_dump(exclude_unset=True)\n"
        + (fk_block + "\n" if fk_block else "")
        + "    for key, value in data.items():\n"
        f"        setattr(row, key, value)\n"
        f"    db.commit()\n"
        f"    db.refresh(row)\n"
        f"    return row"
    )


def _render_service_delete(entity: EntityDef) -> str:
    lower = entity.lower
    return (
        f"def delete_{lower}(db: Session, {lower}_id: int) -> None:\n"
        f"    row = get_{lower}(db, {lower}_id)\n"
        f"    db.delete(row)\n"
        f"    db.commit()"
    )


def _render_service_get_by_path(entity: EntityDef) -> str:
    return (
        f"def get_{entity.lower}_by_path(db: Session, path: str) -> {entity.name}:\n"
        f"    row = db.query({entity.name}).filter({entity.name}.path == path).one_or_none()\n"
        f"    if row is None:\n"
        f"        raise NotFoundError(f\"{entity.name} {{path!r}} not found\")\n"
        f"    return row"
    )


def _render_service_list_children(entity: EntityDef) -> str:
    return (
        f"def list_children(db: Session, parent_path: str | None) -> list[{entity.name}]:\n"
        f"    \"\"\"Direct children of ``parent_path``. ``None`` returns top-level entries.\"\"\"\n"
        f"    if parent_path is None:\n"
        f"        return (\n"
        f"            db.query({entity.name})\n"
        f"            .filter({entity.name}.parent_path.is_(None))\n"
        f"            .order_by({entity.name}.name)\n"
        f"            .all()\n"
        f"        )\n"
        f"    return (\n"
        f"        db.query({entity.name})\n"
        f"        .filter({entity.name}.parent_path == parent_path)\n"
        f"        .order_by({entity.name}.name)\n"
        f"        .all()\n"
        f"    )"
    )


def _render_service_build_tree(entity: EntityDef) -> str:
    return (
        f"def build_tree(db: Session) -> list[{entity.name}Node]:\n"
        f"    \"\"\"Return all rows as a forest of ``{entity.name}Node``.\"\"\"\n"
        f"    rows = db.query({entity.name}).order_by({entity.name}.path).all()\n"
        f"    by_path: dict[str, {entity.name}Node] = {{\n"
        f"        row.path: {entity.name}Node(\n"
        f"            path=row.path,\n"
        f"            name=row.name,\n"
        f"            display_name=row.display_name,\n"
        f"            level=row.level,\n"
        f"            children=[],\n"
        f"        )\n"
        f"        for row in rows\n"
        f"    }}\n"
        f"    roots: list[{entity.name}Node] = []\n"
        f"    for row in rows:\n"
        f"        node = by_path[row.path]\n"
        f"        if row.parent_path is None or row.parent_path not in by_path:\n"
        f"            roots.append(node)\n"
        f"        else:\n"
        f"            by_path[row.parent_path].children.append(node)\n"
        f"    return roots"
    )


def _render_service_extra(entity: EntityDef, ep: ExtraEndpointDef) -> str:
    """Render a named extra-endpoint service function.

    Only well-known IDs get full bodies (complete, reopen, search,
    get_by_external_id); everything else gets a `raise NotImplementedError`
    stub the human fills in.
    """
    if ep.id == "complete":
        return (
            f"def complete_{entity.lower}(db: Session, {entity.lower}_id: int) -> {entity.name}:\n"
            f"    row = get_{entity.lower}(db, {entity.lower}_id)\n"
            f"    row.status = ActionStatus.DONE\n"
            f"    row.completed_at = datetime.utcnow()\n"
            f"    db.commit()\n"
            f"    db.refresh(row)\n"
            f"    return row"
        )
    if ep.id == "reopen":
        return (
            f"def reopen_{entity.lower}(db: Session, {entity.lower}_id: int) -> {entity.name}:\n"
            f"    row = get_{entity.lower}(db, {entity.lower}_id)\n"
            f"    row.status = ActionStatus.OPEN\n"
            f"    row.completed_at = None\n"
            f"    db.commit()\n"
            f"    db.refresh(row)\n"
            f"    return row"
        )
    if ep.id == "search":
        searchable = [
            f.name for f in entity.fields
            if f.type == "str" and f.name in ("content", "category_path", "notes", "label", "description")
        ]
        if not searchable:
            searchable = [f.name for f in entity.fields if f.type == "str"][:3]
        cond = ",\n            ".join(f"{entity.name}.{n}.ilike(needle)" for n in searchable)
        return (
            f"def search_{entity.plural}(db: Session, q: str) -> list[{entity.name}]:\n"
            f"    \"\"\"Substring match over {', '.join(searchable)}.\"\"\"\n"
            f"    needle = f\"%{{q}}%\"\n"
            f"    return (\n"
            f"        db.query({entity.name})\n"
            f"        .filter(\n"
            f"            or_(\n"
            f"            {cond}\n"
            f"            )\n"
            f"        )\n"
            f"        .order_by({entity.name}.id)\n"
            f"        .all()\n"
            f"    )"
        )
    if ep.id == "get_by_external_id":
        return (
            f"def get_{entity.lower}_by_external_id(db: Session, external_id: int) -> "
            f"{entity.name}:\n"
            f"    row = db.query({entity.name})"
            f".filter({entity.name}.external_id == external_id).one_or_none()\n"
            f"    if row is None:\n"
            f"        raise NotFoundError(\n"
            f"            f\"{entity.name} with external_id={{external_id}} not found\"\n"
            f"        )\n"
            f"    return row"
        )
    # Unknown extra: leave a stub so the human can fill it in.
    return (
        f"def {ep.service_fn}(*args, **kwargs):  # noqa: ANN201\n"
        f"    \"\"\"TODO: implement {ep.id} for {entity.name}.\n\n"
        f"    Bootstrap generated a stub because the extra_endpoint id is\n"
        f"    not in the well-known set (complete/reopen/search/get_by_external_id).\n"
        f"    \"\"\"\n"
        f"    raise NotImplementedError(\"{ep.id} not implemented\")"
    )


# --- router rendering ----------------------------------------------------


def render_router(entity: EntityDef, manifest: Manifest) -> str:
    has_enum_filter = any(
        fd.type == "enum"
        for fd in entity.fields
        if any(lf.field_name == fd.name for lf in entity.list_filters)
    )
    model_imports: list[str] = []
    if has_enum_filter:
        for lf in entity.list_filters:
            fd = next((f for f in entity.fields if f.name == lf.field_name), None)
            if fd and fd.type == "enum" and fd.enum_name:
                model_imports.append(fd.enum_name)
    if any(ep.id == "complete" for ep in entity.extra_endpoints):
        # complete/reopen don't need extra model imports; status fields are already present.
        pass

    imports_lines = ["from __future__ import annotations", "", "from fastapi import APIRouter, Depends, Response, status"]
    imports_lines.append("from sqlalchemy.orm import Session")
    imports_lines.append("")
    imports_lines.append("from app.database import get_db")
    if model_imports:
        imports_lines.append(f"from app.models import {', '.join(sorted(set(model_imports)))}")
    schema_imports = [f"{entity.name}Create", f"{entity.name}Read", f"{entity.name}Update"]
    if entity.behaviour == "tree":
        schema_imports.append(f"{entity.name}Node")
    imports_lines.append(
        f"from app.schemas.{entity.plural} import (\n"
        + "\n".join(f"    {s}," for s in schema_imports)
        + "\n)",
    )
    imports_lines.append(f"from app.services import {entity.plural} as service")
    imports_block = "\n".join(imports_lines)

    endpoints: list[str] = []
    endpoints.append(_render_router_list(entity))
    if entity.behaviour == "tree":
        endpoints.append(_render_router_tree(entity))
        endpoints.append(_render_router_children(entity))
    for ep in entity.extra_endpoints:
        if not _is_post_id_route(ep):
            endpoints.append(_render_router_extra(entity, ep))
    endpoints.append(_render_router_get(entity))
    endpoints.append(_render_router_post(entity))
    endpoints.append(_render_router_patch(entity))
    endpoints.append(_render_router_delete(entity))
    for ep in entity.extra_endpoints:
        if _is_post_id_route(ep):
            endpoints.append(_render_router_extra(entity, ep))

    endpoints_block = "\n\n\n".join(endpoints)

    summary = "CRUD"
    if entity.extra_endpoints:
        ids = " + ".join(ep.id for ep in entity.extra_endpoints)
        summary = f"CRUD + {ids}"
    if entity.behaviour == "tree":
        summary += " + tree"

    return _render(
        "routers/entity.py.tpl",
        class_name=entity.name,
        plural=entity.plural,
        router_summary=summary,
        imports_block=imports_block,
        endpoints_block=endpoints_block,
    )


def _is_post_id_route(ep: ExtraEndpointDef) -> bool:
    return ep.method.upper() == "POST" and "{" in ep.path


def _render_router_list(entity: EntityDef) -> str:
    query_params: list[str] = []
    call_args: list[str] = []
    for lf in entity.list_filters:
        fd = next((f for f in entity.fields if f.name == lf.field_name), None)
        if fd is None:
            continue
        py_t = py_type_for(fd)
        base_t = py_t.split(" | ")[0]
        query_params.append(f"{lf.name}: {base_t} | None = None")
        call_args.append(f"{lf.name}={lf.name}")
    qp_str = ""
    if query_params:
        qp_str = "\n    " + ",\n    ".join(query_params) + ",\n    "
    args_str = ", " + ", ".join(call_args) if call_args else ""
    return (
        f"@router.get(\"\", response_model=list[{entity.name}Read])\n"
        f"def list_{entity.plural}({qp_str}db: Session = Depends(get_db)) -> list[{entity.name}Read]:\n"
        f"    rows = service.list_{entity.plural}(db{args_str})\n"
        f"    return [{entity.name}Read.model_validate(row) for row in rows]"
    )


def _render_router_tree(entity: EntityDef) -> str:
    return (
        f"@router.get(\"/tree\", response_model=list[{entity.name}Node])\n"
        f"def get_tree(db: Session = Depends(get_db)) -> list[{entity.name}Node]:\n"
        f"    return service.build_tree(db)"
    )


def _render_router_children(entity: EntityDef) -> str:
    return (
        f"@router.get(\"/children\", response_model=list[{entity.name}Read])\n"
        f"def get_children(\n"
        f"    parent_path: str | None = None, db: Session = Depends(get_db)\n"
        f") -> list[{entity.name}Read]:\n"
        f"    rows = service.list_children(db, parent_path)\n"
        f"    return [{entity.name}Read.model_validate(row) for row in rows]"
    )


def _render_router_get(entity: EntityDef) -> str:
    return (
        f"@router.get(\"/{{{entity.lower}_id}}\", response_model={entity.name}Read)\n"
        f"def get_{entity.lower}({entity.lower}_id: int, db: Session = Depends(get_db)) "
        f"-> {entity.name}Read:\n"
        f"    return {entity.name}Read.model_validate(service.get_{entity.lower}(db, "
        f"{entity.lower}_id))"
    )


def _render_router_post(entity: EntityDef) -> str:
    return (
        f"@router.post(\"\", response_model={entity.name}Read, status_code=status.HTTP_201_CREATED)\n"
        f"def create_{entity.lower}(payload: {entity.name}Create, "
        f"db: Session = Depends(get_db)) -> {entity.name}Read:\n"
        f"    return {entity.name}Read.model_validate(service.create_{entity.lower}(db, payload))"
    )


def _render_router_patch(entity: EntityDef) -> str:
    return (
        f"@router.patch(\"/{{{entity.lower}_id}}\", response_model={entity.name}Read)\n"
        f"def update_{entity.lower}(\n"
        f"    {entity.lower}_id: int, payload: {entity.name}Update, "
        f"db: Session = Depends(get_db)\n"
        f") -> {entity.name}Read:\n"
        f"    return {entity.name}Read.model_validate(\n"
        f"        service.update_{entity.lower}(db, {entity.lower}_id, payload)\n"
        f"    )"
    )


def _render_router_delete(entity: EntityDef) -> str:
    return (
        f"@router.delete(\"/{{{entity.lower}_id}}\", "
        f"status_code=status.HTTP_204_NO_CONTENT)\n"
        f"def delete_{entity.lower}({entity.lower}_id: int, "
        f"db: Session = Depends(get_db)) -> Response:\n"
        f"    service.delete_{entity.lower}(db, {entity.lower}_id)\n"
        f"    return Response(status_code=status.HTTP_204_NO_CONTENT)"
    )


def _render_router_extra(entity: EntityDef, ep: ExtraEndpointDef) -> str:
    """Render an extra endpoint. Path parameters and query parameters come
    from the manifest definition; the body delegates to ``service.<fn>``."""
    method = ep.method.lower()
    decorator_args = [f"\"{ep.path}\""]
    if ep.returns and ep.returns != "None":
        decorator_args.append(f"response_model={ep.returns}")
    if method == "post" and "{" not in ep.path:
        decorator_args.append("status_code=status.HTTP_201_CREATED")

    func_params: list[str] = []
    call_args: list[str] = []
    for pp in ep.path_params:
        func_params.append(f"{pp.name}: {pp.type}")
        call_args.append(pp.name)
    for qp in ep.query_params:
        if qp.required:
            func_params.append(f"{qp.name}: {qp.type}")
        else:
            func_params.append(f"{qp.name}: {qp.type} | None = None")
        call_args.append(f"{qp.name}={qp.name}" if not qp.required else qp.name)
    func_params.append("db: Session = Depends(get_db)")

    returns_anno = ep.returns or "object"
    if ep.returns and ep.returns.startswith("list["):
        # service returns a list; wrap each row through .model_validate.
        inner = ep.returns[5:-1]
        body = (
            f"    rows = service.{ep.service_fn}(db{', ' + ', '.join(call_args) if call_args else ''})\n"
            f"    return [{inner}.model_validate(row) for row in rows]"
        )
    elif ep.returns:
        body = (
            f"    return {ep.returns}.model_validate(\n"
            f"        service.{ep.service_fn}(db"
            f"{', ' + ', '.join(call_args) if call_args else ''})\n"
            f"    )"
        )
    else:
        body = f"    service.{ep.service_fn}(db{', ' + ', '.join(call_args) if call_args else ''})\n    return Response(status_code=204)"

    return (
        f"@router.{method}({', '.join(decorator_args)})\n"
        f"def {ep.service_fn}({', '.join(func_params)}) -> {returns_anno}:\n"
        f"{body}"
    )


# --- router test rendering ----------------------------------------------


def render_router_test(entity: EntityDef, manifest: Manifest) -> str:
    """Generate a minimal integration test for the new router.

    Coverage: CRUD round-trip + 404 on missing id + 422 on invalid payload.
    Conflict / FK-missing / extra-endpoint coverage gets added per entity
    if the manifest declares the relevant signals.
    """
    fixture_args = ""
    fixtures: list[str] = []

    # FK-source fixtures: walk up the belongs_to chain to find the
    # parent fixture(s) we need to create before this entity can be
    # written. For Item -> Container we need a container fixture.
    fk_fields = [f for f in entity.fields if f.type == "fk"]
    if fk_fields:
        fixtures.extend(_render_fk_fixtures(entity, manifest, fk_fields))
        fixture_args = ", " + ", ".join(f.target.lower() for f in fk_fields)

    payload = _sample_create_payload(entity, manifest, idx=1001)
    crud_body = _render_crud_round_trip(entity, manifest, payload)

    invalid_payload = _sample_invalid_payload(entity)

    extra_tests: list[str] = []
    if any(fd.unique for fd in entity.fields):
        extra_tests.append(_render_conflict_test(entity, manifest))
    if fk_fields:
        extra_tests.append(_render_fk_missing_test(entity, manifest, fk_fields[0]))
    for ep in entity.extra_endpoints:
        extra_tests.append(_render_extra_endpoint_test(entity, manifest, ep))

    fixtures_block = "\n\n".join(fixtures)
    tests_block = "\n\n".join(
        [
            f"def test_full_crud_round_trip(client: TestClient{fixture_args}) -> None:\n{crud_body}",
            (
                f"def test_get_missing_{entity.lower}_returns_404(client: TestClient) -> None:\n"
                f"    r = client.get(\"/api/{entity.plural}/999999\")\n"
                f"    assert r.status_code == 404"
            ),
            (
                f"def test_create_with_invalid_payload_returns_422(client: TestClient) -> None:\n"
                f"    r = client.post(\"/api/{entity.plural}\", json={invalid_payload})\n"
                f"    assert r.status_code == 422"
            ),
        ]
        + [t for t in extra_tests if t],
    )

    return _render(
        "tests/router_test.py.tpl",
        class_name=entity.name,
        fixtures_block=fixtures_block,
        tests_block=tests_block,
    )


def _render_fk_fixtures(entity: EntityDef, manifest: Manifest, fk_fields: list[FieldDef]) -> list[str]:
    """For each FK in the entity, generate a pytest fixture that creates
    the parent row and returns its JSON."""
    out = []
    for fd in fk_fields:
        target_lower = fd.target.lower()
        target_entity = manifest.entity_by_name.get(fd.target)
        if target_entity is None:
            continue
        parent_payload = _sample_create_payload(target_entity, manifest, idx=7001)
        out.append(
            f"@pytest.fixture\n"
            f"def {target_lower}(client: TestClient) -> dict:\n"
            f"    r = client.post(\n"
            f"        \"/api/{target_entity.plural}\",\n"
            f"        json={parent_payload},\n"
            f"    )\n"
            f"    assert r.status_code == 201, r.text\n"
            f"    return r.json()",
        )
    return out


def _sample_create_payload(entity: EntityDef, manifest: Manifest, idx: int) -> str:
    parts: list[str] = []
    for fd in entity.fields:
        if fd.type == "fk":
            parts.append(f"\"{fd.name}\": {fd.target.lower()}[\"id\"]")
        elif fd.unique and fd.type == "int":
            parts.append(f"\"{fd.name}\": {idx}")
        elif fd.type == "int":
            parts.append(f"\"{fd.name}\": 1")
        elif fd.type == "str" and not fd.nullable and fd.default is None:
            parts.append(f"\"{fd.name}\": \"sample {fd.name}\"")
        elif fd.type == "enum" and fd.enum_values and not fd.nullable:
            parts.append(f"\"{fd.name}\": \"{fd.enum_values[0]}\"")
        elif fd.type == "datetime" and not fd.nullable and not fd.default_now:
            parts.append(f"\"{fd.name}\": \"2026-01-01T00:00:00\"")
        elif fd.type == "bool" and not fd.nullable and fd.default is None:
            parts.append(f"\"{fd.name}\": False")
        elif fd.type == "float" and not fd.nullable and fd.default is None:
            parts.append(f"\"{fd.name}\": 0.0")
    return "{" + ", ".join(parts) + "}"


def _sample_invalid_payload(entity: EntityDef) -> str:
    # Find a required, non-fk field with a strict type and feed garbage.
    for fd in entity.fields:
        if fd.type == "int" and not fd.nullable:
            return f"{{\"{fd.name}\": \"not-an-int\"}}"
        if fd.type == "fk":
            return f"{{\"{fd.name}\": \"not-an-int\"}}"
    # Fallback: missing-required-field payload.
    return "{}"


def _render_crud_round_trip(entity: EntityDef, manifest: Manifest, payload: str) -> str:
    return (
        f"    r = client.post(\"/api/{entity.plural}\", json={payload})\n"
        f"    assert r.status_code == 201, r.text\n"
        f"    body = r.json()\n"
        f"    {entity.lower}_id = body[\"id\"]\n"
        f"    r = client.get(f\"/api/{entity.plural}/{{{entity.lower}_id}}\")\n"
        f"    assert r.status_code == 200\n"
        f"    r = client.get(\"/api/{entity.plural}\")\n"
        f"    assert r.status_code == 200\n"
        f"    assert any(row[\"id\"] == {entity.lower}_id for row in r.json())\n"
        f"    r = client.delete(f\"/api/{entity.plural}/{{{entity.lower}_id}}\")\n"
        f"    assert r.status_code == 204\n"
        f"    r = client.get(f\"/api/{entity.plural}/{{{entity.lower}_id}}\")\n"
        f"    assert r.status_code == 404"
    )


def _render_conflict_test(entity: EntityDef, manifest: Manifest) -> str:
    unique_fd = next((f for f in entity.fields if f.unique), None)
    if unique_fd is None:
        return ""
    payload_a = _sample_create_payload(entity, manifest, idx=3001)
    payload_b = _sample_create_payload(entity, manifest, idx=3001)  # same idx for collision
    return (
        f"def test_duplicate_{unique_fd.name}_returns_409(client: TestClient) -> None:\n"
        f"    client.post(\"/api/{entity.plural}\", json={payload_a})\n"
        f"    r = client.post(\"/api/{entity.plural}\", json={payload_b})\n"
        f"    assert r.status_code == 409"
    )


def _render_fk_missing_test(entity: EntityDef, manifest: Manifest, fk: FieldDef) -> str:
    bad_payload = _sample_create_payload(entity, manifest, idx=9001).replace(
        f"\"{fk.name}\": {fk.target.lower()}[\"id\"]",
        f"\"{fk.name}\": 999999",
    )
    return (
        f"def test_create_with_missing_{fk.target.lower()}_returns_404(client: TestClient) -> None:\n"
        f"    r = client.post(\"/api/{entity.plural}\", json={bad_payload})\n"
        f"    assert r.status_code == 404"
    )


def _render_extra_endpoint_test(entity: EntityDef, manifest: Manifest, ep: ExtraEndpointDef) -> str:
    """Generate a happy-path smoke for the extra endpoint. Only known IDs
    get bodies; unknown IDs emit a TODO test stub."""
    if ep.id in ("complete", "reopen"):
        # Needs an Action + its parent fixture; just smoke the round trip.
        return (
            f"def test_{ep.id}_smoke(client: TestClient) -> None:\n"
            f"    # TODO(bootstrap): wire fixtures so this exercises real {ep.id}\n"
            f"    # behaviour for {entity.name}. The endpoint is generated; the\n"
            f"    # test stays a stub until you have a parent-row fixture.\n"
            f"    pass"
        )
    if ep.id == "search":
        return (
            f"def test_search_smoke(client: TestClient) -> None:\n"
            f"    r = client.get(\"/api/{entity.plural}/search\", params={{\"q\": \"anything\"}})\n"
            f"    assert r.status_code == 200\n"
            f"    assert isinstance(r.json(), list)"
        )
    if ep.id == "get_by_external_id":
        return (
            f"def test_get_by_external_id_returns_404_on_miss(client: TestClient) -> None:\n"
            f"    r = client.get(\"/api/{entity.plural}/by-external-id/99999\")\n"
            f"    assert r.status_code == 404"
        )
    return (
        f"def test_{ep.id}_smoke(client: TestClient) -> None:\n"
        f"    # TODO(bootstrap): {ep.id} is a non-standard extra endpoint;\n"
        f"    # the bootstrap script does not know how to exercise it.\n"
        f"    pass"
    )


# --- phase implementations ----------------------------------------------


@dataclass
class BootstrapContext:
    template_root: Path  # this repo
    target_dir: Path
    manifest: Manifest
    dry_run: bool = False
    skip_migration: bool = False
    with_example_plugin: bool = False

    @property
    def commits_so_far(self) -> int:
        return len(list((self.target_dir / ".bootstrap-commits").glob("*"))) if (
            self.target_dir / ".bootstrap-commits"
        ).exists() else 0


def phase1_bootstrap(ctx: BootstrapContext) -> None:
    """Copy template tree + init fresh git + initial commit."""
    logger.info("Phase 1: bootstrap (copy + git init)")
    if ctx.target_dir.exists() and any(ctx.target_dir.iterdir()):
        raise SystemExit(
            f"target dir already non-empty: {ctx.target_dir}. Refusing to clobber. "
            "Run 'rm -rf <target>' and retry.",
        )
    if ctx.dry_run:
        logger.info("[dry-run] would copy %s -> %s", ctx.template_root, ctx.target_dir)
        return

    ctx.target_dir.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(
        ctx.template_root,
        ctx.target_dir,
        ignore=shutil.ignore_patterns(*COPY_EXCLUDE_DIRS, *COPY_EXCLUDE_GLOBS, *COPY_EXCLUDE_FILES),
    )

    _git_init(ctx.target_dir)

    provenance = {
        "template_repo": "github.com/astrapi69/pluginforge-app-template",
        "template_commit": _current_template_commit(ctx.template_root),
        "bootstrap_version": "0.1.0",
        "manifest_app_name": ctx.manifest.app.name,
        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    (ctx.target_dir / ".bootstrap-provenance.json").write_text(
        json.dumps(provenance, indent=2) + "\n", encoding="utf-8",
    )

    _git_commit(
        ctx.target_dir,
        f"chore: bootstrap from pluginforge-app-template {provenance['template_commit'][:7]}",
    )


def _current_template_commit(template_root: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=template_root,
            capture_output=True,
            text=True,
            check=True,
        )
        return out.stdout.strip()
    except subprocess.CalledProcessError:
        return "unknown"


def _git_init(target: Path) -> None:
    subprocess.run(["git", "init", "-b", "main"], cwd=target, check=True)
    subprocess.run(["git", "add", "-A"], cwd=target, check=True)


def _git_commit(target: Path, message: str) -> None:
    subprocess.run(["git", "add", "-A"], cwd=target, check=True)
    subprocess.run(["git", "commit", "-m", message], cwd=target, check=True)


def phase2_rename(ctx: BootstrapContext) -> None:
    """sed sweep: myapp/MyApp/MYAPP + pluginforge-app-template -> manifest values.

    Also renames the launcher directory + spec + icon, patches the three
    pyproject.toml files + frontend/package.json + launcher version_info.txt
    metadata fields.
    """
    logger.info("Phase 2: rename (sed sweep + filesystem renames + metadata)")
    app = ctx.manifest.app
    replacements = [
        ("MYAPP", app.upper_name),
        ("MyApp", app.pascal_name),
        ("myapp", app.name),
        ("pluginforge-app-template", app.name),
    ]
    if ctx.dry_run:
        for f in _iter_text_files(ctx.target_dir):
            logger.info("[dry-run] would sed: %s", f)
        return

    for path in _iter_text_files(ctx.target_dir):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        new = text
        for old, new_value in replacements:
            new = new.replace(old, new_value)
        if new != text:
            path.write_text(new, encoding="utf-8")

    # Launcher renames.
    launcher = ctx.target_dir / "launcher"
    _rename_if_exists(launcher / "myapp_launcher", launcher / f"{app.name}_launcher")
    _rename_if_exists(launcher / "myapp-launcher.spec", launcher / f"{app.name}-launcher.spec")
    _rename_if_exists(launcher / "myapp.ico", launcher / f"{app.name}.ico")
    _rename_if_exists(
        ctx.target_dir / "backend" / ".myapp-production",
        ctx.target_dir / "backend" / f".{app.name}-production",
    )

    _patch_metadata(ctx)
    _git_commit(ctx.target_dir, f"chore: rename myapp -> {app.name}")


def _iter_text_files(root: Path):
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        # Skip excluded directories anywhere in the path.
        if any(part in COPY_EXCLUDE_DIRS for part in path.parts):
            continue
        if path.suffix in SED_EXTENSIONS or path.name in SED_FILENAMES:
            yield path


def _rename_if_exists(src: Path, dst: Path) -> None:
    if src.exists():
        src.rename(dst)


def _patch_metadata(ctx: BootstrapContext) -> None:
    """Rewrite top-level metadata fields in the three pyproject.toml files +
    frontend/package.json. The sed sweep already replaced the placeholder
    strings; this pass ensures the human-facing fields (description,
    authors) carry the manifest's app-level values."""
    app = ctx.manifest.app
    # backend/pyproject.toml + plugins use the same TOML schema; the basic
    # name/description/version rewrites are easy.
    for pyproject in [
        ctx.target_dir / "backend" / "pyproject.toml",
        ctx.target_dir / "launcher" / "pyproject.toml",
    ]:
        if not pyproject.exists():
            continue
        text = pyproject.read_text(encoding="utf-8")
        text = re.sub(r'^description\s*=\s*"[^"]*"',
                      f'description = "{app.description}"', text, count=1, flags=re.M)
        text = re.sub(r'^version\s*=\s*"[^"]*"',
                      f'version = "{app.version}"', text, count=1, flags=re.M)
        if app.author_name:
            text = re.sub(
                r'^authors\s*=\s*\[[^\]]*\]',
                f'authors = ["{app.author_name} <{app.author_email}>"]',
                text, count=1, flags=re.M | re.S,
            )
        pyproject.write_text(text, encoding="utf-8")

    pkgjson = ctx.target_dir / "frontend" / "package.json"
    if pkgjson.exists():
        data = json.loads(pkgjson.read_text(encoding="utf-8"))
        data["description"] = app.description
        if "version" in data:
            data["version"] = app.version
        if app.author_name:
            data["author"] = (
                f"{app.author_name} <{app.author_email}>" if app.author_email else app.author_name
            )
        pkgjson.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def phase3_domain_swap(ctx: BootstrapContext) -> None:
    """Delete the EXAMPLE-DOMAIN files (per inventory) + render new
    models + schemas + main.py / exceptions / hookspecs shells + i18n
    stubs + fresh migration."""
    logger.info("Phase 3: domain swap (delete EXAMPLE-DOMAIN, render shells)")
    if ctx.dry_run:
        logger.info("[dry-run] phase 3 - skipped")
        return

    inventory = _load_inventory()
    if inventory.get("status") != "ready":
        raise SystemExit(
            f"EXAMPLE-DOMAIN inventory not ready (status={inventory.get('status')!r}). "
            f"Cannot proceed with phase 3. See {INVENTORY_PATH}.",
        )
    _delete_example_domain(ctx.target_dir, inventory)

    # Write new models + schemas.
    models_dir = ctx.target_dir / "backend" / "app" / "models"
    schemas_dir = ctx.target_dir / "backend" / "app" / "schemas"
    models_dir.mkdir(parents=True, exist_ok=True)
    schemas_dir.mkdir(parents=True, exist_ok=True)

    for entity in ctx.manifest.entities:
        (models_dir / f"{entity.plural}.py").write_text(
            render_model(entity, ctx.manifest), encoding="utf-8",
        )
        (schemas_dir / f"{entity.plural}.py").write_text(
            render_schema(entity, ctx.manifest), encoding="utf-8",
        )

    (models_dir / "__init__.py").write_text(
        render_models_init(ctx.manifest), encoding="utf-8",
    )
    (schemas_dir / "__init__.py").write_text(
        render_schemas_init(ctx.manifest), encoding="utf-8",
    )

    _write_main_py_shell(ctx)
    _write_exceptions_shell(ctx)
    _write_hookspecs_shell(ctx)
    _gut_i18n_catalogs(ctx)
    _generate_migration(ctx)

    entity_list = ", ".join(e.name for e in ctx.manifest.entities)
    _git_commit(
        ctx.target_dir,
        f"feat: replace EXAMPLE-DOMAIN with {ctx.manifest.app.name} domain ({entity_list})",
    )


def _load_inventory() -> dict:
    if not INVENTORY_PATH.exists():
        return {"status": "stub", "reason": "file missing"}
    try:
        return json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"status": "stub", "reason": "invalid JSON"}


def _write_main_py_shell(ctx: BootstrapContext) -> None:
    app = ctx.manifest.app
    content = _render(
        "main.py.shell.tpl",
        name=app.name,
        pascal_name=app.pascal_name,
        upper_name=app.upper_name,
        description=app.description,
    )
    (ctx.target_dir / "backend" / "app" / "main.py").write_text(content, encoding="utf-8")


def _write_exceptions_shell(ctx: BootstrapContext) -> None:
    content = _render(
        "exceptions.py.shell.tpl",
        pascal_name=ctx.manifest.app.pascal_name,
    )
    (ctx.target_dir / "backend" / "app" / "exceptions.py").write_text(content, encoding="utf-8")


def _write_hookspecs_shell(ctx: BootstrapContext) -> None:
    content = _render(
        "hookspecs.py.shell.tpl",
        name=ctx.manifest.app.name,
        pascal_name=ctx.manifest.app.pascal_name,
    )
    (ctx.target_dir / "backend" / "app" / "hookspecs.py").write_text(content, encoding="utf-8")


def _delete_example_domain(target: Path, inventory: dict) -> None:
    """Remove the files listed in inventory["delete"]. Paths are relative
    to the target root. Missing paths are ignored (idempotent)."""
    for rel in inventory.get("delete", []):
        path = target / rel
        if path.is_file():
            path.unlink()
        elif path.is_dir():
            shutil.rmtree(path)


def _gut_i18n_catalogs(ctx: BootstrapContext) -> None:
    """Replace each catalog with the two-key minimum (`ui.app.name` and
    `ui.app.description` + the same under the app namespace)."""
    app = ctx.manifest.app
    i18n_dir = ctx.target_dir / "backend" / "config" / "i18n"
    for lang in app.supported_languages:
        path = i18n_dir / f"{lang}.yaml"
        content = (
            f"ui:\n"
            f"  app:\n"
            f"    name: {app.pascal_name}\n"
            f"    description: {app.description}\n"
            f"{app.name}:\n"
            f"  app:\n"
            f"    name: {app.pascal_name}\n"
            f"    description: {app.description}\n"
        )
        path.write_text(content, encoding="utf-8")


def _generate_migration(ctx: BootstrapContext) -> None:
    """Run ``alembic revision --autogenerate`` against an in-memory SQLite
    DB so we get a fresh initial-schema migration."""
    if ctx.skip_migration:
        (ctx.target_dir / ".bootstrap-migration-pending").write_text(
            "Run 'cd backend && poetry run alembic revision --autogenerate -m \"initial "
            f"{ctx.manifest.app.name} schema\"' once dependencies are installed.\n",
            encoding="utf-8",
        )
        return

    # Wipe existing migration versions so we start clean.
    versions = ctx.target_dir / "backend" / "migrations" / "versions"
    if versions.exists():
        for f in versions.glob("*.py"):
            f.unlink()

    env = os.environ.copy()
    env.setdefault(f"{ctx.manifest.app.upper_name}_TEST", "1")
    env.setdefault("TEST_DATABASE_URL", "sqlite:///:memory:")

    try:
        subprocess.run(
            ["poetry", "run", "alembic", "revision", "--autogenerate", "-m",
             f"initial {ctx.manifest.app.name} schema"],
            cwd=ctx.target_dir / "backend",
            check=True,
            env=env,
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        logger.warning(
            "alembic autogenerate failed (%s). Writing a "
            "'.bootstrap-migration-pending' stamp; run the command manually "
            "after `make install`.",
            exc,
        )
        (ctx.target_dir / ".bootstrap-migration-pending").write_text(
            f"Run 'cd backend && poetry run alembic revision --autogenerate "
            f"-m \"initial {ctx.manifest.app.name} schema\"' once "
            "dependencies are installed.\n",
            encoding="utf-8",
        )


def phase4_crud(ctx: BootstrapContext) -> None:
    """Render services + routers + integration tests per entity. Wire
    the routers into main.py between the BOOTSTRAP-ANCHOR markers."""
    logger.info("Phase 4: CRUD (services + routers + tests)")
    if ctx.dry_run:
        logger.info("[dry-run] phase 4 - skipped")
        return

    services_dir = ctx.target_dir / "backend" / "app" / "services"
    routers_dir = ctx.target_dir / "backend" / "app" / "routers"
    tests_dir = ctx.target_dir / "backend" / "tests" / "routers"
    services_dir.mkdir(parents=True, exist_ok=True)
    routers_dir.mkdir(parents=True, exist_ok=True)
    tests_dir.mkdir(parents=True, exist_ok=True)
    (tests_dir / "__init__.py").write_text("", encoding="utf-8")

    for entity in ctx.manifest.entities:
        (services_dir / f"{entity.plural}.py").write_text(
            render_service(entity, ctx.manifest), encoding="utf-8",
        )
        (routers_dir / f"{entity.plural}.py").write_text(
            render_router(entity, ctx.manifest), encoding="utf-8",
        )
        (tests_dir / f"test_{entity.plural}.py").write_text(
            render_router_test(entity, ctx.manifest), encoding="utf-8",
        )

    _wire_main_routers(ctx)

    entity_list = ", ".join(e.name for e in ctx.manifest.entities)
    _git_commit(
        ctx.target_dir,
        f"feat: CRUD services + routers + integration tests for {entity_list}",
    )


def _wire_main_routers(ctx: BootstrapContext) -> None:
    """Replace the BOOTSTRAP-ANCHOR block in main.py with the rendered
    router wiring from ``templates/main.py.routers.tpl``."""
    main_py = ctx.target_dir / "backend" / "app" / "main.py"
    if not main_py.exists():
        return
    text = main_py.read_text(encoding="utf-8")
    router_imports = ",\n    ".join(e.plural for e in ctx.manifest.entities)
    include_lines = "\n".join(
        f"app.include_router({e.plural}.router, prefix=\"/api\")"
        for e in ctx.manifest.entities
    )
    block = _render(
        "main.py.routers.tpl",
        router_imports=router_imports,
        include_router_lines=include_lines,
    )
    text = re.sub(
        r"# BOOTSTRAP-ANCHOR-BEGIN: entity-routers.*?# BOOTSTRAP-ANCHOR-END: entity-routers\n",
        block + "\n",
        text,
        flags=re.S,
    )
    main_py.write_text(text, encoding="utf-8")


def phase5_plugin_skeleton(ctx: BootstrapContext) -> None:
    """Opt-in via --with-example-plugin. Writes a minimal plugin shell."""
    if not ctx.with_example_plugin:
        logger.info("Phase 5: plugin skeleton skipped (--with-example-plugin not set)")
        return
    logger.info("Phase 5: writing example plugin skeleton")
    if ctx.dry_run:
        return
    app = ctx.manifest.app
    plugin_root = ctx.target_dir / "plugins" / f"{app.name}-plugin-example"
    pkg_root = plugin_root / f"{app.name}_example"
    pkg_root.mkdir(parents=True, exist_ok=True)
    (plugin_root / "tests").mkdir(parents=True, exist_ok=True)
    (pkg_root / "__init__.py").write_text("", encoding="utf-8")
    (pkg_root / "plugin.py").write_text(
        f"\"\"\"Example {app.pascal_name} plugin. Replace with the real importer / exporter / etc.\"\"\"\n"
        f"\n"
        f"from pluginforge import BasePlugin\n"
        f"\n"
        f"\n"
        f"class ExamplePlugin(BasePlugin):\n"
        f"    name = \"example\"\n"
        f"    version = \"0.1.0\"\n"
        f"    target_application = \"{app.name}\"\n",
        encoding="utf-8",
    )
    (plugin_root / "pyproject.toml").write_text(
        f"[tool.poetry]\n"
        f"name = \"{app.name}-plugin-example\"\n"
        f"version = \"0.1.0\"\n"
        f"description = \"Example {app.pascal_name} plugin scaffold.\"\n"
        f"authors = [\"{app.author_name} <{app.author_email}>\"]\n"
        f"\n"
        f"[tool.poetry.dependencies]\n"
        f"python = \"^3.11\"\n"
        f"pluginforge = \"^0.10.0\"\n"
        f"\n"
        f"[tool.poetry.plugins.\"{app.name}.plugins\"]\n"
        f"example = \"{app.name}_example.plugin:ExamplePlugin\"\n",
        encoding="utf-8",
    )
    _git_commit(ctx.target_dir, f"feat(plugins): {app.name}-plugin-example skeleton")


def phase6_frontend_shell(ctx: BootstrapContext) -> None:
    """Render types, db schema, api client, hooks, stub pages, NavBar, App.tsx."""
    logger.info("Phase 6: frontend shell")
    if ctx.dry_run:
        return

    app = ctx.manifest.app
    src = ctx.target_dir / "frontend" / "src"
    (src / "types").mkdir(parents=True, exist_ok=True)
    (src / "db").mkdir(parents=True, exist_ok=True)
    (src / "api").mkdir(parents=True, exist_ok=True)
    (src / "hooks").mkdir(parents=True, exist_ok=True)
    (src / "pages").mkdir(parents=True, exist_ok=True)
    (src / "components").mkdir(parents=True, exist_ok=True)

    (src / "types" / f"{app.name}.ts").write_text(_render_types(ctx), encoding="utf-8")
    (src / "db" / "schema.ts").write_text(_render_db_schema(ctx), encoding="utf-8")
    (src / "api" / "client.ts").write_text(_render_api_client(ctx), encoding="utf-8")
    (src / "hooks" / f"use{app.pascal_name}.ts").write_text(_render_hooks(ctx), encoding="utf-8")
    (src / "components" / "NavBar.tsx").write_text(_render_navbar(ctx), encoding="utf-8")
    (src / "App.tsx").write_text(_render_app_tsx(ctx), encoding="utf-8")

    for entity in ctx.manifest.entities:
        for suffix, kind in (("List", "list"), ("Detail", "detail")):
            page = render_page_stub(entity, ctx.manifest, suffix, kind)
            test = render_page_stub_test(entity, ctx.manifest, suffix, kind)
            (src / "pages" / f"{entity.name}{suffix}.tsx").write_text(page, encoding="utf-8")
            (src / "pages" / f"{entity.name}{suffix}.test.tsx").write_text(test, encoding="utf-8")

    _git_commit(
        ctx.target_dir,
        "feat: frontend shell (types, db, hooks, api client, stub pages, NavBar)",
    )


def _render_types(ctx: BootstrapContext) -> str:
    enum_types: list[str] = []
    seen_enums: set[str] = set()
    for ent in ctx.manifest.entities:
        for fd in ent.fields:
            if fd.type == "enum" and fd.enum_name and fd.enum_name not in seen_enums:
                seen_enums.add(fd.enum_name)
                union = " | ".join(f"\"{v}\"" for v in fd.enum_values)
                enum_types.append(f"export type {fd.enum_name} = {union};")
    interfaces: list[str] = []
    for ent in ctx.manifest.entities:
        lines = [f"export interface {ent.name} {{"]
        lines.append("    id: number;")
        for fd in ent.fields:
            lines.append(f"    {to_camel(fd.name)}: {ts_type_for(fd)};")
        if ent.timestamps:
            lines.append("    createdAt: string;")
            lines.append("    updatedAt: string;")
        lines.append("}")
        interfaces.append("\n".join(lines))
        if ent.behaviour == "tree":
            interfaces.append(
                f"\nexport interface {ent.name}Node {{\n"
                f"    path: string;\n    name: string;\n    displayName: string;\n"
                f"    level: number;\n    children: {ent.name}Node[];\n}}",
            )
    return _render(
        "frontend/types.ts.tpl",
        pascal_name=ctx.manifest.app.pascal_name,
        enum_types="\n".join(enum_types),
        interface_blocks="\n\n".join(interfaces),
    )


def _render_db_schema(ctx: BootstrapContext) -> str:
    type_imports = sorted({e.name for e in ctx.manifest.entities})
    table_decls = "\n".join(
        f"    {ent.plural}!: Table<{ent.name}, number>;" for ent in ctx.manifest.entities
    )
    table_stores = []
    for ent in ctx.manifest.entities:
        idx_fields = ["id"]
        for fd in ent.fields:
            if fd.unique:
                idx_fields.append(f"&{to_camel(fd.name)}")
            elif fd.indexed:
                idx_fields.append(to_camel(fd.name))
        table_stores.append(f"            {ent.plural}: \"{', '.join(idx_fields)}\",")
    return _render(
        "frontend/db_schema.ts.tpl",
        name=ctx.manifest.app.name,
        pascal_name=ctx.manifest.app.pascal_name,
        type_import_list=", ".join(type_imports),
        table_declarations=table_decls,
        table_stores="\n".join(table_stores),
    )


def _render_api_client(ctx: BootstrapContext) -> str:
    type_imports = sorted({e.name for e in ctx.manifest.entities})
    enum_imports = sorted({
        fd.enum_name
        for e in ctx.manifest.entities
        for fd in e.fields
        if fd.type == "enum" and fd.enum_name
    })
    tree_imports = sorted({
        f"{e.name}Node" for e in ctx.manifest.entities if e.behaviour == "tree"
    })
    all_imports = sorted(set(type_imports + enum_imports + tree_imports))
    type_import_list = "    " + ",\n    ".join(all_imports)
    payload_interfaces = "\n\n".join(_render_payload_interfaces(e) for e in ctx.manifest.entities)
    api_entries = ",\n".join(_render_api_namespace_entry(e) for e in ctx.manifest.entities)
    return _render(
        "frontend/api_client.ts.tpl",
        name=ctx.manifest.app.name,
        pascal_name=ctx.manifest.app.pascal_name,
        type_import_list=type_import_list,
        payload_interfaces=payload_interfaces,
        api_namespace_entries=api_entries + ",",
    )


def _render_payload_interfaces(entity: EntityDef) -> str:
    create_fields: list[str] = []
    update_fields: list[str] = []
    for fd in entity.fields:
        ts_t = ts_type_for(fd)
        if fd.nullable or fd.default is not None or fd.default_now:
            create_fields.append(f"    {to_camel(fd.name)}?: {ts_t};")
        else:
            create_fields.append(f"    {to_camel(fd.name)}: {ts_t};")
        # Update: every field optional, nullable types stay nullable.
        update_fields.append(f"    {to_camel(fd.name)}?: {ts_t};")
    return (
        f"export interface {entity.name}Create {{\n" + "\n".join(create_fields) + "\n}\n\n"
        f"export interface {entity.name}Update {{\n" + "\n".join(update_fields) + "\n}"
    )


def _render_api_namespace_entry(entity: EntityDef) -> str:
    list_params = ""
    if entity.list_filters:
        type_parts = []
        for lf in entity.list_filters:
            fd = next((f for f in entity.fields if f.name == lf.field_name), None)
            if fd:
                type_parts.append(f"{to_camel(lf.name)}?: {ts_type_for(fd).replace(' | null', '')}")
        list_params = f"filters: {{{'; '.join(type_parts)}}} = {{}}"
    list_args = "{query: filters}" if entity.list_filters else ""
    list_args_block = f"({list_params})" if list_params else "()"
    list_line = (
        f"        list: {list_args_block} =>\n"
        f"            request<{entity.name}[]>(\"/{entity.plural}\""
        + (", {query: filters}" if entity.list_filters else "")
        + "),"
    )
    body_lines = [list_line]
    if entity.behaviour == "tree":
        body_lines.append(
            f"        tree: () => request<{entity.name}Node[]>(\"/{entity.plural}/tree\"),"
        )
        body_lines.append(
            f"        children: (parentPath: string | null = null) =>\n"
            f"            request<{entity.name}[]>(\"/{entity.plural}/children\", {{\n"
            f"                query: parentPath !== null ? {{parentPath}} : {{}},\n"
            f"            }}),"
        )
    for ep in entity.extra_endpoints:
        if ep.id == "search":
            body_lines.append(
                f"        search: (q: string) => "
                f"request<{entity.name}[]>(\"/{entity.plural}/search\", {{query: {{q}}}}),"
            )
        elif ep.id == "get_by_external_id":
            body_lines.append(
                f"        getByExternalId: (externalId: number) =>\n"
                f"            request<{entity.name}>(\"/{entity.plural}/by-external-id/\" + externalId),"
            )
        elif ep.id == "complete":
            body_lines.append(
                f"        complete: (id: number) =>\n"
                f"            request<{entity.name}>(\"/{entity.plural}/\" + id + \"/complete\", {{method: \"POST\"}}),"
            )
        elif ep.id == "reopen":
            body_lines.append(
                f"        reopen: (id: number) =>\n"
                f"            request<{entity.name}>(\"/{entity.plural}/\" + id + \"/reopen\", {{method: \"POST\"}}),"
            )
    body_lines.append(f"        get: (id: number) => request<{entity.name}>(\"/{entity.plural}/\" + id),")
    body_lines.append(
        f"        create: (payload: {entity.name}Create) =>\n"
        f"            request<{entity.name}>(\"/{entity.plural}\", {{method: \"POST\", body: payload}}),"
    )
    body_lines.append(
        f"        update: (id: number, payload: {entity.name}Update) =>\n"
        f"            request<{entity.name}>(\"/{entity.plural}/\" + id, {{method: \"PATCH\", body: payload}}),"
    )
    body_lines.append(
        f"        delete: (id: number) =>\n"
        f"            request<void>(\"/{entity.plural}/\" + id, {{method: \"DELETE\"}}),"
    )
    body = "\n".join(body_lines)
    return f"    {entity.plural}: {{\n{body}\n    }}"


def _render_hooks(ctx: BootstrapContext) -> str:
    type_imports = sorted({e.name for e in ctx.manifest.entities})
    refresh_fns = "\n\n".join(
        f"export async function refresh{ent.name}s(): Promise<{ent.name}[]> {{\n"
        f"    const fresh = await api.{ent.plural}.list();\n"
        f"    await refreshTable(db.{ent.plural}, fresh);\n"
        f"    return fresh;\n"
        f"}}"
        for ent in ctx.manifest.entities
    )
    refresh_all_calls = ", ".join(f"refresh{ent.name}s()" for ent in ctx.manifest.entities)
    entity_hooks = "\n\n".join(_render_entity_hooks(ent) for ent in ctx.manifest.entities)
    return _render(
        "frontend/hooks.ts.tpl",
        name=ctx.manifest.app.name,
        pascal_name=ctx.manifest.app.pascal_name,
        type_import_list=", ".join(type_imports),
        refresh_functions=refresh_fns,
        refresh_all_calls=refresh_all_calls,
        entity_hooks=entity_hooks,
    )


def _render_entity_hooks(entity: EntityDef) -> str:
    return (
        f"export function use{entity.name}s(): CachedResult<{entity.name}> {{\n"
        f"    const loadCached = useCallback(() => db.{entity.plural}.toArray(), []);\n"
        f"    return useCachedCollection<{entity.name}>(loadCached, refresh{entity.name}s);\n"
        f"}}\n\n"
        f"export function use{entity.name}(id: number | null): CachedSingle<{entity.name}> {{\n"
        f"    const loadCached = useCallback((rid: number) => db.{entity.plural}.get(rid), []);\n"
        f"    const fetchFresh = useCallback((rid: number) => api.{entity.plural}.get(rid), []);\n"
        f"    const persist = useCallback((row: {entity.name}) => db.{entity.plural}.put(row), []);\n"
        f"    return useCachedSingle<{entity.name}>(id, loadCached, fetchFresh, persist);\n"
        f"}}"
    )


def _render_navbar(ctx: BootstrapContext) -> str:
    entries = ",\n".join(
        f"    {{path: \"/{ent.plural}\", label: \"{ent.name}s\"}}"
        for ent in ctx.manifest.entities
    )
    links = "\n".join(
        f"            <NavLink to={{`/${{ {{}} }}/{ent.plural}`}}>{ent.name}s</NavLink>"
        for ent in ctx.manifest.entities
    )
    # The {{`/${{...}}/`}} dance breaks readability. Use plain links:
    links = "\n".join(
        f"            <NavLink to=\"/{ent.plural}\" data-testid=\"nav-{ent.plural}\">"
        f"{ent.name}s</NavLink>"
        for ent in ctx.manifest.entities
    )
    return _render(
        "frontend/NavBar.tsx.tpl",
        pascal_name=ctx.manifest.app.pascal_name,
        nav_entries=entries,
        nav_links=links,
    )


def _render_app_tsx(ctx: BootstrapContext) -> str:
    imports: list[str] = []
    routes: list[str] = []
    for ent in ctx.manifest.entities:
        imports.append(f"import {ent.name}List from \"./pages/{ent.name}List\";")
        imports.append(f"import {ent.name}Detail from \"./pages/{ent.name}Detail\";")
        routes.append(f"                <Route path=\"/{ent.plural}\" element={{<{ent.name}List />}} />")
        routes.append(
            f"                <Route path=\"/{ent.plural}/:id\" element={{<{ent.name}Detail />}} />"
        )
    return _render(
        "frontend/App.tsx.tpl",
        pascal_name=ctx.manifest.app.pascal_name,
        page_imports="\n".join(imports),
        routes="\n".join(routes),
    )


def render_page_stub(entity: EntityDef, manifest: Manifest, suffix: str, kind: str) -> str:
    return _render(
        "frontend/page_stub.tsx.tpl",
        class_name=entity.name,
        page_suffix=suffix,
        page_kind=kind,
        plural=entity.plural,
        pascal_name=manifest.app.pascal_name,
        entities_pascal=f"{entity.name}s",
    )


def render_page_stub_test(entity: EntityDef, manifest: Manifest, suffix: str, kind: str) -> str:
    return _render(
        "frontend/page_stub.test.tsx.tpl",
        class_name=entity.name,
        page_suffix=suffix,
        page_kind=kind,
        plural=entity.plural,
        pascal_name=manifest.app.pascal_name,
        entities_pascal=f"{entity.name}s",
    )


def phase7_docs(ctx: BootstrapContext) -> None:
    """Render README, README-de, CONCEPT, ROADMAP, CUSTOMIZE, CLAUDE.md."""
    logger.info("Phase 7: docs")
    if ctx.dry_run:
        return
    app = ctx.manifest.app
    target = ctx.target_dir

    entity_summary = "\n".join(
        f"- **{ent.name}**: {ent.docstring or 'See model docstring.'}"
        for ent in ctx.manifest.entities
    )
    entity_summary_de = "\n".join(
        f"- **{ent.name}**: {ent.docstring or 'Siehe Modul-Docstring.'}"
        for ent in ctx.manifest.entities
    )
    short_tagline_de = app.short_tagline or "eine Plugin-getriebene Anwendung"
    repository_short = (app.repository_url or "").replace("https://", "")
    migration_state = (
        "The initial alembic migration was generated automatically."
        if not ctx.skip_migration
        else (
            "The initial alembic migration was deferred (--skip-migration). "
            "Run `cd backend && poetry run alembic revision --autogenerate -m \"initial "
            f"{app.name} schema\"` once `make install` completes."
        )
    )

    common = {
        "name": app.name,
        "pascal_name": app.pascal_name,
        "upper_name": app.upper_name,
        "description": app.description,
        "short_tagline": app.short_tagline or "personal application",
        "short_tagline_de": short_tagline_de,
        "repository_url": app.repository_url or f"https://github.com/REPLACE-ME/{app.name}",
        "repository_short": repository_short or f"github.com/REPLACE-ME/{app.name}",
        "entity_summary_block": entity_summary,
        "entity_summary_block_de": entity_summary_de,
        "entity_count": str(len(ctx.manifest.entities)),
        "entity_names": ", ".join(e.name for e in ctx.manifest.entities),
        "supported_languages_count": str(len(app.supported_languages)),
        "default_language": app.default_language,
        "migration_state": migration_state,
    }

    (target / "README.md").write_text(_render("README.md.tpl", **common), encoding="utf-8")
    (target / "README-de.md").write_text(_render("README-de.md.tpl", **common), encoding="utf-8")
    (target / "docs" / "CONCEPT.md").write_text(_render("CONCEPT.md.tpl", **common), encoding="utf-8")
    (target / "docs" / "ROADMAP.md").write_text(_render("ROADMAP.md.tpl", **common), encoding="utf-8")
    (target / "CUSTOMIZE.md").write_text(_render("CUSTOMIZE.md.tpl", **common), encoding="utf-8")
    (target / "CLAUDE.md").write_text(_render("CLAUDE.md.tpl", **common), encoding="utf-8")

    _em_dash_sweep(ctx)

    _git_commit(
        target,
        f"docs: rewrite README, CONCEPT, ROADMAP, CUSTOMIZE, CLAUDE.md for {app.name}",
    )


def _em_dash_sweep(ctx: BootstrapContext) -> None:
    """Replace U+2014 with a hyphen across every file the script
    generated or touched, EXCEPT .claude/rules/ (template-lineage rule)."""
    skip = ctx.target_dir / ".claude" / "rules"
    for path in _iter_text_files(ctx.target_dir):
        if skip in path.parents:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if "—" in text:
            path.write_text(text.replace("—", "-"), encoding="utf-8")


def phase8_sanity_sweep(ctx: BootstrapContext) -> None:
    """Run the 10-check post-bootstrap sanity sweep.

    The MkDocs-related checks from earlier drafts are gone (the template's
    lineage-prune PR removed MkDocs infrastructure). The surviving 10
    checks gate "bootstrap complete":

    1. Placeholder strings clean (myapp / MyApp / MYAPP / EXAMPLE-DOMAIN /
       pluginforge-app-template) across the file set phase 2 swept.
    2. # TEMPLATE: / // TEMPLATE: markers absent from script-generated files.
    3. No em-dashes (U+2014) outside .claude/rules/ (the lineage-rule
       exemption).
    4. Backend module imports cleanly (`python -c "from app.main import app"`)
       and FastAPI app.title matches manifest.pascal_name.
    5. Backend pytest green.
    6. Plugin pytest green (iterate plugins/<name>-plugin-*/; skip if empty).
    7. Frontend npm run build green.
    8. Frontend Vitest green.
    9. pre-commit run --all-files green.
    10. Frontend tsc --noEmit clean.

    Each check's stdout / stderr lands in
    ``<target>/.bootstrap-phase8-<n>.log`` for diagnostics on failure.
    The sweep aborts on the first failure; partial logs remain on disk.
    """
    logger.info("Phase 8: sanity sweep (10 checks)")
    if ctx.dry_run:
        return

    target = ctx.target_dir
    app = ctx.manifest.app
    report_lines: list[str] = [
        f"Bootstrap phase 8 sanity sweep - {dt.datetime.now(dt.timezone.utc).isoformat()}",
    ]
    failures: list[tuple[int, str, str]] = []

    def record(check: int, name: str, ok: bool, detail: str = "") -> None:
        status = "PASS" if ok else "FAIL"
        line = f"  {check:2d}. {name:46s} {status}"
        if detail and not ok:
            line += f"  ({detail})"
        report_lines.append(line)
        logger.info(line.strip())
        if not ok:
            failures.append((check, name, detail))

    placeholders = ["myapp", "MyApp", "MYAPP", "EXAMPLE-DOMAIN", "pluginforge-app-template"]
    hits: list[str] = []
    for path in _iter_text_files(target):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for needle in placeholders:
            if needle in text:
                hits.append(f"{path.relative_to(target)}: {needle!r}")
                break
    record(1, "placeholders clean", not hits, f"{len(hits)} hits; first: {hits[0] if hits else ''}")

    template_hits: list[str] = []
    template_markers = ["# TEMPLATE:", "// TEMPLATE:", "/* TEMPLATE:"]
    for path in _iter_text_files(target):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for needle in template_markers:
            if needle in text:
                template_hits.append(f"{path.relative_to(target)}")
                break
    record(2, "no # TEMPLATE: markers", not template_hits,
           f"{len(template_hits)} hits; first: {template_hits[0] if template_hits else ''}")

    em_dash_hits: list[str] = []
    rules_dir = target / ".claude" / "rules"
    for path in _iter_text_files(target):
        if rules_dir in path.parents:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if "—" in text:
            em_dash_hits.append(f"{path.relative_to(target)}")
    record(3, "no em-dashes outside .claude/rules/", not em_dash_hits,
           f"{len(em_dash_hits)} files")

    backend_dir = target / "backend"
    env_test = f"{app.upper_name}_TEST"
    boot_env = os.environ.copy()
    boot_env[env_test] = "1"
    boot_env["TEST_DATABASE_URL"] = "sqlite:///:memory:"
    boot_check = subprocess.run(
        ["poetry", "run", "python", "-c",
         f"from app.main import app; "
         f"assert app.title == {app.pascal_name!r}, f'title={{app.title!r}}'"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        env=boot_env,
    )
    (target / ".bootstrap-phase8-4.log").write_text(
        boot_check.stdout + boot_check.stderr, encoding="utf-8",
    )
    record(4, "backend boots + title matches", boot_check.returncode == 0,
           f"see .bootstrap-phase8-4.log")

    if boot_check.returncode != 0:
        _finalize_phase8(ctx, report_lines, failures)
        raise SystemExit(1)

    def _run(check: int, name: str, cmd: list[str], cwd: Path) -> bool:
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, env=boot_env)
        (target / f".bootstrap-phase8-{check}.log").write_text(
            result.stdout + result.stderr, encoding="utf-8",
        )
        record(check, name, result.returncode == 0, f"see .bootstrap-phase8-{check}.log")
        return result.returncode == 0

    _run(5, "backend pytest green", ["poetry", "run", "pytest", "-q"], backend_dir)

    plugin_dirs = sorted((target / "plugins").glob(f"{app.name}-plugin-*/")) if (target / "plugins").exists() else []
    if not plugin_dirs:
        record(6, "plugin pytest (no plugins)", True)
    else:
        all_green = True
        for plugin_dir in plugin_dirs:
            ok = _run(6, f"plugin pytest: {plugin_dir.name}", ["poetry", "run", "pytest", "-q"], plugin_dir)
            all_green = all_green and ok
        record(6, "plugin pytest green", all_green)

    frontend_dir = target / "frontend"
    _run(7, "frontend npm run build", ["npm", "run", "build"], frontend_dir)
    _run(8, "frontend Vitest", ["npm", "run", "test"], frontend_dir)
    _run(9, "pre-commit run --all-files", ["pre-commit", "run", "--all-files"], target)
    _run(10, "frontend tsc --noEmit", ["npx", "tsc", "--noEmit"], frontend_dir)

    _finalize_phase8(ctx, report_lines, failures)
    if failures:
        raise SystemExit(1)


def _finalize_phase8(ctx: BootstrapContext, report_lines: list[str],
                     failures: list[tuple[int, str, str]]) -> None:
    """Write the phase 8 report + commit (if clean)."""
    target = ctx.target_dir
    report_lines.append("")
    if failures:
        report_lines.append(f"FAILED: {len(failures)} of 10 checks failed.")
        for check_num, name, detail in failures:
            report_lines.append(f"  check {check_num} - {name}: {detail}")
    else:
        report_lines.append("PASS: all 10 checks green.")
    (target / ".bootstrap-phase8-report.txt").write_text("\n".join(report_lines) + "\n", encoding="utf-8")

    if not failures:
        (target / ".bootstrap-complete").write_text(
            f"bootstrap complete; all phase 8 checks passed at "
            f"{dt.datetime.now(dt.timezone.utc).isoformat()}\n",
            encoding="utf-8",
        )
        _git_commit(target, "chore: bootstrap phase 8 sanity sweep (all checks pass)")


# --- CLI ----------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="bootstrap-app")
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--target-dir", required=True, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-migration", action="store_true")
    parser.add_argument("--with-example-plugin", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="[%(levelname)s] %(message)s",
    )

    template_root = Path(__file__).resolve().parent.parent.parent
    target = args.target_dir.resolve()

    _refuse_self_bootstrap(template_root, target)
    manifest = load_manifest(args.manifest.resolve())

    ctx = BootstrapContext(
        template_root=template_root,
        target_dir=target,
        manifest=manifest,
        dry_run=args.dry_run,
        skip_migration=args.skip_migration,
        with_example_plugin=args.with_example_plugin,
    )

    phase1_bootstrap(ctx)
    phase2_rename(ctx)
    phase3_domain_swap(ctx)
    phase4_crud(ctx)
    phase5_plugin_skeleton(ctx)
    phase6_frontend_shell(ctx)
    phase7_docs(ctx)
    phase8_sanity_sweep(ctx)

    logger.info("Bootstrap complete. Target: %s", target)
    return 0


def _refuse_self_bootstrap(template_root: Path, target: Path) -> None:
    if target == template_root:
        raise SystemExit(
            f"refusing to bootstrap into the template repo itself: {target}",
        )
    config = template_root / ".git" / "config"
    if config.exists() and target == template_root:
        raise SystemExit(
            "target-dir resolves to the template repo; refusing to self-bootstrap.",
        )


if __name__ == "__main__":
    sys.exit(main())
