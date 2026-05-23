import {describe, expect, it, vi, beforeEach} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
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
});
