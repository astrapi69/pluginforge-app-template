# Pattern: Friendly error messages

> Backported from adaptive-learner. Template-neutral; adapt the names to your app.

**Status in this template:** **shipped.** On top of the backend exception hierarchy (`MyAppError` + global handler) and the frontend `ApiError` class, the friendly layer now ships: `utils/friendlyError.ts` maps an `ApiError` by status class to a calm message (resolved via the `ui.errors.*` keys with English fallbacks, so it works before an app adds catalog entries); `utils/devMode.ts` + a Settings > About toggle gate the raw technical detail (off by default); and `notify.error` shows the friendly message while the "Report issue" action still carries the full raw detail + stacktrace. A non-hook `translate()` accessor on `hooks/useI18n.ts` lets module-level code localize without a hook.

## Why

Modern users close the tab on the first raw "HTTP 404", endpoint path, or Python stacktrace that appears in a toast. At the same time, developers cannot file an actionable bug report without that detail. The pattern serves both audiences without leaking internals in production: the user sees a friendly, localized message; the stacktrace is captured silently and surfaced only to someone who turned on Dev Mode or clicked "Report Issue".

Generic messages like "Save failed" with no detail are equally forbidden. They look friendly but produce worthless bug reports. The goal is a friendly surface with a precise interior.

## The pattern

The chain has four layers, each handling only what it owns.

**Layer 1 - Backend domain exceptions.** Services raise `MyAppError` subclasses, never `HTTPException`. The subclass encodes the HTTP status as a class attribute:

```python
# backend/app/exceptions.py
NotFoundError    -> 404
ValidationError  -> 400
ConflictError    -> 409
PayloadTooLargeError -> 413
ExternalServiceError -> 502  # takes service name + detail
```

Routers are thin and catch nothing. A single `@app.exception_handler(MyAppError)` in `main.py` maps `exc.status_code` to the HTTP status, logs 4xx as WARNING and 5xx as ERROR with `exc_info`. In `DEBUG` mode the handler also attaches `stacktrace`, `endpoint`, and `method` to the response body - the "Report Issue" flow depends on this. In production those fields are absent.

**Layer 2 - Frontend ApiError.** The `request()` helper in `client.ts` is the only place `fetch` lives. Every non-ok response is converted to a typed `ApiError(status, detail, endpoint, method, stacktrace)`. Components always receive a typed error; they never parse raw responses themselves.

**Layer 3 - Friendly mapping.** A `friendlyError(err: ApiError, t: TranslateFn): string` helper maps each error to a `ui.errors.*` i18n key so a production toast reads "Could not save your settings" rather than the raw `detail` string from the backend. Every call site uses this mapper. A short fallback string catches any unmapped case so the UI never breaks.

**Layer 4 - Dev Mode and Report Issue.** A Dev-Mode toggle in Settings (off by default) flips the toast to show `detail`, `endpoint`, `method`, and `stacktrace` raw - useful when debugging without opening browser devtools. A visible `DEV` badge in the nav reinforces that the mode is active. On any 5xx toast, a "Report Issue" action opens a pre-filled GitHub issue with the error detail as the title and the stacktrace, app version, and browser string in the body.

## What the template already provides

- `backend/app/exceptions.py` - the full `MyAppError` hierarchy with `status_code` as a class attribute on each subclass.
- `backend/app/main.py` - `@app.exception_handler(MyAppError)` that reads `exc.status_code` and returns a `JSONResponse`; the catch-all `Exception` handler that attaches `stacktrace` / `endpoint` / `method` when `DEBUG` is true.
- `frontend/src/api/client.ts` - the `ApiError` class (lines 1032-1061) with `status`, `detail`, `endpoint`, `method`, `stacktrace`, and `timestamp` fields; the `request()` helper that throws `ApiError` on every non-ok response.

The backbone is in place. What is missing is the UI-facing mapping and the developer ergonomics layer.

## To complete it

1. **Add `ui.errors.*` keys to the i18n catalogs.** One key per common status class plus a fallback. For example: `ui.errors.not_found`, `ui.errors.validation`, `ui.errors.conflict`, `ui.errors.server_error`, `ui.errors.network`, `ui.errors.unexpected`. Refer to the future `05-i18n-sync.md` pattern for the sync workflow between backend YAML catalogs and the frontend JSON bundles.

2. **Add a `friendlyError` mapper.** A small pure function (not inside any component):

   ```typescript
   function friendlyError(err: ApiError, t: (key: string) => string): string {
     if (err.status === 404) return t("ui.errors.not_found");
     if (err.status === 400 || err.status === 422) return t("ui.errors.validation");
     if (err.status === 409) return t("ui.errors.conflict");
     if (err.status >= 500) return t("ui.errors.server_error");
     return err.detail || t("ui.errors.unexpected");
   }
   ```

   Every `catch` block that calls `toast.error` passes the result of `friendlyError` rather than `err.detail` directly.

3. **Add a Dev-Mode setting** (persisted, off by default). When on, toasts display `err.detail`, `err.endpoint`, `err.method`, and `err.stacktrace` raw, and a small `DEV` badge appears in the navigation bar. When off, toasts use the `friendlyError` string.

4. **Add the "Report Issue" action on 5xx toasts.** Construct a GitHub Issues URL with the error detail as the title and a body pre-populated from `err.stacktrace`, the app version (`__APP_VERSION__`), and `navigator.userAgent`. This turns a friendly production toast into an actionable developer report without asking the user to copy-paste anything.

5. **Ensure DEBUG-mode backend responses carry the stacktrace.** The `global_exception_handler` in `main.py` already does this for unhandled `Exception`. The `myapp_error_handler` for `MyAppError` subclasses does not yet attach `stacktrace`; extend it to do so when `DEBUG` is true so that 4xx errors also populate `err.stacktrace` on the frontend for detailed investigation.

## Gotchas

- **Raw detail must never reach a production toast.** Route every `toast.error` through the friendly mapper. The single most common mistake is `toast.error(err.detail)` directly in a component - this passes code review because it looks explicit, but it exposes endpoint paths and internal messages in production.

- **Every `except` block must log, never swallow.** Services must include `str(e)` in the `MyAppError` subclass they raise. A bare `except Exception: pass` turns every downstream error into a mystery. Log at ERROR for 5xx, WARNING for 4xx.

- **Services must not throw `HTTPException`.** `HTTPException` couples the service layer to FastAPI, makes unit testing require a full ASGI stack, and bypasses the typed `MyAppError` handler. If you inherit service code that raises `HTTPException`, replace it with the appropriate `MyAppError` subclass before adding tests.

- **Wrap every external-service call in `ExternalServiceError`.** AI providers, object storage, email relays - anything outside the process boundary. The constructor takes a `service` name (`"openai"`, `"s3"`, etc.) so the log and the user-facing message name the dependency that failed, not just the operation.

- **Keep the fallback string.** The `friendlyError` mapper will inevitably encounter a status code that has no dedicated i18n key. The final `return err.detail || t("ui.errors.unexpected")` line ensures the UI never breaks and the user sees something readable even before all keys are filled in.

- **The `ui.errors.*` gap is a silent failure mode.** If `t("ui.errors.not_found")` returns the raw key string (because the catalog is missing the entry), the toast displays `"ui.errors.not_found"` verbatim - technically not a crash, but visually worse than the raw HTTP detail it replaced. Add a CI or Vitest check that walks every `t(...)` call in the mapper and asserts the key resolves.
