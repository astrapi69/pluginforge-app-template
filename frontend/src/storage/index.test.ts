import {afterEach, describe, expect, it, vi} from "vitest";

const h = vi.hoisted(() => ({
  exportUrl: vi.fn(() => "/api/backup/export"),
  importFn: vi.fn(async () => ({imported_books: 1})),
  getApp: vi.fn(async () => ({ok: true})),
  updateApp: vi.fn(async () => ({ok: true})),
}));

vi.mock("../api/client", () => ({
  api: {
    settings: {getApp: h.getApp, updateApp: h.updateApp},
    backup: {exportUrl: h.exportUrl, import: h.importFn},
  },
}));

import {getStorage, resetStorageForTests} from "./index";

afterEach(() => {
  resetStorageForTests();
  vi.clearAllMocks();
});

describe("getStorage (ApiStorage backing)", () => {
  it("delegates backup + settings to the api client", async () => {
    const storage = getStorage();
    expect(storage.backup.exportUrl()).toBe("/api/backup/export");
    await storage.backup.import(new File(["x"], "b.bgb"));
    expect(h.importFn).toHaveBeenCalledTimes(1);
    await storage.settings.getApp();
    expect(h.getApp).toHaveBeenCalledTimes(1);
  });

  it("returns a stable singleton", () => {
    expect(getStorage()).toBe(getStorage());
  });
});
