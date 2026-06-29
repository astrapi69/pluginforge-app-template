/**
 * Developer Mode toggle for the About tab (docs/patterns/06-friendly-errors.md).
 *
 * Off by default. When on, error toasts show the raw technical detail
 * (status, endpoint, stacktrace) instead of the friendly user message.
 */
import {useId, useState} from "react";
import {useI18n} from "../../hooks/useI18n";
import {isDevMode, setDevMode} from "../../utils/devMode";
import styles from "./About.module.css";

export default function DevModeSection() {
  const {t} = useI18n();
  const [on, setOn] = useState(isDevMode());
  const id = useId();

  const toggle = (next: boolean) => {
    setDevMode(next);
    setOn(next);
  };

  return (
    <section className={styles.section} data-testid="about-devmode">
      <h3 className={styles.heading}>{t("ui.about.devmode_title", "Developer Mode")}</h3>
      <label htmlFor={id} className={styles.toggleRow}>
        <input
          id={id}
          type="checkbox"
          checked={on}
          onChange={(event) => toggle(event.target.checked)}
          data-testid="devmode-toggle"
        />
        <span>
          {t("ui.about.devmode_label", "Show raw technical error details (for debugging)")}
        </span>
      </label>
    </section>
  );
}
