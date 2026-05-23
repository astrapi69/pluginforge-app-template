"""${pascal_name} Pydantic schemas.

One module per entity. Create/Update/Read shapes follow the convention
used by sibling PluginForge applications: ``XxxCreate`` for POST,
``XxxUpdate`` for PATCH (all fields optional), ``XxxRead`` for the
serialised DB row.
"""

${entity_imports}

__all__ = [
${all_names}
]
