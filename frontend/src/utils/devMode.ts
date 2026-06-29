/**
 * Developer Mode (docs/patterns/06-friendly-errors.md).
 *
 * Off by default. When ON, error toasts show the raw technical detail
 * (status, endpoint, stacktrace) instead of the friendly user message - for
 * debugging. Persisted in localStorage so it survives reloads. Toggle it
 * from Settings > About.
 */
const KEY = "myapp.devMode";

export function isDevMode(): boolean {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function setDevMode(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "true" : "false");
  } catch {
    /* storage unavailable (private mode); dev mode just stays off */
  }
}
