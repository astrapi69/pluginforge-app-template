/**
 * About tab for the Settings page.
 *
 * Near-universal app surface: app version, links (source / docs / license),
 * and credits. Template-neutral - replace the placeholder `APP_LINKS` URLs
 * and the credits copy with your app's. Composes {@link VersionSection}.
 */
import {BookOpen, Code2, ExternalLink, Scale} from "lucide-react";
import {useI18n} from "../../hooks/useI18n";
import VersionSection from "./VersionSection";
import ShareAppSection from "./ShareAppSection";
import UpdateCheckControl from "../UpdateCheckControl";
import styles from "./About.module.css";

// Replace with your app's GitHub repo (used by the update check).
const REPO_OWNER = "astrapi69";
const REPO_NAME = "pluginforge-app-template";

interface AppLink {
  key: string;
  href: string;
  labelKey: string;
  fallback: string;
  icon: typeof Code2;
}

// Replace these with your app's URLs when you customize the template.
const APP_LINKS: AppLink[] = [
  {
    key: "repo",
    href: "https://github.com/astrapi69/pluginforge-app-template",
    labelKey: "ui.about.link_repo",
    fallback: "Source code",
    icon: Code2,
  },
  {
    key: "docs",
    href: "https://github.com/astrapi69/pluginforge-app-template#readme",
    labelKey: "ui.about.link_docs",
    fallback: "Documentation",
    icon: BookOpen,
  },
  {
    key: "license",
    href: "https://github.com/astrapi69/pluginforge-app-template/blob/main/LICENSE",
    labelKey: "ui.about.link_license",
    fallback: "License (MIT)",
    icon: Scale,
  },
];

export default function AboutTab() {
  const {t} = useI18n();
  return (
    <div data-testid="about-tab">
      <h2 className={styles.title}>{t("ui.about.title", "Über diese App")}</h2>

      <VersionSection />

      <section className={styles.section} data-testid="about-links">
        <h3 className={styles.heading}>{t("ui.about.links_title", "Links")}</h3>
        <ul className={styles.links}>
          {APP_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.key}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                  data-testid={`about-link-${link.key}`}
                >
                  <Icon size={16} aria-hidden />
                  <span>{t(link.labelKey, link.fallback)}</span>
                  <ExternalLink size={12} aria-hidden className={styles.extIcon} />
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.section} data-testid="about-updates">
        <h3 className={styles.heading}>{t("ui.about.updates_title", "Updates")}</h3>
        <UpdateCheckControl owner={REPO_OWNER} repo={REPO_NAME} />
      </section>

      <ShareAppSection />

      <section className={styles.section} data-testid="about-credits">
        <h3 className={styles.heading}>{t("ui.about.credits_title", "Credits")}</h3>
        <p className={styles.credits}>
          {t(
            "ui.about.credits_body",
            "Gebaut mit dem PluginForge App Template (FastAPI + React + PluginForge). MIT-Lizenz.",
          )}
        </p>
      </section>
    </div>
  );
}
