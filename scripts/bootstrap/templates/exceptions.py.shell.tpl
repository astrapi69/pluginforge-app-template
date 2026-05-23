"""Domain exception hierarchy.

Per ``.claude/rules/code-hygiene.md``: services raise typed
``${pascal_name}Error`` subclasses; the global handler in ``main.py`` maps them
to HTTP status codes. Routers stay thin; they catch nothing.
"""


class ${pascal_name}Error(Exception):
    """Base for domain errors. Each subclass pins its HTTP status."""

    status_code: int = 500

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


class NotFoundError(${pascal_name}Error):
    """Resource lookup miss (-> HTTP 404)."""

    status_code = 404


class ValidationError(${pascal_name}Error):
    """Domain validation failed (-> HTTP 400)."""

    status_code = 400


class ConflictError(${pascal_name}Error):
    """Resource already exists or state conflict (-> HTTP 409)."""

    status_code = 409


class PayloadTooLargeError(${pascal_name}Error):
    """Upload exceeds size cap (-> HTTP 413)."""

    status_code = 413


class ExternalServiceError(${pascal_name}Error):
    """External dependency unreachable or returned an error (-> HTTP 502)."""

    status_code = 502

    def __init__(self, service: str, detail: str):
        self.service = service
        super().__init__(f"{service}: {detail}")
