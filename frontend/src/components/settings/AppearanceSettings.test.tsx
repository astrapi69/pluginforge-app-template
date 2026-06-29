import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";

vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({t: (_key: string, fallback: string) => fallback}),
}));

import {AppearanceSettings} from "./AppearanceSettings";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("AppearanceSettings", () => {
  it("renders a mode toggle and every palette", () => {
    render(<AppearanceSettings />);
    expect(screen.getByTestId("appearance-mode-light")).toBeTruthy();
    expect(screen.getByTestId("appearance-mode-dark")).toBeTruthy();
    expect(screen.getByTestId("appearance-palette-nord")).toBeTruthy();
    expect(screen.getByTestId("appearance-palette-classic")).toBeTruthy();
  });

  it("selecting a palette persists it and flips data-app-theme", () => {
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByTestId("appearance-palette-nord"));
    expect(localStorage.getItem("myapp-app-theme")).toBe("nord");
    expect(document.documentElement.getAttribute("data-app-theme")).toBe("nord");
    expect(screen.getByTestId("appearance-palette-nord").getAttribute("aria-checked")).toBe("true");
  });

  it("switching to dark mode flips data-theme", () => {
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByTestId("appearance-mode-dark"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("myapp-theme")).toBe("dark");
  });
});
