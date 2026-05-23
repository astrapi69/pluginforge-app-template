import {describe, expect, it, vi, beforeEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import axe from "axe-core";
import Help from "./Help";

const navigateMock = vi.fn();
let mockHash = "";
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => navigateMock,
        useLocation: () => ({hash: mockHash, key: "default", pathname: "/help", search: "", state: null}),
    };
});

vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fallback: string) => fallback, lang: "en"}),
}));

vi.mock("../hooks/useTheme", () => ({
    useTheme: () => ({theme: "light", setTheme: vi.fn()}),
}));

vi.mock("../components/ThemeToggle", () => ({
    default: () => null,
}));

beforeEach(() => {
    navigateMock.mockClear();
    mockHash = "";
});

describe("Help page", () => {
    function renderPage() {
        return render(
            <MemoryRouter>
                <Help />
            </MemoryRouter>,
        );
    }

    it("renders the page header and sidebar without crashing", async () => {
        renderPage();
        expect(screen.getByText("Help")).toBeInTheDocument();
        expect(screen.getByTestId("help-sidebar")).toBeInTheDocument();
        expect(screen.getByTestId("help-page-content")).toBeInTheDocument();
    });

    it("renders the EN sidebar items from the bundled _meta.ts", async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByTestId("help-sidebar-item-getting-started")).toBeInTheDocument();
        });
        expect(screen.getByTestId("help-sidebar-item-settings")).toBeInTheDocument();
        expect(screen.getByTestId("help-sidebar-item-faq")).toBeInTheDocument();
    });

    it("renders the default page (getting-started) when hash is empty", async () => {
        mockHash = "";
        renderPage();
        await waitFor(() => {
            expect(screen.getByRole("heading", {level: 1, name: /getting started/i})).toBeInTheDocument();
        });
    });

    it("renders the page that matches the URL hash", async () => {
        mockHash = "#settings";
        renderPage();
        await waitFor(() => {
            expect(screen.getByRole("heading", {level: 1, name: /^settings$/i})).toBeInTheDocument();
        });
    });

    it("renders a not-found message for an unknown slug", async () => {
        mockHash = "#nonexistent";
        renderPage();
        await waitFor(() => {
            expect(screen.getByRole("heading", {level: 1, name: /page not found/i})).toBeInTheDocument();
        });
    });

    it("has no critical or serious WCAG violations (axe-core scan)", async () => {
        const {container} = renderPage();
        await waitFor(() => {
            expect(screen.getByRole("heading", {level: 1, name: /getting started/i})).toBeInTheDocument();
        });
        const results = await axe.run(container, {
            // happy-dom does not compute styles the way a real browser
            // does, so color-contrast is unreliable here. Verified
            // manually in the audit (all default-theme pairs PASS AA);
            // dev-time @axe-core/react covers it at runtime.
            rules: {"color-contrast": {enabled: false}},
        });
        const blocking = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious",
        );
        if (blocking.length > 0) {
            console.error(
                "axe violations:",
                JSON.stringify(
                    blocking.map((v) => ({id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length})),
                    null,
                    2,
                ),
            );
        }
        expect(blocking).toEqual([]);
    });

    it("renders the <main> with id='main-content' so the skip link works", () => {
        const {container} = renderPage();
        const main = container.querySelector("main#main-content");
        expect(main).not.toBeNull();
        expect(main).toHaveAttribute("tabindex", "-1");
    });
});
