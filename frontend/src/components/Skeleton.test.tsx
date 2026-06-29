import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import Skeleton from "./Skeleton";

afterEach(() => {
  cleanup();
});

describe("Skeleton", () => {
  it("renders a single placeholder by default", () => {
    const {container} = render(<Skeleton />);
    expect(screen.getByTestId("skeleton")).toBeTruthy();
    expect(container.querySelectorAll("[data-testid='skeleton'] > span")).toHaveLength(1);
  });

  it("renders `count` stacked placeholders", () => {
    const {container} = render(<Skeleton count={4} />);
    expect(container.querySelectorAll("[data-testid='skeleton'] > span")).toHaveLength(4);
  });

  it("applies explicit width/height", () => {
    const {container} = render(<Skeleton variant="circle" width={40} height={40} />);
    const item = container.querySelector("[data-testid='skeleton'] > span") as HTMLElement;
    expect(item.style.width).toBe("40px");
    expect(item.style.height).toBe("40px");
  });

  it("is hidden from assistive tech", () => {
    render(<Skeleton />);
    expect(screen.getByTestId("skeleton").getAttribute("aria-hidden")).toBe("true");
  });
});
