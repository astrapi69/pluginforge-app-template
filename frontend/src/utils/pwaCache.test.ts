import {afterEach, describe, expect, it, vi} from "vitest";
import {clearAppCaches} from "./pwaCache";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("clearAppCaches", () => {
  it("deletes every cache key and unregisters every service worker", async () => {
    const cacheDelete = vi.fn(async () => true);
    vi.stubGlobal("caches", {
      keys: vi.fn(async () => ["precache-v1", "runtime"]),
      delete: cacheDelete,
    });
    const unregister = vi.fn(async () => true);
    vi.stubGlobal("navigator", {
      serviceWorker: {getRegistrations: vi.fn(async () => [{unregister}, {unregister}])},
    });

    await clearAppCaches();

    expect(cacheDelete).toHaveBeenCalledTimes(2);
    expect(cacheDelete).toHaveBeenCalledWith("precache-v1");
    expect(unregister).toHaveBeenCalledTimes(2);
  });

  it("is a no-op when the APIs are unavailable", async () => {
    vi.stubGlobal("caches", undefined);
    vi.stubGlobal("navigator", {});
    await expect(clearAppCaches()).resolves.toBeUndefined();
  });
});
