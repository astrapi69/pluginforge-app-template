/**
 * PWA update prompt.
 *
 * vite-plugin-pwa is configured with `registerType: "prompt"`, so a newly
 * deployed service worker waits instead of taking over silently. This
 * banner surfaces "a new version is available" and lets the user reload
 * into it on demand (`updateServiceWorker(true)` activates the waiting SW
 * and reloads). Renders nothing until an update is actually waiting.
 *
 * The `virtual:pwa-register/react` module is provided by vite-plugin-pwa at
 * build/dev time (types via `vite-plugin-pwa/react` in `vite-env.d.ts`). In
 * tests it is mocked.
 */
import {RefreshCw, X} from "lucide-react";
import {useRegisterSW} from "virtual:pwa-register/react";
import {useI18n} from "../../hooks/useI18n";
import styles from "./UpdatePrompt.module.css";

export default function UpdatePrompt() {
  const {t} = useI18n();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div role="alert" aria-live="polite" className={styles.banner} data-testid="update-prompt">
      <span className={styles.message}>
        {t("ui.update.available", "Eine neue Version ist verfügbar.")}
      </span>
      <button
        type="button"
        className={styles.reload}
        onClick={() => void updateServiceWorker(true)}
        data-testid="update-reload"
      >
        <RefreshCw size={14} aria-hidden />
        {t("ui.update.reload", "Aktualisieren")}
      </button>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => setNeedRefresh(false)}
        aria-label={t("ui.update.dismiss", "Schließen")}
        data-testid="update-dismiss"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
