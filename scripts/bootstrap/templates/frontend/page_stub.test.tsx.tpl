/**
 * Smoke test for ${class_name}${page_suffix} stub. The real page UI is
 * left to the AI / human session that follows the bootstrap; this test
 * pins that the file at least mounts without throwing so the build stays
 * green.
 */

import {render, screen} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import ${class_name}${page_suffix} from "./${class_name}${page_suffix}";

vi.mock("../hooks/use${pascal_name}", () => ({
    use${entities_pascal}: () => ({data: [], loading: false, error: null, refresh: vi.fn()}),
}));

describe("${class_name}${page_suffix}", () => {
    it("renders without crashing", () => {
        render(<${class_name}${page_suffix} />);
        expect(screen.getByTestId("${plural}-${page_kind}-page")).toBeInTheDocument();
    });
});
