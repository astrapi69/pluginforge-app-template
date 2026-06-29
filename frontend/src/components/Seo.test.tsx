import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render} from "@testing-library/react";
import {Seo} from "./Seo";

const managed = () => document.head.querySelectorAll("[data-seo-managed]");
const metaContent = (selector: string) =>
  document.head.querySelector(selector)?.getAttribute("content");

afterEach(() => {
  cleanup();
});

describe("Seo", () => {
  it("sets the document title and core meta/OG/twitter tags", () => {
    render(
      <Seo
        title="Dashboard - MyApp"
        description="Your projects at a glance."
        canonical="https://myapp.example/dashboard"
        image="https://myapp.example/og.png"
      />,
    );

    expect(document.title).toBe("Dashboard - MyApp");
    expect(metaContent('meta[name="description"]')).toBe("Your projects at a glance.");
    expect(metaContent('meta[property="og:title"]')).toBe("Dashboard - MyApp");
    expect(metaContent('meta[property="og:url"]')).toBe("https://myapp.example/dashboard");
    expect(metaContent('meta[name="twitter:card"]')).toBe("summary_large_image");
    expect(
      document.head.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toBe("https://myapp.example/dashboard");
  });

  it("emits robots noindex only when requested", () => {
    render(<Seo title="Private" noindex />);
    expect(metaContent('meta[name="robots"]')).toBe("noindex,nofollow");
  });

  it("emits a JSON-LD script when jsonLd is provided", () => {
    render(<Seo title="Article" jsonLd={{"@type": "Article", headline: "Hi"}} />);
    const script = document.head.querySelector('script[type="application/ld+json"]');
    expect(script?.textContent).toContain('"headline":"Hi"');
  });

  it("removes all managed tags and restores the title on unmount", () => {
    const before = document.title;
    const {unmount} = render(<Seo title="Temp" description="x" />);
    expect(managed().length).toBeGreaterThan(0);
    unmount();
    expect(managed().length).toBe(0);
    expect(document.title).toBe(before);
  });
});
