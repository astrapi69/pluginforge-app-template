/**
 * App-wide error boundary.
 *
 * Catches render-time errors in its subtree so a single broken view shows
 * a recoverable fallback instead of a blank white screen. The fallback
 * offers a reload and a "report issue" action that reuses the existing
 * `myapp:open-error-report` event -> ErrorReportDialog pipeline.
 *
 * Mount it INSIDE the providers (so the fallback can use i18n) but AROUND
 * the routed page content, leaving the ErrorReportDialog host outside its
 * subtree so "report" still works after a crash.
 */
import {Component, type ErrorInfo, type ReactNode} from "react";
import {AlertTriangle, RefreshCw, Bug} from "lucide-react";
import {useI18n} from "../hooks/useI18n";
import styles from "./ErrorBoundary.module.css";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function ErrorFallback({error, onReload, onReport}: {error: Error; onReload: () => void; onReport: () => void}) {
  const {t} = useI18n();
  return (
    <div className={styles.wrap} role="alert" data-testid="error-boundary">
      <AlertTriangle size={32} aria-hidden className={styles.icon} />
      <h1 className={styles.title}>{t("ui.error_boundary.title", "Etwas ist schiefgelaufen")}</h1>
      <p className={styles.message}>
        {t("ui.error_boundary.body", "Diese Ansicht ist auf einen Fehler gestoßen. Du kannst die Seite neu laden oder den Fehler melden.")}
      </p>
      <pre className={styles.detail} data-testid="error-boundary-detail">{error.message}</pre>
      <div className={styles.actions}>
        <button type="button" className={styles.reload} onClick={onReload} data-testid="error-boundary-reload">
          <RefreshCw size={16} aria-hidden />
          {t("ui.error_boundary.reload", "Neu laden")}
        </button>
        <button type="button" className={styles.report} onClick={onReport} data-testid="error-boundary-report">
          <Bug size={16} aria-hidden />
          {t("ui.error_boundary.report", "Fehler melden")}
        </button>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {error: null};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleReport = (): void => {
    window.dispatchEvent(
      new CustomEvent("myapp:open-error-report", {
        detail: {message: this.state.error?.message ?? "Unknown render error"},
      }),
    );
  };

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onReload={this.handleReload} onReport={this.handleReport} />;
    }
    return this.props.children;
  }
}
