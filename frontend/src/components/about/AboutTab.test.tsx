import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";

vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({t: (_key: string, fallback: string) => fallback}),
}));

import AboutTab from "./AboutTab";

afterEach(() => {
  cleanup();
});

describe("AboutTab", () => {
  it("renders the build-time app version", () => {
    render(<AboutTab />);
    const version = screen.getByTestId("about-app-version");
    expect(version.textContent).toBe(`v${__APP_VERSION__}`);
  });

  it("renders source / docs / license links opening in a new tab", () => {
    render(<AboutTab />);
    for (const key of ["repo", "docs", "license"]) {
      const link = screen.getByTestId(`about-link-${key}`);
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("target")).toBe("_blank");
    }
  });

  it("renders a credits section", () => {
    render(<AboutTab />);
    expect(screen.getByTestId("about-credits")).toBeTruthy();
  });
});
