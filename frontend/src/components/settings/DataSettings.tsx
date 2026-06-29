/**
 * Data settings: backup export/import + offline-cache management.
 *
 * - Export downloads a full backup archive (GET /api/backup/export).
 * - Import restores from an uploaded archive (POST /api/backup/import),
 *   behind a confirm dialog because it overwrites existing data.
 * - "Clear cache" wipes the PWA precache + service workers (the typical
 *   fix for a stale deploy) and reloads.
 *
 * IMPORTANT: any change touching backup must pass the manual
 * export -> import round-trip with real data in `make dev`
 * (quality-checks.md BACKUP-AKZEPTANZTEST) before merge. Unit tests are
 * necessary but not sufficient.
 */
import {useRef, useState} from "react";
import {Download, Loader2, Trash2, Upload} from "lucide-react";
import {ApiError} from "../../api/client";
import {getStorage} from "../../storage";
import {useI18n} from "../../hooks/useI18n";
import {useDialog} from "../AppDialog";
import {notify} from "../../utils/notify";
import {clearAppCaches} from "../../utils/pwaCache";
import styles from "./DataSettings.module.css";

type Busy = "import" | "cache" | null;

export function DataSettings() {
  const {t} = useI18n();
  const {confirm} = useDialog();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Busy>(null);

  const handleExport = () => {
    // FileResponse on the backend carries Content-Disposition, so a plain
    // anchor download picks up the server-suggested filename.
    const anchor = document.createElement("a");
    anchor.href = getStorage().backup.exportUrl();
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    notify.success(t("ui.data.export_done", "Backup wird heruntergeladen"));
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const ok = await confirm(
      t("ui.data.import_title", "Backup importieren?"),
      t("ui.data.import_warn", "Vorhandene Daten werden durch das Backup ersetzt. Fortfahren?"),
      "danger",
    );
    if (!ok) return;
    setBusy("import");
    try {
      const result = await getStorage().backup.import(file);
      const total = result.imported_books + (result.imported_articles ?? 0);
      notify.success(
        t("ui.data.import_done", "Backup importiert: {count} Einträge").replace("{count}", String(total)),
      );
    } catch (err) {
      notify.error(
        err instanceof ApiError ? err.detail : t("ui.data.import_error", "Import fehlgeschlagen"),
        err,
      );
    } finally {
      setBusy(null);
    }
  };

  const handleClearCache = async () => {
    const ok = await confirm(
      t("ui.data.cache_title", "Cache leeren?"),
      t("ui.data.cache_warn", "Der Offline-Cache wird geleert und die App neu geladen. Lokale Daten bleiben erhalten."),
    );
    if (!ok) return;
    setBusy("cache");
    try {
      await clearAppCaches();
      window.location.reload();
    } catch (err) {
      notify.error(t("ui.data.cache_error", "Cache konnte nicht geleert werden"), err);
      setBusy(null);
    }
  };

  return (
    <div data-testid="data-settings">
      <h2 className={styles.title}>{t("ui.settings.tab_data", "Daten")}</h2>

      <section className={styles.section}>
        <h3 className={styles.heading}>{t("ui.data.backup_title", "Backup")}</h3>
        <p className={styles.help}>
          {t("ui.data.backup_help", "Sichere alle Daten in eine Datei oder stelle sie aus einem Backup wieder her.")}
        </p>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.btn}
            onClick={handleExport}
            disabled={busy !== null}
            data-testid="data-export"
          >
            <Download size={16} aria-hidden />
            {t("ui.data.export", "Exportieren")}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            data-testid="data-import"
          >
            {busy === "import" ? <Loader2 size={16} className={styles.spin} aria-hidden /> : <Upload size={16} aria-hidden />}
            {t("ui.data.import", "Importieren")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".bgb,.zip,application/octet-stream,application/zip"
            className={styles.hiddenInput}
            onChange={handleImportFile}
            data-testid="data-import-input"
          />
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>{t("ui.data.cache_section", "Offline-Cache")}</h3>
        <p className={styles.help}>
          {t("ui.data.cache_help", "Leere den Cache der installierten App, falls nach einem Update veraltete Inhalte erscheinen.")}
        </p>
        <button
          type="button"
          className={styles.btnDanger}
          onClick={handleClearCache}
          disabled={busy !== null}
          data-testid="data-clear-cache"
        >
          {busy === "cache" ? <Loader2 size={16} className={styles.spin} aria-hidden /> : <Trash2 size={16} aria-hidden />}
          {t("ui.data.clear_cache", "Cache leeren & neu laden")}
        </button>
      </section>
    </div>
  );
}

export default DataSettings;
