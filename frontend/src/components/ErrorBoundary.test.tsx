import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";

vi.mock("../hooks/useI18n", () => ({
  useI18n: () => ({t: (_key: string, fallback: string) => fallback}),
}));

import ErrorBoundary from "./ErrorBoundary";

function Boom(): never {
  throw new Error("kaboom");
}

let consoleErr: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // React logs the caught error; silence it for a clean test output.
  consoleErr = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  consoleErr.mockRestore();
});

describe("ErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <div data-testid="ok">fine</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("ok")).toBeTruthy();
    expect(screen.queryByTestId("error-boundary")).toBeNull();
  });

  it("renders the fallback with the error message when a child throws", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("error-boundary")).toBeTruthy();
    expect(screen.getByTestId("error-boundary-detail").textContent).toContain("kaboom");
  });

  it("dispatches the report event on 'report'", () => {
    const handler = vi.fn();
    window.addEventListener("myapp:open-error-report", handler);
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByTestId("error-boundary-report"));
    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail.message).toContain("kaboom");
    window.removeEventListener("myapp:open-error-report", handler);
  });
});
