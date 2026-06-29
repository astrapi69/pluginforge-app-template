import {describe, expect, it} from "vitest";
import de from "../data/i18n/de.json";
import en from "../data/i18n/en.json";

// Pins the pattern-05 i18n bundle: the JSON catalogs generated from the
// backend YAML (make sync-i18n) must be present and populated, since
// useI18n loads them via import.meta.glob. A stale/empty bundle would make
// every t() fall back to its key.
type Catalog = {ui?: Record<string, unknown>};

describe("bundled i18n catalogs", () => {
  it("the eager default (de) catalog is populated under ui", () => {
    expect(Object.keys(de).length).toBeGreaterThan(0);
    expect((de as Catalog).ui).toBeTruthy();
  });

  it("a lazy catalog (en) is populated under ui", () => {
    expect((en as Catalog).ui).toBeTruthy();
    expect(Object.keys((en as Catalog).ui ?? {}).length).toBeGreaterThan(0);
  });
});
