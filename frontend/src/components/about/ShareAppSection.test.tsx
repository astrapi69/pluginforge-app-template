import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";

vi.mock("qrcode", () => ({
  default: {toDataURL: vi.fn(async () => "data:image/png;base64,QR")},
}));
vi.mock("../../hooks/useI18n", () => ({useI18n: () => ({t: (_k: string, f: string) => f})}));
vi.mock("../../utils/clipboard", () => ({copyToClipboard: vi.fn(async () => true)}));
vi.mock("../../utils/notify", () => ({notify: {success: vi.fn(), error: vi.fn()}}));

import ShareAppSection from "./ShareAppSection";

afterEach(() => {
  cleanup();
});

describe("ShareAppSection", () => {
  it("renders a share button and opens the QR modal on click", async () => {
    render(<ShareAppSection appUrl="https://myapp.example" />);
    expect(screen.queryByTestId("qr-modal")).toBeNull();
    fireEvent.click(screen.getByTestId("about-share-button"));
    await waitFor(() => expect(screen.getByTestId("qr-modal")).toBeTruthy());
    expect(screen.getByTestId("qr-modal-url").textContent).toBe("https://myapp.example");
  });
});
