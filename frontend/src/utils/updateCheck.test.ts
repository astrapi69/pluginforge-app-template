import {describe, expect, it, vi} from "vitest";
import {checkForUpdate, compareSemver} from "./updateCheck";

function mockFetch(payload: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({ok, json: async () => payload})) as unknown as typeof fetch;
}

describe("compareSemver", () => {
  it("orders versions and ignores a leading v + pre-release suffix", () => {
    expect(compareSemver("1.2.3", "1.2.0")).toBe(1);
    expect(compareSemver("v1.0.0", "1.0.1")).toBe(-1);
    expect(compareSemver("2.0.0", "2.0.0")).toBe(0);
    expect(compareSemver("1.2.0", "1.2.0-rc.1")).toBe(0);
    expect(compareSemver("1.10.0", "1.9.0")).toBe(1);
  });
});

describe("checkForUpdate", () => {
  it("reports 'available' when the latest release is newer", async () => {
    const result = await checkForUpdate({
      owner: "o",
      repo: "r",
      currentVersion: "1.0.0",
      fetchImpl: mockFetch({tag_name: "v2.0.0", html_url: "https://example/r/releases/2.0.0"}),
    });
    expect(result.status).toBe("available");
    expect(result.latest?.version).toBe("2.0.0");
    expect(result.latest?.url).toContain("releases");
  });

  it("reports 'current' when running the latest", async () => {
    const result = await checkForUpdate({
      owner: "o",
      repo: "r",
      currentVersion: "2.0.0",
      fetchImpl: mockFetch({tag_name: "2.0.0", html_url: "https://example"}),
    });
    expect(result.status).toBe("current");
  });

  it("reports 'error' on a non-ok response", async () => {
    const result = await checkForUpdate({
      owner: "o",
      repo: "r",
      currentVersion: "1.0.0",
      fetchImpl: mockFetch({}, false),
    });
    expect(result.status).toBe("error");
  });

  it("reports 'error' when fetch throws", async () => {
    const throwing = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    const result = await checkForUpdate({owner: "o", repo: "r", currentVersion: "1.0.0", fetchImpl: throwing});
    expect(result.status).toBe("error");
  });
});
