/**
 * Friendly error messages (docs/patterns/06-friendly-errors.md).
 *
 * Production users should never see a raw HTTP `detail` or a stacktrace in a
 * toast. This maps an {@link ApiError} to a calm, localized message by status
 * class. Developer Mode (utils/devMode) bypasses the mapping and returns the
 * raw detail so developers still get the actionable text. The "Report issue"
 * action always carries the full technical detail regardless of mode.
 *
 * i18n: messages resolve via the non-hook `translate()` accessor against the
 * `ui.errors.*` keys; the English fallbacks here are used until an app adds
 * those keys to its catalogs (so the feature works with zero i18n setup).
 */
import {ApiError} from "../api/client";
import {translate} from "../hooks/useI18n";
import {isDevMode} from "./devMode";

function keyForStatus(status: number): {key: string; fallback: string} {
  if (status === 404) return {key: "ui.errors.not_found", fallback: "We couldn't find what you were looking for."};
  if (status === 400 || status === 422) return {key: "ui.errors.validation", fallback: "Some of the information looks off. Please check and try again."};
  if (status === 409) return {key: "ui.errors.conflict", fallback: "That action conflicts with the current state. Please reload and retry."};
  if (status === 413) return {key: "ui.errors.too_large", fallback: "That file or request is too large."};
  if (status === 0) return {key: "ui.errors.network", fallback: "Can't reach the server. Check your connection and try again."};
  if (status >= 500) return {key: "ui.errors.server", fallback: "Something went wrong on our side. Please try again."};
  return {key: "ui.errors.unexpected", fallback: "Something unexpected happened. Please try again."};
}

/**
 * Resolve the message to SHOW the user for a failed action.
 *
 * @param rawMessage the message the caller would have shown (usually
 *   `error.detail`); returned as-is in Developer Mode or for non-ApiErrors.
 * @param error the caught error; when it's an ApiError and Developer Mode is
 *   off, a friendly status-mapped message is returned instead.
 */
export function friendlyMessage(rawMessage: string, error?: unknown): string {
  if (isDevMode()) return rawMessage;
  if (error instanceof ApiError) {
    const {key, fallback} = keyForStatus(error.status);
    return translate(key, fallback);
  }
  return rawMessage;
}
