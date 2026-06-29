/**
 * PWA install prompt (Add to Home Screen).
 *
 * Captures the browser's `beforeinstallprompt` event and offers an
 * "Install app" affordance. Renders nothing when the browser has not
 * fired the event (already installed, unsupported, or running in
 * standalone display mode), or after the user installs/dismisses it.
 *
 * Dependency-free: no PWA-install library, just the platform event.
 */
import {useEffect, useState} from "react";
import {Download, X} from "lucide-react";
import {useI18n} from "../../hooks/useI18n";
import styles from "./UpdatePrompt.module.css";

/** Minimal shape of the non-standard beforeinstallprompt event. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: "accepted" | "dismissed"}>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as {standalone?: boolean}).standalone === true
  );
}

export default function InstallPrompt() {
  const {t} = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    const onInstalled = () => setDeferred(null);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred) return null;

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <div role="dialog" aria-live="polite" className={styles.banner} data-testid="install-prompt">
      <span className={styles.message}>
        {t("ui.install.available", "Diese App lässt sich installieren.")}
      </span>
      <button
        type="button"
        className={styles.reload}
        onClick={() => void install()}
        data-testid="install-accept"
      >
        <Download size={14} aria-hidden />
        {t("ui.install.action", "Installieren")}
      </button>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => setDeferred(null)}
        aria-label={t("ui.install.dismiss", "Schließen")}
        data-testid="install-dismiss"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
