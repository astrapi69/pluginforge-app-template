"""${pascal_name} hook specifications.

Defines the hooks that plugins can implement. Uses pluggy's
``HookspecMarker`` for type-safe hook dispatch.

The bootstrap registers a single placeholder hook so the plugin
manager can mount cleanly even with zero plugins. Domain plugins
extend this surface with feature-specific hooks as they land.
"""

from typing import Any

import pluggy

hookspec = pluggy.HookspecMarker("${name}.plugins")


class ${pascal_name}HookSpec:
    """Hook specifications for the ${pascal_name} application."""

    @hookspec
    def app_ready(self, app_id: str, app_version: str) -> dict[str, Any] | None:  # type: ignore[empty-body]
        """Notify a plugin that the host application has finished booting.

        Plugins may return a small dict of diagnostic metadata for
        logging; the return value is not load-bearing.
        """
        ...
