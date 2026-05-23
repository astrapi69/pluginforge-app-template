import {describe, expect, it, vi} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";
import HelpSidebar from "./HelpSidebar";
import type {HelpNavItem} from "../../help/loader";

const flatNav: HelpNavItem[] = [
    {title: "Getting Started", slug: "getting-started"},
    {title: "Settings", slug: "settings"},
    {title: "FAQ", slug: "faq"},
];

const nestedNav: HelpNavItem[] = [
    {
        title: "Plugins",
        slug: "plugins",
        children: [
            {title: "Installing", slug: "plugins-install"},
            {title: "Configuring", slug: "plugins-config"},
        ],
    },
];

describe("HelpSidebar", () => {
    it("renders one button per top-level item", () => {
        render(<HelpSidebar items={flatNav} activeSlug="getting-started" onSelect={() => {}} />);
        expect(screen.getByTestId("help-sidebar-item-getting-started")).toBeInTheDocument();
        expect(screen.getByTestId("help-sidebar-item-settings")).toBeInTheDocument();
        expect(screen.getByTestId("help-sidebar-item-faq")).toBeInTheDocument();
    });

    it("marks the active item with data-active='true'", () => {
        render(<HelpSidebar items={flatNav} activeSlug="settings" onSelect={() => {}} />);
        expect(screen.getByTestId("help-sidebar-item-settings")).toHaveAttribute("data-active", "true");
        expect(screen.getByTestId("help-sidebar-item-faq")).toHaveAttribute("data-active", "false");
    });

    it("calls onSelect with the slug when a leaf item is clicked", () => {
        const onSelect = vi.fn();
        render(<HelpSidebar items={flatNav} activeSlug="getting-started" onSelect={onSelect} />);
        fireEvent.click(screen.getByTestId("help-sidebar-item-settings"));
        expect(onSelect).toHaveBeenCalledWith("settings");
    });

    it("renders children when present and expanded by default at depth 0", () => {
        render(<HelpSidebar items={nestedNav} activeSlug="plugins-install" onSelect={() => {}} />);
        expect(screen.getByTestId("help-sidebar-item-plugins-install")).toBeInTheDocument();
        expect(screen.getByTestId("help-sidebar-item-plugins-config")).toBeInTheDocument();
    });

    it("toggling a parent does not call onSelect (only navigation toggles)", () => {
        const onSelect = vi.fn();
        render(<HelpSidebar items={nestedNav} activeSlug="other" onSelect={onSelect} />);
        fireEvent.click(screen.getByTestId("help-sidebar-item-plugins"));
        expect(onSelect).not.toHaveBeenCalled();
    });

    it("renders an empty nav element for an empty items array", () => {
        render(<HelpSidebar items={[]} activeSlug="" onSelect={() => {}} />);
        const nav = screen.getByTestId("help-sidebar-nav");
        expect(nav).toBeInTheDocument();
        expect(nav.children.length).toBe(0);
    });
});
