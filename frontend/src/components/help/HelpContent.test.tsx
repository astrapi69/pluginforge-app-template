import {describe, expect, it, vi} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";
import HelpContent from "./HelpContent";

describe("HelpContent", () => {
    it("renders markdown headings", () => {
        render(<HelpContent content={"# Hello World\n\nBody text."} />);
        expect(screen.getByRole("heading", {level: 1, name: /hello world/i})).toBeInTheDocument();
    });

    it("renders paragraphs", () => {
        render(<HelpContent content={"Some plain paragraph."} />);
        expect(screen.getByText(/some plain paragraph/i)).toBeInTheDocument();
    });

    it("renders GFM tables (remark-gfm enabled)", () => {
        const md = `
| Key | Value |
|-----|-------|
| a   | b     |
`;
        render(<HelpContent content={md} />);
        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(screen.getByRole("cell", {name: "a"})).toBeInTheDocument();
    });

    it("external links open in a new tab", () => {
        render(<HelpContent content={"[external](https://example.com)"} />);
        const link = screen.getByRole("link", {name: /external/i});
        expect(link).toHaveAttribute("href", "https://example.com");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    });

    it("internal links call onInternalLink with the slug", () => {
        const onInternalLink = vi.fn();
        render(<HelpContent content={"[settings page](settings.md)"} onInternalLink={onInternalLink} />);
        const link = screen.getByRole("link", {name: /settings page/i});
        fireEvent.click(link);
        expect(onInternalLink).toHaveBeenCalledWith("settings");
    });

    it("renders the content into the testid container", () => {
        render(<HelpContent content={"# X"} />);
        expect(screen.getByTestId("help-content-body")).toBeInTheDocument();
    });
});
