import {describe, expect, it, vi, beforeEach} from "vitest";
import {renderHook, act} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {useHelpNav} from "./useHelpNav";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

beforeEach(() => {
    navigateMock.mockClear();
});

describe("useHelpNav", () => {
    const wrapper = ({children}: {children: React.ReactNode}) => (
        <MemoryRouter>{children}</MemoryRouter>
    );

    it("returns a function", () => {
        const {result} = renderHook(() => useHelpNav(), {wrapper});
        expect(typeof result.current).toBe("function");
    });

    it("navigates to /help#slug when called", () => {
        const {result} = renderHook(() => useHelpNav(), {wrapper});
        act(() => result.current("settings"));
        expect(navigateMock).toHaveBeenCalledWith("/help#settings");
    });

    it("navigates with arbitrary slugs", () => {
        const {result} = renderHook(() => useHelpNav(), {wrapper});
        act(() => result.current("plugins/install"));
        expect(navigateMock).toHaveBeenCalledWith("/help#plugins/install");
    });

    it("returns a stable reference across renders", () => {
        const {result, rerender} = renderHook(() => useHelpNav(), {wrapper});
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
    });
});
