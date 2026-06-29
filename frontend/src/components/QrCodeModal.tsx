/**
 * QR-code modal.
 *
 * Renders a scannable QR code of a URL with copy-link, download-PNG and
 * (where supported) native-share actions. Lightweight custom overlay rather
 * than a Radix Dialog (lessons-learned: Radix portals are brittle under
 * happy-dom). Generic - pass any URL/title.
 */
import {useEffect, useState} from "react";
import QRCode from "qrcode";
import {Copy, Download, Share2, X} from "lucide-react";
import {useI18n} from "../hooks/useI18n";
import {copyToClipboard} from "../utils/clipboard";
import {notify} from "../utils/notify";
import styles from "./QrCodeModal.module.css";

export interface QrCodeModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  title?: string;
}

export default function QrCodeModal({open, onClose, url, title}: QrCodeModalProps) {
  const {t} = useI18n();
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    QRCode.toDataURL(url, {width: 240, margin: 1})
      .then((generated) => {
        if (!cancelled) setDataUrl(generated);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  if (!open) return null;

  const copyLink = async () => {
    const ok = await copyToClipboard(url);
    if (ok) notify.success(t("ui.share.link_copied", "Link kopiert"));
  };

  const downloadPng = () => {
    if (!dataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = "qr-code.png";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({title: title ?? document.title, url}).catch(() => undefined);
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className={styles.backdrop} onMouseDown={onClose} data-testid="qr-modal-backdrop">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? t("ui.share.title", "App teilen")}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === "Escape" && onClose()}
        data-testid="qr-modal"
      >
        <div className={styles.header}>
          <h3 className={styles.title}>{title ?? t("ui.share.title", "App teilen")}</h3>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t("ui.common.close", "Schließen")}
            data-testid="qr-modal-close"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {dataUrl ? (
          <img className={styles.qr} src={dataUrl} alt={t("ui.share.qr_alt", "QR-Code")} data-testid="qr-modal-image" />
        ) : (
          <div className={styles.qrPlaceholder} data-testid="qr-modal-placeholder" />
        )}

        <p className={styles.url} data-testid="qr-modal-url">{url}</p>

        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={copyLink} data-testid="qr-modal-copy">
            <Copy size={16} aria-hidden />
            {t("ui.share.copy_link", "Link kopieren")}
          </button>
          <button type="button" className={styles.action} onClick={downloadPng} data-testid="qr-modal-download">
            <Download size={16} aria-hidden />
            {t("ui.share.download", "PNG speichern")}
          </button>
          {canShare ? (
            <button type="button" className={styles.action} onClick={() => void share()} data-testid="qr-modal-share">
              <Share2 size={16} aria-hidden />
              {t("ui.share.share", "Teilen")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
