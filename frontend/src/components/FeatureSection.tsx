/**
 * Feature-state section wrapper (active / disabled / hidden).
 *
 * Implements the feature-state policy from `.claude/rules/architecture.md`
 * without pulling in a dependency: everything the user owns is visible -
 * either `active` (renders its controls) or `disabled` (keeps its header
 * and shows a localized reason instead of the controls). `hidden` is
 * reserved for dev-only flags and renders nothing.
 *
 * For real, reactive feature gating across the whole app, adopt
 * `@astrapi69/feature-strategy` - see `.claude/prompts/feature-strategy.md`.
 * This component is the dependency-free building block / demonstration.
 *
 * @example
 * <FeatureSection
 *   state={hasApiKey ? "active" : "disabled"}
 *   title="AI assistant"
 *   reason={t("feature.api_key_required", "Configure an API key")}
 * >
 *   <AiControls />
 * </FeatureSection>
 */
import type {ReactNode} from "react";
import {Lock} from "lucide-react";
import styles from "./FeatureSection.module.css";

export type FeatureState = "active" | "disabled" | "hidden";

export interface FeatureSectionProps {
  /** Resolved feature state. */
  state: FeatureState;
  /** Section heading (always shown unless hidden). */
  title: string;
  /** Localized reason, shown when `state === "disabled"`. */
  reason?: string;
  /** The feature's controls, rendered only when `state === "active"`. */
  children?: ReactNode;
  testId?: string;
}

export default function FeatureSection({state, title, reason, children, testId}: FeatureSectionProps) {
  if (state === "hidden") return null;

  return (
    <section className={styles.section} data-state={state} data-testid={testId}>
      <h3 className={styles.heading}>{title}</h3>
      {state === "active" ? (
        children
      ) : (
        <div className={styles.notice} role="note" data-testid={testId ? `${testId}-reason` : undefined}>
          <Lock size={14} aria-hidden />
          <span>{reason}</span>
        </div>
      )}
    </section>
  );
}
