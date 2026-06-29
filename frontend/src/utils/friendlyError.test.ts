import {afterEach, describe, expect, it, vi} from "vitest";
import {ApiError} from "../api/client";

vi.mock("./devMode", () => ({isDevMode: vi.fn(() => false)}));
vi.mock("../hooks/useI18n", () => ({translate: (_key: string, fallback: string) => fallback}));

import {friendlyMessage} from "./friendlyError";
import {isDevMode} from "./devMode";

const apiErr = (status: number) => new ApiError(status, "raw backend detail", "/api/x", "GET");

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(isDevMode).mockReturnValue(false);
});

describe("friendlyMessage", () => {
  it("maps status classes to friendly text in production mode", () => {
    expect(friendlyMessage("raw", apiErr(404)).toLowerCase()).toContain("find");
    expect(friendlyMessage("raw", apiErr(422)).toLowerCase()).toContain("information");
    expect(friendlyMessage("raw", apiErr(409)).toLowerCase()).toContain("conflict");
    expect(friendlyMessage("raw", apiErr(500)).toLowerCase()).toContain("our side");
    expect(friendlyMessage("raw", apiErr(0)).toLowerCase()).toContain("server");
  });

  it("never returns the raw backend detail for an ApiError in production", () => {
    expect(friendlyMessage("raw backend detail", apiErr(500))).not.toContain("raw backend detail");
  });

  it("returns the raw message for a non-ApiError", () => {
    expect(friendlyMessage("plain message")).toBe("plain message");
  });

  it("returns the raw detail in Developer Mode", () => {
    vi.mocked(isDevMode).mockReturnValue(true);
    expect(friendlyMessage("raw backend detail", apiErr(500))).toBe("raw backend detail");
  });
});
