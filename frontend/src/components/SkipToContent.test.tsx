import {describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import axe from "axe-core";
import SkipToContent from "./SkipToContent";

vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fallback: string) => fallback, lang: "en"}),
}));

describe("SkipToContent", () => {
    it("renders an anchor pointing at #main-content", () => {
        render(<SkipToContent />);
        const link = screen.getByTestId("skip-to-content");
        expect(link.tagName).toBe("A");
        expect(link).toHaveAttribute("href", "#main-content");
    });

    it("renders the i18n-driven label", () => {
        render(<SkipToContent />);
        expect(screen.getByTestId("skip-to-content")).toHaveTextContent("Skip to content");
    });

    it("uses the .skip-link class so the off-screen-by-default CSS applies", () => {
        render(<SkipToContent />);
        expect(screen.getByTestId("skip-to-content")).toHaveClass("skip-link");
    });

    it("is keyboard-focusable (default for anchors with href)", () => {
        render(<SkipToContent />);
        const link = screen.getByTestId("skip-to-content");
        link.focus();
        expect(document.activeElement).toBe(link);
    });

    it("synthetic skip-link + main + h1 page has no critical/serious axe violations", async () => {
        const {container} = render(
            <>
                <SkipToContent />
                <main id="main-content" tabIndex={-1}>
                    <h1>Test heading</h1>
                    <p>Body copy.</p>
                </main>
            </>,
        );
        const results = await axe.run(container, {
            rules: {"color-contrast": {enabled: false}},
        });
        const blocking = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious",
        );
        expect(blocking).toEqual([]);
    });
});
