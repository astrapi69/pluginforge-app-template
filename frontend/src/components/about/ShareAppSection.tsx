/**
 * "Share this app" section for the About tab: a button that opens a QR-code
 * modal of the app URL. Defaults to the current origin; pass `appUrl` to
 * share a fixed public URL instead.
 */
import {useState} from "react";
import {QrCode} from "lucide-react";
import {useI18n} from "../../hooks/useI18n";
import QrCodeModal from "../QrCodeModal";
import styles from "./About.module.css";

export interface ShareAppSectionProps {
  appUrl?: string;
}

export default function ShareAppSection({appUrl}: ShareAppSectionProps) {
  const {t} = useI18n();
  const [open, setOpen] = useState(false);
  const url = appUrl ?? (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <section className={styles.section} data-testid="about-share">
      <h3 className={styles.heading}>{t("ui.about.share_title", "App teilen")}</h3>
      <button
        type="button"
        className={styles.link}
        onClick={() => setOpen(true)}
        data-testid="about-share-button"
      >
        <QrCode size={16} aria-hidden />
        <span>{t("ui.about.share_action", "QR-Code anzeigen")}</span>
      </button>
      <QrCodeModal
        open={open}
        onClose={() => setOpen(false)}
        url={url}
        title={t("ui.about.share_title", "App teilen")}
      />
    </section>
  );
}
