import {afterEach, describe, expect, it} from "vitest";
import {isDevMode, setDevMode} from "./devMode";

afterEach(() => {
  localStorage.clear();
});

describe("devMode", () => {
  it("is off by default", () => {
    localStorage.clear();
    expect(isDevMode()).toBe(false);
  });

  it("persists on and off", () => {
    setDevMode(true);
    expect(isDevMode()).toBe(true);
    setDevMode(false);
    expect(isDevMode()).toBe(false);
  });
});
