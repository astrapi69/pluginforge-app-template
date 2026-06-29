import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import CommandPalette, {type Command} from "./CommandPalette";

function commands(runA = vi.fn(), runB = vi.fn()): Command[] {
  return [
    {id: "a", label: "Go to Dashboard", keywords: "home", run: runA},
    {id: "b", label: "Open Settings", keywords: "config", run: runB},
  ];
}

afterEach(() => {
  cleanup();
});

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    render(<CommandPalette open={false} onClose={() => undefined} commands={commands()} />);
    expect(screen.queryByTestId("command-palette")).toBeNull();
  });

  it("lists commands and filters by query (label + keywords)", () => {
    render(<CommandPalette open onClose={() => undefined} commands={commands()} />);
    expect(screen.getByTestId("command-a")).toBeTruthy();
    expect(screen.getByTestId("command-b")).toBeTruthy();
    fireEvent.change(screen.getByTestId("command-palette-input"), {target: {value: "config"}});
    expect(screen.queryByTestId("command-a")).toBeNull();
    expect(screen.getByTestId("command-b")).toBeTruthy();
  });

  it("runs a command on click and closes", () => {
    const runA = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} commands={commands(runA)} />);
    fireEvent.click(screen.getByTestId("command-a"));
    expect(runA).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ArrowDown + Enter runs the next command, not the first", () => {
    const runA = vi.fn();
    const runB = vi.fn();
    render(<CommandPalette open onClose={() => undefined} commands={commands(runA, runB)} />);
    const palette = screen.getByTestId("command-palette");
    fireEvent.keyDown(palette, {key: "ArrowDown"});
    fireEvent.keyDown(palette, {key: "Enter"});
    expect(runB).toHaveBeenCalledTimes(1);
    expect(runA).not.toHaveBeenCalled();
  });

  it("Escape closes", () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} commands={commands()} />);
    fireEvent.keyDown(screen.getByTestId("command-palette"), {key: "Escape"});
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state when nothing matches", () => {
    render(<CommandPalette open onClose={() => undefined} commands={commands()} />);
    fireEvent.change(screen.getByTestId("command-palette-input"), {target: {value: "zzzzz"}});
    expect(screen.getByTestId("command-palette-empty")).toBeTruthy();
  });
});
