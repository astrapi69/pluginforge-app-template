/**
 * Loading-placeholder primitive.
 *
 * A shimmering block to show while content loads, for consistent loading
 * states instead of ad-hoc spinners. Use `count` to render several stacked
 * lines (e.g. a paragraph or list placeholder).
 *
 * @example
 * {loading ? <Skeleton count={3} /> : <ArticleList items={items} />}
 * <Skeleton variant="circle" width={40} height={40} />
 */
import styles from "./Skeleton.module.css";

export interface SkeletonProps {
  /** Shape: a text line, a rectangular block, or a circle. */
  variant?: "line" | "block" | "circle";
  /** CSS width (number = px). Defaults per variant. */
  width?: string | number;
  /** CSS height (number = px). Defaults per variant. */
  height?: string | number;
  /** Render this many stacked copies (for multi-line placeholders). */
  count?: number;
  className?: string;
}

function toCss(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

export default function Skeleton({variant = "line", width, height, count = 1, className}: SkeletonProps) {
  const items = Array.from({length: Math.max(1, count)});
  return (
    <span className={styles.group} data-testid="skeleton" aria-hidden>
      {items.map((_unused, index) => (
        <span
          key={index}
          className={[styles.skeleton, styles[variant], className].filter(Boolean).join(" ")}
          style={{width: toCss(width), height: toCss(height)}}
        />
      ))}
    </span>
  );
}
