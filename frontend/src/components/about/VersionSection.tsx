/**
 * Version block for the About tab.
 *
 * Reads the build-time `__APP_VERSION__` literal (single source of truth:
 * frontend/package.json, injected by Vite's `define` - see
 * docs/patterns/03-release-automation.md). No hardcoded version string.
 */
import {useI18n} from "../../hooks/useI18n";
import styles from "./About.module.css";

export interface VersionSectionProps {
  /** App display name. Defaults to the i18n app name / "MyApp". */
  appName?: string;
}

export function VersionSection({appName}: VersionSectionProps) {
  const {t} = useI18n();
  const name = appName ?? t("ui.app.name", "MyApp");
  return (
    <section className={styles.section} data-testid="about-version">
      <h3 className={styles.heading}>{t("ui.about.version_title", "Version")}</h3>
      <dl className={styles.defs}>
        <dt>{name}</dt>
        <dd data-testid="about-app-version">v{__APP_VERSION__}</dd>
      </dl>
    </section>
  );
}

export default VersionSection;
