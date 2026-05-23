import {describe, expect, it, vi, beforeEach} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import HelpButton from "./HelpButton";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

vi.mock("../../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k: string, fallback: string) => fallback, lang: "en"}),
}));

beforeEach(() => {
    navigateMock.mockClear();
});

describe("HelpButton", () => {
    function renderButton(slug: string) {
        return render(
            <MemoryRouter>
                <HelpButton slug={slug} />
            </MemoryRouter>,
        );
    }

    it("renders with a slug-scoped testid", () => {
        renderButton("settings");
        expect(screen.getByTestId("help-button-settings")).toBeInTheDocument();
    });

    it("navigates to /help#slug when clicked", () => {
        renderButton("plugins");
        fireEvent.click(screen.getByTestId("help-button-plugins"));
        expect(navigateMock).toHaveBeenCalledWith("/help#plugins");
    });

    it("uses the i18n 'Open help' title", () => {
        renderButton("faq");
        expect(screen.getByTestId("help-button-faq")).toHaveAttribute("title", "Open help");
    });
});
