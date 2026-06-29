import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";

const h = vi.hoisted(() => ({
  state: {needRefresh: false},
  updateServiceWorker: vi.fn(),
  setNeedRefresh: vi.fn(),
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [h.state.needRefresh, h.setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: h.updateServiceWorker,
  }),
}));

vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({t: (_key: string, fallback: string) => fallback}),
}));

import UpdatePrompt from "./UpdatePrompt";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  h.state.needRefresh = false;
});

describe("UpdatePrompt", () => {
  it("renders nothing when no update is waiting", () => {
    h.state.needRefresh = false;
    render(<UpdatePrompt />);
    expect(screen.queryByTestId("update-prompt")).toBeNull();
  });

  it("shows the banner when an update is waiting", () => {
    h.state.needRefresh = true;
    render(<UpdatePrompt />);
    expect(screen.getByTestId("update-prompt")).toBeTruthy();
  });

  it("activates the waiting SW and reloads on Aktualisieren", () => {
    h.state.needRefresh = true;
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByTestId("update-reload"));
    expect(h.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it("dismisses without reloading", () => {
    h.state.needRefresh = true;
    render(<UpdatePrompt />);
    fireEvent.click(screen.getByTestId("update-dismiss"));
    expect(h.setNeedRefresh).toHaveBeenCalledWith(false);
    expect(h.updateServiceWorker).not.toHaveBeenCalled();
  });
});
