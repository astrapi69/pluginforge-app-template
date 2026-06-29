import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";

const h = vi.hoisted(() => ({
  check: vi.fn(),
  state: {value: "idle" as string, latest: null as {version: string; url: string} | null},
}));

vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({t: (_key: string, fallback: string) => fallback}),
}));
vi.mock("../hooks/useUpdateCheck", () => ({
  useUpdateCheck: () => ({state: h.state.value, latest: h.state.latest, check: h.check}),
}));

import UpdateCheckControl from "./UpdateCheckControl";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  h.state.value = "idle";
  h.state.latest = null;
});

describe("UpdateCheckControl", () => {
  it("runs the check on click", () => {
    render(<UpdateCheckControl owner="o" repo="r" currentVersion="1.0.0" />);
    fireEvent.click(screen.getByTestId("update-check-button"));
    expect(h.check).toHaveBeenCalledTimes(1);
  });

  it("shows the current-version state", () => {
    h.state.value = "current";
    render(<UpdateCheckControl owner="o" repo="r" currentVersion="1.0.0" />);
    expect(screen.getByTestId("update-check-current")).toBeTruthy();
  });

  it("shows an available update as a link to the release", () => {
    h.state.value = "available";
    h.state.latest = {version: "2.0.0", url: "https://example/releases/2.0.0"};
    render(<UpdateCheckControl owner="o" repo="r" currentVersion="1.0.0" />);
    const link = screen.getByTestId("update-check-available");
    expect(link.getAttribute("href")).toBe("https://example/releases/2.0.0");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("shows an error state", () => {
    h.state.value = "error";
    render(<UpdateCheckControl owner="o" repo="r" currentVersion="1.0.0" />);
    expect(screen.getByTestId("update-check-error")).toBeTruthy();
  });
});
