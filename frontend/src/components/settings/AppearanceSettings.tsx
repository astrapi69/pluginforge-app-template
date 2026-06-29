/**
 * Appearance settings: light/dark mode + colour palette.
 *
 * Surfaces the existing {@link useTheme} hook (today only reachable via the
 * nav `ThemeToggle`) as a proper Settings section, and exposes the full
 * `PALETTES` list instead of just the light/dark toggle. Choices persist to
 * localStorage and flip the `data-theme` / `data-app-theme` attributes via
 * the hook's effects.
 */
import {Check, Moon, Sun} from "lucide-react";
import {useI18n} from "../../hooks/useI18n";
import {useTheme} from "../../hooks/useTheme";
import {PALETTES} from "../../themes/palettes";
import styles from "./AppearanceSettings.module.css";

export function AppearanceSettings() {
  const {t} = useI18n();
  const {theme, toggle, appTheme, setAppTheme} = useTheme();

  const setMode = (mode: "light" | "dark") => {
    if (theme !== mode) toggle();
  };

  return (
    <div data-testid="appearance-settings">
      <h2 className={styles.title}>{t("ui.settings.tab_appearance", "Darstellung")}</h2>

      <section className={styles.section}>
        <h3 className={styles.heading}>{t("ui.appearance.mode", "Modus")}</h3>
        <div className={styles.modeRow} role="group" aria-label={t("ui.appearance.mode", "Modus")}>
          <button
            type="button"
            className={styles.modeBtn}
            aria-pressed={theme === "light"}
            data-active={theme === "light"}
            data-testid="appearance-mode-light"
            onClick={() => setMode("light")}
          >
            <Sun size={16} aria-hidden />
            {t("ui.appearance.light", "Hell")}
          </button>
          <button
            type="button"
            className={styles.modeBtn}
            aria-pressed={theme === "dark"}
            data-active={theme === "dark"}
            data-testid="appearance-mode-dark"
            onClick={() => setMode("dark")}
          >
            <Moon size={16} aria-hidden />
            {t("ui.appearance.dark", "Dunkel")}
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>{t("ui.appearance.palette", "Farbschema")}</h3>
        <div className={styles.paletteGrid} role="radiogroup" aria-label={t("ui.appearance.palette", "Farbschema")}>
          {PALETTES.map((palette) => (
            <button
              key={palette.id}
              type="button"
              role="radio"
              aria-checked={appTheme === palette.id}
              className={styles.paletteBtn}
              data-active={appTheme === palette.id}
              data-testid={`appearance-palette-${palette.id}`}
              onClick={() => setAppTheme(palette.id)}
            >
              <span>{t(`ui.themes.${palette.id}`, palette.label)}</span>
              {appTheme === palette.id ? <Check size={14} aria-hidden /> : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AppearanceSettings;
