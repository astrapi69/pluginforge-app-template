/**
 * "Check for updates" control (GitHub Releases).
 *
 * A building block for the About tab / a desktop launcher: click to compare
 * the running version against the latest GitHub Release and show the result
 * with a link. Pass your repo's `owner`/`repo`; `currentVersion` defaults to
 * the build-time `__APP_VERSION__`.
 *
 * @example
 * <UpdateCheckControl owner="astrapi69" repo="pluginforge-app-template" />
 */
import {ArrowUpCircle, CheckCircle2, RefreshCw, TriangleAlert} from "lucide-react";
import {useI18n} from "../hooks/useI18n";
import {useUpdateCheck} from "../hooks/useUpdateCheck";
import styles from "./UpdateCheckControl.module.css";

export interface UpdateCheckControlProps {
  owner: string;
  repo: string;
  currentVersion?: string;
}

export default function UpdateCheckControl({owner, repo, currentVersion = __APP_VERSION__}: UpdateCheckControlProps) {
  const {t} = useI18n();
  const {state, latest, check} = useUpdateCheck({owner, repo, currentVersion});

  return (
    <div className={styles.wrap} data-testid="update-check">
      <button
        type="button"
        className={styles.btn}
        onClick={() => void check()}
        disabled={state === "checking"}
        data-testid="update-check-button"
      >
        <RefreshCw size={16} aria-hidden className={state === "checking" ? styles.spin : undefined} />
        {t("ui.update_check.button", "Nach Updates suchen")}
      </button>

      {state === "current" ? (
        <span className={styles.current} data-testid="update-check-current">
          <CheckCircle2 size={16} aria-hidden />
          {t("ui.update_check.current", "Du verwendest die aktuelle Version ({version}).").replace("{version}", currentVersion)}
        </span>
      ) : null}

      {state === "available" && latest ? (
        <a
          className={styles.available}
          href={latest.url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="update-check-available"
        >
          <ArrowUpCircle size={16} aria-hidden />
          {t("ui.update_check.available", "Version {version} ist verfügbar").replace("{version}", latest.version)}
        </a>
      ) : null}

      {state === "error" ? (
        <span className={styles.error} data-testid="update-check-error">
          <TriangleAlert size={16} aria-hidden />
          {t("ui.update_check.error", "Update-Prüfung fehlgeschlagen")}
        </span>
      ) : null}
    </div>
  );
}
