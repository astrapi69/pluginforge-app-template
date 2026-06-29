import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";

const h = vi.hoisted(() => ({
  exportUrl: vi.fn(() => "/api/backup/export"),
  importFn: vi.fn(),
  confirm: vi.fn(),
  clearCaches: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("../../hooks/useI18n", () => ({
  useI18n: () => ({t: (_key: string, fallback: string) => fallback}),
}));
vi.mock("../AppDialog", () => ({useDialog: () => ({confirm: h.confirm})}));
vi.mock("../../utils/notify", () => ({notify: {success: h.notifySuccess, error: h.notifyError}}));
vi.mock("../../utils/pwaCache", () => ({clearAppCaches: h.clearCaches}));
vi.mock("../../api/client", () => ({
  api: {backup: {exportUrl: h.exportUrl, import: h.importFn}},
  ApiError: class ApiError extends Error {detail = "";},
}));

import {DataSettings} from "./DataSettings";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DataSettings", () => {
  it("exports a backup via the export URL and notifies", () => {
    render(<DataSettings />);
    fireEvent.click(screen.getByTestId("data-export"));
    expect(h.exportUrl).toHaveBeenCalled();
    expect(h.notifySuccess).toHaveBeenCalled();
  });

  it("imports a backup only after confirmation", async () => {
    h.confirm.mockResolvedValue(true);
    h.importFn.mockResolvedValue({imported_books: 2, imported_articles: 5});
    render(<DataSettings />);
    const input = screen.getByTestId("data-import-input") as HTMLInputElement;
    const file = new File(["data"], "backup.bgb");
    fireEvent.change(input, {target: {files: [file]}});
    await waitFor(() => expect(h.importFn).toHaveBeenCalledWith(file));
    expect(h.confirm).toHaveBeenCalled();
    expect(h.notifySuccess).toHaveBeenCalled();
  });

  it("does not import when the user cancels the confirm", async () => {
    h.confirm.mockResolvedValue(false);
    render(<DataSettings />);
    const input = screen.getByTestId("data-import-input") as HTMLInputElement;
    fireEvent.change(input, {target: {files: [new File(["d"], "b.bgb")]}});
    await waitFor(() => expect(h.confirm).toHaveBeenCalled());
    expect(h.importFn).not.toHaveBeenCalled();
  });

  it("clears the cache and reloads after confirmation", async () => {
    h.confirm.mockResolvedValue(true);
    h.clearCaches.mockResolvedValue(undefined);
    const reload = vi.fn();
    vi.stubGlobal("location", {...window.location, reload});
    render(<DataSettings />);
    fireEvent.click(screen.getByTestId("data-clear-cache"));
    await waitFor(() => expect(h.clearCaches).toHaveBeenCalled());
    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
