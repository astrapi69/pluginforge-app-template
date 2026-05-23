import {describe, expect, it} from "vitest";
import {loadNav, loadPage, searchPages} from "./loader";

describe("help/loader", () => {
    describe("loadNav", () => {
        it("returns the EN nav array from en/_meta.ts", async () => {
            const nav = await loadNav("en");
            expect(nav.length).toBeGreaterThan(0);
            expect(nav[0].slug).toBe("getting-started");
            expect(nav.map((n) => n.slug)).toEqual([
                "getting-started",
                "settings",
                "plugins",
                "faq",
                "troubleshooting",
            ]);
        });

        it("returns the DE nav with translated titles", async () => {
            const nav = await loadNav("de");
            const titles = nav.map((n) => n.title);
            expect(titles).toContain("Erste Schritte");
            expect(titles).toContain("Einstellungen");
            expect(titles).toContain("Fehlerbehebung");
        });

        it("returns an empty array for an unknown locale", async () => {
            const nav = await loadNav("xx");
            expect(nav).toEqual([]);
        });
    });

    describe("loadPage", () => {
        it("returns the markdown content for a known slug", async () => {
            const page = await loadPage("en", "getting-started");
            expect(page).not.toBeNull();
            expect(page!.slug).toBe("getting-started");
            expect(page!.locale).toBe("en");
            expect(page!.content).toMatch(/# Getting Started/);
            expect(page!.content).toMatch(/MyApp/);
        });

        it("returns null for an unknown slug", async () => {
            const page = await loadPage("en", "nonexistent");
            expect(page).toBeNull();
        });

        it("returns null for an unknown locale", async () => {
            const page = await loadPage("xx", "getting-started");
            expect(page).toBeNull();
        });
    });

    describe("searchPages", () => {
        it("finds pages whose body contains the query", async () => {
            const results = await searchPages("en", "MyApp");
            expect(results.length).toBeGreaterThan(0);
            const slugs = results.map((r) => r.slug);
            expect(slugs).toContain("getting-started");
        });

        it("returns titles from the H1 heading", async () => {
            const results = await searchPages("en", "MyApp");
            const gs = results.find((r) => r.slug === "getting-started");
            expect(gs?.title).toBe("Getting Started");
        });

        it("returns empty for queries that match nothing", async () => {
            const results = await searchPages("en", "zzz-no-such-token-zzz");
            expect(results).toEqual([]);
        });

        it("scopes results to the requested locale", async () => {
            const en = await searchPages("en", "MyApp");
            const de = await searchPages("de", "MyApp");
            expect(en.some((r) => r.slug === "getting-started")).toBe(true);
            expect(de.some((r) => r.slug === "getting-started")).toBe(true);
        });
    });
});
