import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";

vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({t: (_key: string, fallback: string) => fallback}),
}));

import InstallPrompt from "./InstallPrompt";

afterEach(() => {
  cleanup();
});

function fireBeforeInstall() {
  const event = new Event("beforeinstallprompt") as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{outcome: string}>;
  };
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({outcome: "accepted"});
  window.dispatchEvent(event);
  return event;
}

describe("InstallPrompt", () => {
  it("renders nothing before the browser offers an install", () => {
    render(<InstallPrompt />);
    expect(screen.queryByTestId("install-prompt")).toBeNull();
  });

  it("appears after beforeinstallprompt and triggers the native prompt on install", async () => {
    render(<InstallPrompt />);
    const event = fireBeforeInstall();
    await waitFor(() => expect(screen.getByTestId("install-prompt")).toBeTruthy());
    fireEvent.click(screen.getByTestId("install-accept"));
    await waitFor(() => expect(event.prompt).toHaveBeenCalled());
  });

  it("dismisses on close", async () => {
    render(<InstallPrompt />);
    fireBeforeInstall();
    await waitFor(() => expect(screen.getByTestId("install-prompt")).toBeTruthy());
    fireEvent.click(screen.getByTestId("install-dismiss"));
    expect(screen.queryByTestId("install-prompt")).toBeNull();
  });
});
