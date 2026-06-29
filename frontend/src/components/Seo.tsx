import {useEffect} from "react";

/**
 * Props for {@link Seo}. All fields are optional except `title`.
 *
 * @example
 * <Seo
 *   title="Dashboard - MyApp"
 *   description="Your projects at a glance."
 *   canonical="https://myapp.example/dashboard"
 *   image="https://myapp.example/og/dashboard.png"
 * />
 */
export interface SeoProps {
  /** Page title -> document.title + og:title + twitter:title. */
  title: string;
  /** Meta description -> description + og:description + twitter:description. */
  description?: string;
  /** Absolute canonical URL -> <link rel="canonical"> + og:url. */
  canonical?: string;
  /** Absolute image URL -> og:image + twitter:image. */
  image?: string;
  /** Open Graph type (e.g. "website", "article"). Defaults to "website". */
  type?: string;
  /** og:site_name. */
  siteName?: string;
  /** og:locale (e.g. "en_US", "de_DE"). */
  locale?: string;
  /** When true, emits <meta name="robots" content="noindex,nofollow">. */
  noindex?: boolean;
  /** JSON-LD structured data, emitted as an application/ld+json script. */
  jsonLd?: Record<string, unknown>;
}

const MANAGED_ATTR = "data-seo-managed";

type TagSpec =
  | {kind: "meta"; key: "name" | "property"; keyValue: string; content: string}
  | {kind: "link"; rel: string; href: string}
  | {kind: "jsonld"; json: string};

/**
 * Dependency-free SEO head manager. Mount it inside any route/page to set
 * the document title and the meta / Open Graph / Twitter / canonical /
 * JSON-LD tags for that view. On unmount or prop change it removes the tags
 * it created, so navigating between pages never leaks stale head tags.
 *
 * Renders nothing. No external dependency (no react-helmet); it writes to
 * `document.head` directly. For SSR/prerender, pair it with your build's
 * static `index.html` defaults.
 */
export function Seo({
  title,
  description,
  canonical,
  image,
  type = "website",
  siteName,
  locale,
  noindex,
  jsonLd,
}: SeoProps): null {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const specs: TagSpec[] = [];
    const meta = (key: "name" | "property", keyValue: string, content?: string) => {
      if (content) specs.push({kind: "meta", key, keyValue, content});
    };

    meta("name", "description", description);
    meta("property", "og:title", title);
    meta("property", "og:type", type);
    meta("property", "og:description", description);
    meta("property", "og:url", canonical);
    meta("property", "og:image", image);
    meta("property", "og:site_name", siteName);
    meta("property", "og:locale", locale);
    meta("name", "twitter:card", image ? "summary_large_image" : "summary");
    meta("name", "twitter:title", title);
    meta("name", "twitter:description", description);
    meta("name", "twitter:image", image);
    if (noindex) meta("name", "robots", "noindex,nofollow");
    if (canonical) specs.push({kind: "link", rel: "canonical", href: canonical});
    if (jsonLd) specs.push({kind: "jsonld", json: JSON.stringify(jsonLd)});

    const created = specs.map((spec) => {
      let el: HTMLElement;
      if (spec.kind === "meta") {
        el = document.createElement("meta");
        el.setAttribute(spec.key, spec.keyValue);
        el.setAttribute("content", spec.content);
      } else if (spec.kind === "link") {
        el = document.createElement("link");
        el.setAttribute("rel", spec.rel);
        el.setAttribute("href", spec.href);
      } else {
        el = document.createElement("script");
        el.setAttribute("type", "application/ld+json");
        el.textContent = spec.json;
      }
      el.setAttribute(MANAGED_ATTR, "");
      document.head.appendChild(el);
      return el;
    });

    return () => {
      document.title = previousTitle;
      created.forEach((el) => el.remove());
    };
  }, [title, description, canonical, image, type, siteName, locale, noindex, jsonLd]);

  return null;
}

export default Seo;
