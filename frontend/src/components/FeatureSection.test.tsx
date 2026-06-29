import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import FeatureSection from "./FeatureSection";

afterEach(() => {
  cleanup();
});

describe("FeatureSection", () => {
  it("active: shows the title and renders its controls", () => {
    render(
      <FeatureSection state="active" title="Sync" testId="sync">
        <button data-testid="sync-control">Sync now</button>
      </FeatureSection>,
    );
    expect(screen.getByText("Sync")).toBeTruthy();
    expect(screen.getByTestId("sync-control")).toBeTruthy();
    expect(screen.queryByTestId("sync-reason")).toBeNull();
  });

  it("disabled: keeps the title, shows the reason, hides the controls", () => {
    render(
      <FeatureSection state="disabled" title="Sync" reason="Only in the desktop app" testId="sync">
        <button data-testid="sync-control">Sync now</button>
      </FeatureSection>,
    );
    expect(screen.getByText("Sync")).toBeTruthy();
    expect(screen.getByTestId("sync-reason").textContent).toContain("Only in the desktop app");
    expect(screen.queryByTestId("sync-control")).toBeNull();
  });

  it("hidden: renders nothing", () => {
    render(
      <FeatureSection state="hidden" title="Sync" testId="sync">
        <button data-testid="sync-control">Sync now</button>
      </FeatureSection>,
    );
    expect(screen.queryByTestId("sync")).toBeNull();
    expect(screen.queryByText("Sync")).toBeNull();
  });
});
